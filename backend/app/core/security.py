"""
JWT-based auth: short-lived access tokens + longer-lived refresh tokens.
Passwords hashed with bcrypt directly (not via passlib -- passlib's bcrypt
backend-detection has known compatibility breaks against recent bcrypt
releases; calling the bcrypt package directly avoids that fragility).
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings
from app.core.exceptions import AuthError

_BCRYPT_MAX_BYTES = 72  # bcrypt's own input limit


def hash_password(password: str) -> str:
    truncated = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(truncated, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    truncated = plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    try:
        return bcrypt.checkpw(truncated, hashed.encode("utf-8"))
    except ValueError:
        return False


def _create_token(subject: str, expires_delta: timedelta, token_type: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    return _create_token(user_id, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), "access")


def create_refresh_token(user_id: str) -> str:
    settings = get_settings()
    return _create_token(user_id, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), "refresh")


def decode_token(token: str, expected_type: str = "access") -> str:
    """Returns the user_id (subject) if valid, raises AuthError otherwise."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AuthError("Token expired", code="token_expired")
    except jwt.InvalidTokenError:
        raise AuthError("Invalid token", code="token_invalid")

    if payload.get("type") != expected_type:
        raise AuthError("Wrong token type", code="token_invalid")
    return payload["sub"]
