"""
The job worker runs in a plain background thread (see app/workers/job_worker.py),
not on the asyncio event loop, so it needs a synchronous DB session rather than
reusing the async engine from session.py.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


def _to_sync_url(async_url: str) -> str:
    return (
        async_url
        .replace("sqlite+aiosqlite", "sqlite")
        .replace("postgresql+asyncpg", "postgresql+psycopg2")
    )


settings = get_settings()
_sync_engine = create_engine(_to_sync_url(settings.DATABASE_URL))
SyncSessionLocal = sessionmaker(bind=_sync_engine, expire_on_commit=False)


def get_sync_db() -> Session:
    return SyncSessionLocal()
