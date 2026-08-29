from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.core.exceptions import NotFoundError, ValidationFailedError
from app.db.models import Job, User
from app.db.session import get_db

router = APIRouter(prefix="/jobs", tags=["downloads"])


@router.get("/{job_id}/download")
async def download_job(job_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    result = await db.execute(select(Job).where(Job.id == job_id, Job.user_id == user.id))
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError("Job not found")
    if job.status not in ("done",):
        raise ValidationFailedError(f"Job isn't finished yet (status: {job.status})")

    zip_path = Path(settings.OUTPUT_DIR) / f"{job_id}.zip"
    if not zip_path.exists():
        raise NotFoundError("Generated project archive not found (it may have expired).")

    filename = f"{job.plan_json.get('name', 'project') if job.plan_json else 'project'}.zip"
    return FileResponse(path=zip_path, filename=filename, media_type="application/zip")
