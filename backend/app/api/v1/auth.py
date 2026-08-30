from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import AuthError, ValidationFailedError
from app.core.rate_limit import enforce_rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.models import Job, User
from app.db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class UserProfileResponse(BaseModel):
    id: str
    email: EmailStr
    is_admin: bool = False
    is_suspended: bool = False
    created_at: datetime
    total_projects: int

    class Config:
        from_attributes = True




class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    enforce_rate_limit(f"signup:{payload.email}", capacity=5, period_seconds=3600,
                        error_message="Too many signup attempts. Try again later.")

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise ValidationFailedError("An account with this email already exists.")

    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    enforce_rate_limit(f"login:{payload.email}", capacity=10, period_seconds=300,
                        error_message="Too many login attempts. Try again later.")

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise AuthError("Invalid email or password", code="invalid_credentials")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user_id = decode_token(payload.refresh_token, expected_type="refresh")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise AuthError("User no longer exists")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count_res = await db.execute(select(func.count(Job.id)).where(Job.user_id == current_user.id))
    total_projects = count_res.scalar_one() or 0
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        is_admin=current_user.is_admin,
        is_suspended=current_user.is_suspended,
        created_at=current_user.created_at,
        total_projects=total_projects,
    )


