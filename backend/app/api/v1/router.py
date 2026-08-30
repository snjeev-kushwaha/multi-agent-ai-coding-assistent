from fastapi import APIRouter

from app.api.v1 import auth, downloads, jobs
from app.api.v1.admin.router import admin_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(downloads.router)
api_router.include_router(admin_router)

