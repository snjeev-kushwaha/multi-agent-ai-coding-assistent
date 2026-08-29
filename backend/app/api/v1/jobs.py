import asyncio
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError, ValidationFailedError
from app.core.logging import get_logger
from app.core.rate_limit import enforce_rate_limit
from app.config import get_settings
from app.db.models import Job, User
from app.db.session import get_db
from app.db.sync_session import get_sync_db
from app.workers.event_bus import event_bus
from app.workers.job_worker import resume_job, start_job

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = get_logger(__name__)


class CreateJobRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=4000)
    mode: str = Field(default="build", pattern="^(build|edit)$")


class JobResponse(BaseModel):
    id: str
    status: str
    user_prompt: str
    plan: dict | None = None
    task_plan: dict | None = None
    files_written: dict | None = None
    files_failed: dict | None = None
    download_path: str | None = None
    error_message: str | None = None

    class Config:
        from_attributes = True


class RespondRequest(BaseModel):
    # For plan/architecture confirmations: {"action": "proceed"|"edit"|"cancel", "instruction": "..."}
    # For clarification answers: {"answers": ["...", "..."]}
    action: str | None = None
    instruction: str | None = None
    answers: list[str] | None = None


def _make_status_callback(job_id: str):
    """
    Persists status/state snapshots to the DB from the worker thread using a
    plain sync session, and republishes a lightweight progress event over the
    event bus for SSE subscribers.
    """
    def _callback(status: str, event: dict):
        db = get_sync_db()
        try:
            job = db.get(Job, job_id)
            if job is None:
                return
            job.status = status
            plan = event.get("plan")
            if plan is not None:
                job.plan_json = plan.model_dump() if hasattr(plan, "model_dump") else plan
            task_plan = event.get("task_plan")
            if task_plan is not None:
                job.task_plan_json = task_plan.model_dump() if hasattr(task_plan, "model_dump") else task_plan
            coder_state = event.get("coder_state")
            if coder_state is not None:
                cs = coder_state.model_dump() if hasattr(coder_state, "model_dump") else coder_state
                job.files_written = {k: True for k in cs.get("files_written", {})}  # don't duplicate full content in DB row
                job.files_failed = cs.get("failed_files", {})
            if status == "failed":
                job.error_message = event.get("error")
            db.commit()
        finally:
            db.close()

        event_bus.publish(job_id, {"type": "status", "status": status})

    return _callback


@router.post("", response_model=JobResponse, status_code=201)
async def create_job(
    payload: CreateJobRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    enforce_rate_limit(
        f"jobs:{user.id}", capacity=settings.RATE_LIMIT_JOBS_PER_HOUR, period_seconds=3600,
        error_message="Job creation rate limit exceeded. Generation is expensive -- please wait before starting another.",
    )

    job = Job(user_id=user.id, user_prompt=payload.prompt, mode=payload.mode, status="queued")
    db.add(job)
    await db.commit()
    await db.refresh(job)

    start_job(job.id, payload.prompt, payload.mode, _make_status_callback(job.id))
    logger.info("Started job %s for user %s", job.id, user.id)

    return JobResponse(id=job.id, status=job.status, user_prompt=job.user_prompt)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == job_id, Job.user_id == user.id))
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError("Job not found")

    return JobResponse(
        id=job.id, status=job.status, user_prompt=job.user_prompt,
        plan=job.plan_json, task_plan=job.task_plan_json,
        files_written=job.files_written, files_failed=job.files_failed,
        download_path=job.download_path, error_message=job.error_message,
    )


@router.get("")
async def list_jobs(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.user_id == user.id).order_by(Job.created_at.desc()))
    jobs = result.scalars().all()
    return [JobResponse(id=j.id, status=j.status, user_prompt=j.user_prompt) for j in jobs]


@router.get("/{job_id}/files/{file_path:path}")
async def get_job_file(
    job_id: str, file_path: str,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Returns the current content of one generated file, for the code viewer."""
    from pathlib import Path
    settings = get_settings()

    result = await db.execute(select(Job).where(Job.id == job_id, Job.user_id == user.id))
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError("Job not found")

    project_root = Path(settings.OUTPUT_DIR) / job_id
    target = (project_root / file_path).resolve()
    # Never allow escaping the job's own directory, regardless of what the
    # client sends -- same jail rule enforced by the Coder Agent's tools.
    if project_root.resolve() not in target.parents:
        raise ValidationFailedError("Invalid file path.")
    if not target.exists() or not target.is_file():
        raise NotFoundError("File not found (it may not be generated yet).")

    return {"path": file_path, "content": target.read_text(encoding="utf-8", errors="replace")}


@router.post("/{job_id}/respond")
async def respond_to_job(
    job_id: str, payload: RespondRequest,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.id == job_id, Job.user_id == user.id))
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError("Job not found")
    if job.status != "awaiting_input" and not job.status.startswith("awaiting_"):
        raise ValidationFailedError(f"Job is not waiting for input (status: {job.status})")

    resume_payload = payload.answers if payload.answers is not None else payload.model_dump(exclude_none=True)
    delivered = resume_job(job_id, resume_payload)
    if not delivered:
        raise ValidationFailedError("Job is not currently paused for input.")
    return {"ok": True}


@router.get("/{job_id}/stream")
async def stream_job(job_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Server-Sent Events stream of job progress. Frontend consumes with EventSource."""
    result = await db.execute(select(Job).where(Job.id == job_id, Job.user_id == user.id))
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError("Job not found")

    event_bus.bind_loop(asyncio.get_running_loop())
    queue = event_bus.subscribe(job_id)

    async def event_generator():
        try:
            yield f"event: status\ndata: {json.dumps({'status': job.status})}\n\n"
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {message}\n\n"
                    parsed = json.loads(message)
                    if parsed.get("type") in ("done", "error"):
                        break
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"  # SSE comment line prevents proxy timeouts
        finally:
            event_bus.unsubscribe(job_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # disable nginx buffering for real-time streaming
    })
