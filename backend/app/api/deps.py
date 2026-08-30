from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import AuthError, ForbiddenError, NotFoundError
from app.core.rate_limit import enforce_rate_limit
from app.core.security import decode_token
from app.db.models import User
from app.db.session import get_db


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("Missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1]
    user_id = decode_token(token, expected_type="access")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("User not found")
    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_admin:
        raise AuthError("Admin privileges required", code="forbidden", status_code=403)

    settings = get_settings()
    enforce_rate_limit(
        f"admin:{current_user.id}",
        capacity=settings.RATE_LIMIT_ADMIN_PER_MINUTE,
        period_seconds=60.0,
        error_message="Admin API rate limit exceeded. Please slow down.",
    )
    return current_user


# Alias for backward/naming flexibility
get_current_admin_user = get_current_admin



