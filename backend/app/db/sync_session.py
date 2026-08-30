"""
The job worker runs in a plain background thread (see app/workers/job_worker.py),
not on the asyncio event loop, so it needs a synchronous DB session rather than
reusing the async engine from session.py.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


def _to_sync_url(async_url: str) -> str:
    url = async_url
    if url.startswith("sqlite+aiosqlite"):
        return url.replace("sqlite+aiosqlite", "sqlite", 1)
    if url.startswith("postgresql+asyncpg"):
        return url.replace("postgresql+asyncpg", "postgresql+psycopg2", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


settings = get_settings()
_sync_engine = create_engine(
    _to_sync_url(settings.DATABASE_URL),
    pool_pre_ping=True,
    pool_recycle=300,
)
SyncSessionLocal = sessionmaker(bind=_sync_engine, expire_on_commit=False)


def get_sync_db() -> Session:
    return SyncSessionLocal()
