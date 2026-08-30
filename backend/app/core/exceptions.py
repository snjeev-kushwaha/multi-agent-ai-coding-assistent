"""
Custom exception hierarchy. Every exception maps to a specific HTTP status
and a machine-readable error code, so the frontend can branch on `code`
instead of parsing human-readable messages.
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse

# Some Starlette versions deprecated HTTP_422_UNPROCESSABLE_ENTITY in favor of
# HTTP_422_UNPROCESSABLE_CONTENT; fall back gracefully across versions.
_HTTP_422 = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", None) or status.HTTP_422_UNPROCESSABLE_ENTITY


class AppError(Exception):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "internal_error"

    def __init__(self, message: str, code: str | None = None, status_code: int | None = None):
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ValidationFailedError(AppError):
    status_code = _HTTP_422
    code = "validation_failed"


class AuthError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "auth_error"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class RateLimitError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"


class LLMProviderError(AppError):
    """Groq API failed after all retries."""
    status_code = status.HTTP_502_BAD_GATEWAY
    code = "llm_provider_error"


class SandboxError(AppError):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "sandbox_error"


class JobFailedError(AppError):
    status_code = _HTTP_422
    code = "job_failed"


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Never leak stack traces / internals to the client.
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "Something went wrong. Please try again."}},
    )
