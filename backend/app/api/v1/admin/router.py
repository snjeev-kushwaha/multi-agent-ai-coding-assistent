"""
Admin router module.
Entirely gated by get_current_admin at the router level so that any route
registered on admin_router automatically requires admin privileges.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_admin
from app.api.v1.admin.audit import router as audit_router
from app.api.v1.admin.jobs import router as jobs_router
from app.api.v1.admin.metrics import router as metrics_router
from app.api.v1.admin.users import router as users_router
from app.db.models import User

admin_router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)

admin_router.include_router(users_router)
admin_router.include_router(jobs_router)
admin_router.include_router(metrics_router)
admin_router.include_router(audit_router)





class AdminStatusResponse(BaseModel):
    id: str
    email: str
    is_admin: bool
    status: str


@admin_router.get("/me", response_model=AdminStatusResponse)
async def get_admin_status(admin: User = Depends(get_current_admin)):
    """Identity and authorization check for admin access."""
    return AdminStatusResponse(
        id=admin.id,
        email=admin.email,
        is_admin=admin.is_admin,
        status="authorized",
    )

