# AI Coding Assistant — Backend

A robust, multi-agent autonomous software generator built with **FastAPI**, **LangGraph**, **PostgreSQL**, **Alembic**, and **Groq LLM**.

---

## Quick Start (Step-by-Step)

### 1. Prerequisites
- Python 3.11+
- PostgreSQL database running locally or via Docker

### 2. Environment Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env configuration
cp .env.example .env
```

Edit `.env` and configure:
```ini
GROQ_API_KEY=gsk_your_groq_api_key_here
DATABASE_URL=postgresql+asyncpg://coder_buddy:coder_buddy@localhost:5432/coder_buddy
JWT_SECRET_KEY=your_super_secret_jwt_key
```

### 3. Database Migrations
Run Alembic migrations to create tables and schemas in PostgreSQL:
```bash
alembic upgrade head
```

### 4. Seed an Admin User
Seed your initial admin account directly into the database (no HTTP route exposed):
```bash
python scripts/seed_admin.py --email admin@example.com --password AdminPassword123!
```

### 5. Start the Server
```bash
uvicorn app.main:app --reload --port 8000
```
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## System Architecture

```
User Prompt
    │
    ▼
[Clarifier Agent] ─── (Optional Human Clarification)
    │
    ▼
[Planner Agent] ──── (Human Plan Approval / Changes)
    │
    ▼
[Architect Agent] ── (Human Architecture Approval)
    │
    ▼
[Coder Agent] ────── (ReAct tool-calling loop per file)
    │
    ▼
[Reviewer Agent] ─── (Static analysis + LLM verification, auto-retries failed files)
    │
    ▼
[Packager] ───────── (UTF-8 Manifest & ZIP packaging)
    │
    ▼
Project Download Ready
```

---

## Features & Capabilities

### 1. Multi-Agent Pipeline (LangGraph)
- **Clarifier**: Asks targeted questions when project requirements are ambiguous.
- **Planner**: Generates structured project plan, tech stack, and core feature list.
- **Architect**: Breaks down architecture into modular implementation steps with dependencies.
- **Coder**: Autonomous ReAct agent utilizing file creation, file replacement, line editing, and testing tools.
- **Reviewer**: Inspects generated code for linting, syntax errors, and completeness.
- **Packager**: Assembles generated project files into a downloadable ZIP archive with a UTF-8 generation manifest.

### 2. Admin Control Plane (`/api/v1/admin/*`)
- **Admin Auth Guard**: Router-level `get_current_admin` dependency ensuring strict 403 Forbidden enforcement.
- **User Management**: Paginated user search, role filtering, suspension toggles (`/suspend`, `/unsuspend`), and token-bucket rate limit reset.
- **Job Oversight & Triage**: Multi-filtered job listings, full file tree inspection, and live worker thread cancellation (`/cancel`).
- **Failure Diagnostics**: Real-time failure aggregations categorized across pipeline stages (*Planner*, *Architect*, *Coder*, *Reviewer*).
- **Usage & Cost Analytics**: Aggregated Groq token counts, daily job volume timeseries, and estimated API spend.
- **Immutable Audit Trail**: Automatic database audit logging for all admin actions with JSON metadata inspection.

### 3. Production Security & Reliability
- **PostgreSQL Native Support**: JSONB storage, foreign key cascades, and Alembic versioning.
- **Admin Rate Limiting**: Dedicated 120 req/min token-bucket rate limiter per admin account.
- **Directory Jail Security**: Strict file containment verification preventing path traversal (`../`) attacks.
- **UTF-8 Unicode Safety**: Full Unicode encoding support handling non-breaking hyphens, em-dashes, and emojis across all file operations.

---

## Project Structure

```
backend/
├── alembic/              # Database migration versions
├── app/
│   ├── agents/           # LangGraph agent nodes, state, and tools
│   │   ├── nodes/        # Clarifier, Planner, Architect, Coder, Reviewer, Packager
│   │   ├── graph.py      # LangGraph state machine workflow
│   │   ├── state.py      # Graph state schemas
│   │   └── tools.py      # Sandboxed file writing & editing tools
│   ├── api/              # REST API route handlers
│   │   ├── v1/
│   │   │   ├── admin/    # Admin user, job, metrics, and audit routers
│   │   │   ├── auth.py   # JWT registration & login
│   │   │   ├── jobs.py   # Job creation, streaming, file access, rename
│   │   │   └── router.py # API v1 routing hub
│   │   └── deps.py       # Auth and Admin dependencies
│   ├── core/             # Rate limiting, security, exceptions, logging
│   ├── db/               # SQLAlchemy models and PostgreSQL session
│   ├── llm/              # Groq API client with token tracking
│   ├── workers/          # Background job worker and SSE event bus
│   ├── config.py         # Application settings
│   └── main.py           # FastAPI entrypoint
├── scripts/
│   └── seed_admin.py     # CLI admin user seeding utility
├── requirements.txt      # Python dependencies
└── alembic.ini           # Alembic database configuration
```
