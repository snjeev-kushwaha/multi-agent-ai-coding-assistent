"""
Admin metrics and cost/usage dashboard endpoints.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import Date, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.models import Job, User
from app.db.session import get_db

router = APIRouter(prefix="/metrics", tags=["admin-metrics"])



class MetricsOverviewResponse(BaseModel):
    jobs_today: int
    jobs_this_week: int
    jobs_total: int
    tokens_today: int
    tokens_this_week: int
    tokens_total: int
    avg_tokens_per_job: float
    success_rate_percent: float
    total_completed_jobs: int
    total_failed_jobs: int
    total_cancelled_jobs: int
    total_active_jobs: int
    total_users: int
    active_users_this_week: int


class TimeseriesPoint(BaseModel):
    date: str  # YYYY-MM-DD
    job_count: int
    token_count: int
    success_count: int
    failure_count: int


class MetricsTimeseriesResponse(BaseModel):
    days: int
    data: list[TimeseriesPoint]
    total_jobs_in_range: int
    total_tokens_in_range: int


@router.get("/overview", response_model=MetricsOverviewResponse)
async def get_metrics_overview(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Overview of job throughput, Groq token consumption (today/this week/all-time),
    average tokens per job, success rates, and user counts in single aggregated PostgreSQL queries.
    """
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    week_start = today_start - timedelta(days=7)

    job_stmt = select(
        func.count(Job.id).label("jobs_total"),
        func.coalesce(func.sum(Job.groq_tokens_used), 0).label("tokens_total"),
        func.count(case((Job.created_at >= today_start, Job.id), else_=None)).label("jobs_today"),
        func.coalesce(func.sum(case((Job.created_at >= today_start, Job.groq_tokens_used), else_=0)), 0).label("tokens_today"),
        func.count(case((Job.created_at >= week_start, Job.id), else_=None)).label("jobs_this_week"),
        func.coalesce(func.sum(case((Job.created_at >= week_start, Job.groq_tokens_used), else_=0)), 0).label("tokens_this_week"),
        func.count(case((Job.status == "done", Job.id), else_=None)).label("jobs_done"),
        func.count(case((Job.status == "failed", Job.id), else_=None)).label("jobs_failed"),
        func.count(case((Job.status == "cancelled", Job.id), else_=None)).label("jobs_cancelled"),
        func.count(case((Job.status.not_in(["done", "failed", "cancelled"]), Job.id), else_=None)).label("jobs_active"),
    )
    job_metrics = (await db.execute(job_stmt)).first()

    # User metrics
    user_stmt = select(
        func.count(User.id).label("total_users"),
        func.count(func.distinct(case((Job.created_at >= week_start, Job.user_id), else_=None))).label("active_users_this_week"),
    ).select_from(User).outerjoin(Job, Job.user_id == User.id)
    user_metrics = (await db.execute(user_stmt)).first()

    jobs_total = job_metrics.jobs_total or 0
    tokens_total = int(job_metrics.tokens_total or 0)
    jobs_today = job_metrics.jobs_today or 0
    tokens_today = int(job_metrics.tokens_today or 0)
    jobs_this_week = job_metrics.jobs_this_week or 0
    tokens_this_week = int(job_metrics.tokens_this_week or 0)
    jobs_done = job_metrics.jobs_done or 0
    jobs_failed = job_metrics.jobs_failed or 0
    jobs_cancelled = job_metrics.jobs_cancelled or 0
    jobs_active = job_metrics.jobs_active or 0

    total_users = user_metrics.total_users or 0
    active_users_this_week = user_metrics.active_users_this_week or 0

    avg_tokens = round((tokens_total / jobs_total), 1) if jobs_total > 0 else 0.0
    terminal_jobs = jobs_done + jobs_failed
    success_rate = round((jobs_done / terminal_jobs * 100), 1) if terminal_jobs > 0 else (100.0 if jobs_done > 0 else 0.0)

    return MetricsOverviewResponse(
        jobs_today=jobs_today,
        jobs_this_week=jobs_this_week,
        jobs_total=jobs_total,
        tokens_today=tokens_today,
        tokens_this_week=tokens_this_week,
        tokens_total=tokens_total,
        avg_tokens_per_job=avg_tokens,
        success_rate_percent=success_rate,
        total_completed_jobs=jobs_done,
        total_failed_jobs=jobs_failed,
        total_cancelled_jobs=jobs_cancelled,
        total_active_jobs=jobs_active,
        total_users=total_users,
        active_users_this_week=active_users_this_week,
    )


@router.get("/timeseries", response_model=MetricsTimeseriesResponse)
async def get_metrics_timeseries(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Daily job count and token consumption for the last N days with continuous date series.
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    cutoff_date = today - timedelta(days=days - 1)
    cutoff_datetime = datetime(cutoff_date.year, cutoff_date.month, cutoff_date.day, tzinfo=timezone.utc)

    stmt = (
        select(
            cast(Job.created_at, Date).label("day"),
            func.count(Job.id).label("job_count"),
            func.coalesce(func.sum(Job.groq_tokens_used), 0).label("token_count"),
            func.count(case((Job.status == "done", Job.id), else_=None)).label("success_count"),
            func.count(case((Job.status == "failed", Job.id), else_=None)).label("failure_count"),
        )
        .where(Job.created_at >= cutoff_datetime)
        .group_by(cast(Job.created_at, Date))
        .order_by(cast(Job.created_at, Date).asc())
    )
    rows = (await db.execute(stmt)).all()

    # Map existing DB rows by date string (YYYY-MM-DD)
    db_points: dict[str, dict] = {}
    for r in rows:
        day_val = r.day
        if isinstance(day_val, (datetime, date)):
            day_str = day_val.strftime("%Y-%m-%d")
        else:
            day_str = str(day_val)[:10]
        db_points[day_str] = {
            "job_count": r.job_count or 0,
            "token_count": int(r.token_count or 0),
            "success_count": r.success_count or 0,
            "failure_count": r.failure_count or 0,
        }


    # Generate continuous sequence of dates
    time_series_data: list[TimeseriesPoint] = []
    total_jobs_in_range = 0
    total_tokens_in_range = 0

    curr = cutoff_date
    while curr <= today:
        date_str = curr.strftime("%Y-%m-%d")
        pt = db_points.get(date_str, {
            "job_count": 0,
            "token_count": 0,
            "success_count": 0,
            "failure_count": 0,
        })
        total_jobs_in_range += pt["job_count"]
        total_tokens_in_range += pt["token_count"]

        time_series_data.append(
            TimeseriesPoint(
                date=date_str,
                job_count=pt["job_count"],
                token_count=pt["token_count"],
                success_count=pt["success_count"],
                failure_count=pt["failure_count"],
            )
        )
        curr += timedelta(days=1)

    return MetricsTimeseriesResponse(
        days=days,
        data=time_series_data,
        total_jobs_in_range=total_jobs_in_range,
        total_tokens_in_range=total_tokens_in_range,
    )
