"""
Audit logging service and endpoints for admin actions.
"""
from datetime import datetime
import math
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.models import AdminAuditLog, User
from app.db.session import get_db

router = APIRouter(prefix="/audit-logs", tags=["admin-audit"])


class AdminAuditLogItem(BaseModel):
    id: str
    admin_user_id: str
    admin_email: str
    action: str
    target_type: str
    target_id: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime


class AdminAuditLogListResponse(BaseModel):
    logs: list[AdminAuditLogItem]
    total: int
    page: int
    limit: int
    total_pages: int


async def record_audit_log(
    db: AsyncSession,
    admin_user_id: str,
    action: str,
    target_type: str,
    target_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AdminAuditLog:
    """
    Creates an AdminAuditLog record in PostgreSQL.
    """
    log_entry = AdminAuditLog(
        admin_user_id=admin_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_json=metadata or {},
    )
    db.add(log_entry)
    return log_entry


@router.get("", response_model=AdminAuditLogListResponse)
async def list_audit_logs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    action: Optional[str] = Query(default=None),
    admin_user_id: Optional[str] = Query(default=None),
    target_type: Optional[str] = Query(default=None),
    target_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Paginated administrative audit logs queryable and filterable by action and target.
    """
    stmt = (
        select(AdminAuditLog, User.email.label("admin_email"))
        .join(User, User.id == AdminAuditLog.admin_user_id)
    )
    count_stmt = select(func.count(AdminAuditLog.id))

    if action and action.strip():
        stmt = stmt.where(AdminAuditLog.action == action.strip())
        count_stmt = count_stmt.where(AdminAuditLog.action == action.strip())

    if admin_user_id and admin_user_id.strip():
        stmt = stmt.where(AdminAuditLog.admin_user_id == admin_user_id.strip())
        count_stmt = count_stmt.where(AdminAuditLog.admin_user_id == admin_user_id.strip())

    if target_type and target_type.strip():
        stmt = stmt.where(AdminAuditLog.target_type == target_type.strip())
        count_stmt = count_stmt.where(AdminAuditLog.target_type == target_type.strip())

    if target_id and target_id.strip():
        stmt = stmt.where(AdminAuditLog.target_id == target_id.strip())
        count_stmt = count_stmt.where(AdminAuditLog.target_id == target_id.strip())

    total_logs = (await db.execute(count_stmt)).scalar() or 0
    total_pages = math.ceil(total_logs / limit) if total_logs > 0 else 1

    stmt = stmt.order_by(AdminAuditLog.created_at.desc()).offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(stmt)).all()

    items = [
        AdminAuditLogItem(
            id=log.id,
            admin_user_id=log.admin_user_id,
            admin_email=admin_email,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            metadata=log.metadata_json,
            created_at=log.created_at,
        )
        for log, admin_email in rows
    ]

    return AdminAuditLogListResponse(
        logs=items,
        total=total_logs,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )
