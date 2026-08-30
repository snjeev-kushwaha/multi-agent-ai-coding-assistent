"""
Admin user management endpoints.
"""
from datetime import datetime
import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.api.v1.admin.audit import record_audit_log
from app.config import get_settings
from app.core.exceptions import NotFoundError, ValidationFailedError
from app.core.rate_limit import get_user_rate_limit_state, reset_user_rate_limit
from app.db.models import Job, User
from app.db.session import get_db

router = APIRouter(prefix="/users", tags=["admin-users"])


class AdminUserItem(BaseModel):
    id: str
    email: str
    is_admin: bool
    is_suspended: bool
    created_at: datetime
    job_count: int
    last_active_at: Optional[datetime] = None


class AdminUserListResponse(BaseModel):
    users: list[AdminUserItem]
    total: int
    page: int
    limit: int
    total_pages: int


class AdminUserJobItem(BaseModel):
    id: str
    user_prompt: str
    status: str
    mode: str
    groq_tokens_used: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class RateLimitBucketState(BaseModel):
    key: str
    tokens_remaining: float
    capacity: int
    period_seconds: float


class AdminUserDetailResponse(BaseModel):
    id: str
    email: str
    is_admin: bool
    is_suspended: bool
    created_at: datetime
    job_count: int
    rate_limit_state: RateLimitBucketState
    jobs: list[AdminUserJobItem]


class ActionResponse(BaseModel):
    ok: bool
    message: str
    user_id: str
    is_suspended: Optional[bool] = None
    rate_limit_state: Optional[RateLimitBucketState] = None


@router.get("", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    is_suspended: Optional[bool] = Query(default=None),
    is_admin: Optional[bool] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Paginated user list with email search, status filters, job counts,
    and last activity timestamps in a single aggregated PostgreSQL query (no N+1).
    """
    stmt = (
        select(
            User.id,
            User.email,
            User.is_admin,
            User.is_suspended,
            User.created_at,
            func.count(Job.id).label("job_count"),
            func.max(func.coalesce(Job.updated_at, Job.created_at)).label("last_active_at"),
        )
        .outerjoin(Job, Job.user_id == User.id)
        .group_by(User.id, User.email, User.is_admin, User.is_suspended, User.created_at)
    )

    count_stmt = select(func.count(User.id))

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(User.email.ilike(term))
        count_stmt = count_stmt.where(User.email.ilike(term))

    if is_suspended is not None:
        stmt = stmt.where(User.is_suspended == is_suspended)
        count_stmt = count_stmt.where(User.is_suspended == is_suspended)

    if is_admin is not None:
        stmt = stmt.where(User.is_admin == is_admin)
        count_stmt = count_stmt.where(User.is_admin == is_admin)

    total_users = (await db.execute(count_stmt)).scalar() or 0
    total_pages = math.ceil(total_users / limit) if total_users > 0 else 1

    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    results = (await db.execute(stmt)).all()

    items = [
        AdminUserItem(
            id=row.id,
            email=row.email,
            is_admin=row.is_admin,
            is_suspended=row.is_suspended,
            created_at=row.created_at,
            job_count=row.job_count,
            last_active_at=row.last_active_at,
        )
        for row in results
    ]

    return AdminUserListResponse(
        users=items,
        total=total_users,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.get("/{user_id}", response_model=AdminUserDetailResponse)
async def get_user_detail(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Full user profile, recent job execution history, and current rate-limit bucket state.
    """
    settings = get_settings()

    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with ID '{user_id}' not found")

    jobs_res = await db.execute(
        select(Job).where(Job.user_id == user_id).order_by(Job.created_at.desc()).limit(50)
    )
    jobs = jobs_res.scalars().all()

    bucket_state = get_user_rate_limit_state(
        user_id=user.id,
        capacity=settings.RATE_LIMIT_JOBS_PER_HOUR,
        period_seconds=3600.0,
    )

    job_items = [
        AdminUserJobItem(
            id=j.id,
            user_prompt=j.user_prompt,
            status=j.status,
            mode=j.mode,
            groq_tokens_used=j.groq_tokens_used,
            error_message=j.error_message,
            created_at=j.created_at,
            updated_at=j.updated_at,
        )
        for j in jobs
    ]

    return AdminUserDetailResponse(
        id=user.id,
        email=user.email,
        is_admin=user.is_admin,
        is_suspended=user.is_suspended,
        created_at=user.created_at,
        job_count=len(jobs),
        rate_limit_state=RateLimitBucketState(**bucket_state),
        jobs=job_items,
    )


@router.post("/{user_id}/suspend", response_model=ActionResponse)
async def suspend_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Suspends a user account and writes an audit log entry."""
    if user_id == admin.id:
        raise ValidationFailedError("Cannot suspend your own admin account.")

    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with ID '{user_id}' not found")

    user.is_suspended = True

    await record_audit_log(
        db=db,
        admin_user_id=admin.id,
        action="suspend_user",
        target_type="user",
        target_id=user.id,
        metadata={"admin_email": admin.email, "target_email": user.email},
    )

    await db.commit()
    await db.refresh(user)

    return ActionResponse(
        ok=True,
        message=f"User '{user.email}' has been suspended.",
        user_id=user.id,
        is_suspended=user.is_suspended,
    )


@router.post("/{user_id}/unsuspend", response_model=ActionResponse)
async def unsuspend_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Unsuspends a user account and writes an audit log entry."""
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with ID '{user_id}' not found")

    user.is_suspended = False

    await record_audit_log(
        db=db,
        admin_user_id=admin.id,
        action="unsuspend_user",
        target_type="user",
        target_id=user.id,
        metadata={"admin_email": admin.email, "target_email": user.email},
    )

    await db.commit()
    await db.refresh(user)

    return ActionResponse(
        ok=True,
        message=f"User '{user.email}' has been unsuspended.",
        user_id=user.id,
        is_suspended=user.is_suspended,
    )


@router.post("/{user_id}/reset-rate-limit", response_model=ActionResponse)
async def reset_rate_limit(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Resets the rate limit bucket for a user and writes an audit log entry."""
    settings = get_settings()

    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with ID '{user_id}' not found")

    reset_user_rate_limit(user.id)
    new_state = get_user_rate_limit_state(
        user_id=user.id,
        capacity=settings.RATE_LIMIT_JOBS_PER_HOUR,
        period_seconds=3600.0,
    )

    await record_audit_log(
        db=db,
        admin_user_id=admin.id,
        action="reset_rate_limit",
        target_type="user",
        target_id=user.id,
        metadata={"admin_email": admin.email, "target_email": user.email, "new_capacity": settings.RATE_LIMIT_JOBS_PER_HOUR},
    )

    await db.commit()

    return ActionResponse(
        ok=True,
        message=f"Rate limit for user '{user.email}' has been reset.",
        user_id=user.id,
        rate_limit_state=RateLimitBucketState(**new_state),
    )
