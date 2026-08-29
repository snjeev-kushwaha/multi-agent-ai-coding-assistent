"""
Centralized application configuration.
All values are overridable via environment variables / .env file.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- App ---
    APP_NAME: str = "AI Coding Assistant"
    ENV: str = "development"  # development | staging | production
    DEBUG: bool = True

    # --- Security ---
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- CORS ---
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # --- Database ---
    # Swap for a real Postgres DSN in production:
    # postgresql+asyncpg://user:pass@host:5432/dbname
    DATABASE_URL: str = "sqlite+aiosqlite:///./coder_buddy.db"

    # --- Groq LLM ---
    GROQ_API_KEY: str = ""
    GROQ_MODEL_PLANNER: str = "llama-3.1-8b-instant"      # cheap/fast, structured JSON tasks
    GROQ_MODEL_ARCHITECT: str = "llama-3.1-8b-instant"
    GROQ_MODEL_CODER: str = "llama-3.3-70b-versatile"      # quality matters most here
    GROQ_MAX_RETRIES: int = 3
    GROQ_TIMEOUT_SECONDS: int = 60
    # Verify current model names/limits at https://console.groq.com/docs/models
    # and https://console.groq.com/docs/rate-limits before relying on these.

    # --- Rate limiting ---
    RATE_LIMIT_JOBS_PER_HOUR: int = 10
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60

    # --- Job execution ---
    MAX_FILES_PER_PROJECT: int = 25
    MAX_RETRIES_PER_FILE: int = 2
    MAX_CODER_TOOL_STEPS: int = 12          # bound on tool-calling loop per file
    JOB_TIMEOUT_SECONDS: int = 900           # 15 min hard cap per job

    # --- Storage ---
    OUTPUT_DIR: str = "./generated_projects"  # swap for S3 in production
    ARTIFACT_EXPIRY_DAYS: int = 7

    # --- Sandbox execution ---
    SANDBOX_ENABLED: bool = True
    SANDBOX_CPU_LIMIT: str = "1"
    SANDBOX_MEMORY_LIMIT: str = "512m"
    SANDBOX_TIMEOUT_SECONDS: int = 30
    SANDBOX_NETWORK: str = "none"  # containers get no network access by default


@lru_cache
def get_settings() -> Settings:
    return Settings()
