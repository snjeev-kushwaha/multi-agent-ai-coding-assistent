"""
Admin job oversight endpoints.
"""
from datetime import datetime, timedelta, timezone
import math
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.api.v1.admin.audit import record_audit_log
from app.config import get_settings
from app.core.exceptions import NotFoundError, ValidationFailedError
from app.db.models import Job, User
from app.db.session import get_db
from app.workers.event_bus import event_bus
from app.workers.job_worker import cancel_job

router = APIRouter(prefix="/jobs", tags=["admin-jobs"])


class AdminJobListItem(BaseModel):
    id: str
    user_id: str
    user_email: str
    user_prompt: str
    status: str
    mode: str
    groq_tokens_used: int
    download_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AdminJobListResponse(BaseModel):
    jobs: list[AdminJobListItem]
    total: int
    page: int
    limit: int
    total_pages: int


class AdminJobDetailResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    user_prompt: str
    status: str
    mode: str
    groq_tokens_used: int
    plan: Optional[dict] = None
    task_plan: Optional[dict] = None
    files_written: Optional[dict] = None
    files_failed: Optional[dict] = None
    download_path: Optional[str] = None
    error_message: Optional[str] = None
    files: dict[str, str] = {}  # generated file path -> content
    created_at: datetime
    updated_at: datetime


class StageFailureCount(BaseModel):
    stage: str
    count: int
    percentage: float


class RecentFailureItem(BaseModel):
    job_id: str
    user_id: str
    user_email: str
    stage: str
    error_message: Optional[str] = None
    created_at: datetime


class FailureSummaryResponse(BaseModel):
    days: int
    total_jobs: int
    total_failures: int
    failure_rate_percent: float
    stages: list[StageFailureCount]
    recent_failures: list[RecentFailureItem]


class JobCancelResponse(BaseModel):
    ok: bool
    message: str
    job_id: str
    status: str


def _classify_failure_stage(job: Job) -> str:
    """Classifies which agent node or pipeline stage a failed job failed in."""
    err = (job.error_message or "").lower()
    if "planner" in err or job.status in ("clarifying", "awaiting_clarification", "planning", "awaiting_plan_confirmation"):
        return "Planner"
    if "architect" in err or job.status in ("architecting", "awaiting_architecture_confirmation"):
        return "Architect"
    if "review" in err or job.status == "reviewing":
        return "Reviewer"
    if "coder" in err or job.status == "coding":
        return "Coder"

    # Fallback to state inspection
    if job.plan_json is None:
        return "Planner"
    if job.task_plan_json is None:
        return "Architect"
    if job.files_failed and len(job.files_failed) > 0:
        return "Reviewer" if "review" in err else "Coder"

    return "Other"


@router.get("", response_model=AdminJobListResponse)
async def list_jobs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    failed_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Paginated admin jobs list filterable by status, user_id, date range,
    and failed_only flag in a single PostgreSQL query.
    """
    stmt = (
        select(Job, User.email.label("user_email"))
        .join(User, User.id == Job.user_id)
    )
    count_stmt = select(func.count(Job.id)).join(User, User.id == Job.user_id)

    if status and status.strip():
        stmt = stmt.where(Job.status == status.strip())
        count_stmt = count_stmt.where(Job.status == status.strip())

    if user_id and user_id.strip():
        stmt = stmt.where(Job.user_id == user_id.strip())
        count_stmt = count_stmt.where(Job.user_id == user_id.strip())

    if date_from:
        stmt = stmt.where(Job.created_at >= date_from)
        count_stmt = count_stmt.where(Job.created_at >= date_from)

    if date_to:
        stmt = stmt.where(Job.created_at <= date_to)
        count_stmt = count_stmt.where(Job.created_at <= date_to)

    if failed_only:
        failed_filter = Job.status.in_(["failed", "cancelled"]) | Job.error_message.is_not(None)
        stmt = stmt.where(failed_filter)
        count_stmt = count_stmt.where(failed_filter)

    total_jobs = (await db.execute(count_stmt)).scalar() or 0
    total_pages = math.ceil(total_jobs / limit) if total_jobs > 0 else 1

    stmt = stmt.order_by(Job.created_at.desc()).offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(stmt)).all()

    items = [
        AdminJobListItem(
            id=job.id,
            user_id=job.user_id,
            user_email=user_email,
            user_prompt=job.user_prompt,
            status=job.status,
            mode=job.mode,
            groq_tokens_used=job.groq_tokens_used,
            download_path=job.download_path,
            error_message=job.error_message,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
        for job, user_email in rows
    ]

    return AdminJobListResponse(
        jobs=items,
        total=total_jobs,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.get("/failures/summary", response_model=FailureSummaryResponse)
async def get_failures_summary(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Summary of failure counts grouped by pipeline stage (Planner/Architect/Coder/Reviewer)
    for the last 7/30/N days.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    total_stmt = select(func.count(Job.id)).where(Job.created_at >= cutoff)
    total_jobs = (await db.execute(total_stmt)).scalar() or 0

    failed_stmt = (
        select(Job, User.email.label("user_email"))
        .join(User, User.id == Job.user_id)
        .where(
            Job.created_at >= cutoff,
            (Job.status == "failed") | (Job.error_message.is_not(None)),
        )
        .order_by(Job.created_at.desc())
    )
    failed_rows = (await db.execute(failed_stmt)).all()
    total_failures = len(failed_rows)

    stage_counts = {
        "Planner": 0,
        "Architect": 0,
        "Coder": 0,
        "Reviewer": 0,
        "Other": 0,
    }

    recent_failures: list[RecentFailureItem] = []

    for job, user_email in failed_rows:
        stage = _classify_failure_stage(job)
        stage_counts[stage] = stage_counts.get(stage, 0) + 1

        if len(recent_failures) < 20:
            recent_failures.append(
                RecentFailureItem(
                    job_id=job.id,
                    user_id=job.user_id,
                    user_email=user_email,
                    stage=stage,
                    error_message=job.error_message,
                    created_at=job.created_at,
                )
            )

    failure_rate = round((total_failures / total_jobs * 100), 2) if total_jobs > 0 else 0.0

    stages_list = [
        StageFailureCount(
            stage=stage,
            count=count,
            percentage=round((count / total_failures * 100), 1) if total_failures > 0 else 0.0,
        )
        for stage, count in stage_counts.items()
    ]

    return FailureSummaryResponse(
        days=days,
        total_jobs=total_jobs,
        total_failures=total_failures,
        failure_rate_percent=failure_rate,
        stages=stages_list,
        recent_failures=recent_failures,
    )


@router.get("/{job_id}", response_model=AdminJobDetailResponse)
async def get_job_detail(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Full job details including plan, task plan, file lists, error message,
    and generated file contents without user-ownership restrictions.
    """
    settings = get_settings()

    stmt = select(Job, User.email.label("user_email")).join(User, User.id == Job.user_id).where(Job.id == job_id)
    result = (await db.execute(stmt)).first()
    if result is None:
        raise NotFoundError(f"Job with ID '{job_id}' not found")

    job, user_email = result

    # Read generated files from disk
    files: dict[str, str] = {}
    project_root = (Path(settings.OUTPUT_DIR) / job_id).resolve()
    if project_root.exists() and project_root.is_dir():
        for file_path in sorted(project_root.rglob("*")):
            resolved_file = file_path.resolve()
            if resolved_file.is_file() and not resolved_file.name.endswith(".zip"):
                # Strict path containment jail verification
                if project_root in resolved_file.parents:
                    try:
                        rel = str(resolved_file.relative_to(project_root)).replace("\\", "/")
                        files[rel] = resolved_file.read_text(encoding="utf-8", errors="replace")
                    except Exception:
                        pass


    return AdminJobDetailResponse(
        id=job.id,
        user_id=job.user_id,
        user_email=user_email,
        user_prompt=job.user_prompt,
        status=job.status,
        mode=job.mode,
        groq_tokens_used=job.groq_tokens_used,
        plan=job.plan_json,
        task_plan=job.task_plan_json,
        files_written=job.files_written,
        files_failed=job.files_failed,
        download_path=job.download_path,
        error_message=job.error_message,
        files=files,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.post("/{job_id}/cancel", response_model=JobCancelResponse)
async def cancel_job_endpoint(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Cancels a running or paused job, updates the database, signals the worker thread,
    and writes an audit log entry.
    """
    stmt = select(Job).where(Job.id == job_id)
    job = (await db.execute(stmt)).scalar_one_or_none()
    if job is None:
        raise NotFoundError(f"Job with ID '{job_id}' not found")

    if job.status in ("done", "cancelled"):
        raise ValidationFailedError(f"Job is already in terminal state '{job.status}'")

    prev_status = job.status
    job.status = "cancelled"
    job.error_message = f"Job cancelled by administrator ({admin.email})"

    # Signal the job worker thread to terminate
    cancel_job(job.id)

    # Publish SSE cancellation event
    event_bus.publish(job_id, {"type": "status", "status": "cancelled"})

    # Record audit log
    await record_audit_log(
        db=db,
        admin_user_id=admin.id,
        action="cancel_job",
        target_type="job",
        target_id=job.id,
        metadata={"admin_email": admin.email, "previous_status": prev_status},
    )

    await db.commit()
    await db.refresh(job)

    return JobCancelResponse(
        ok=True,
        message=f"Job '{job.id}' has been cancelled.",
        job_id=job.id,
        status=job.status,
    )
