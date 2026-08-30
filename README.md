# Multi-Agent AI Coding Assistant 🚀

An autonomous, full-stack AI software engineer powered by **LangGraph**, **FastAPI**, **PostgreSQL**, **Groq LLM**, and a modern **React + Vite** frontend.

Transform high-level prompts into production-ready software with multi-agent orchestration, interactive human-in-the-loop approvals, live SSE telemetry, and an integrated enterprise **Admin Control Plane**.

---

## ⚡ Quick Start in 3 Steps

### Step 1: Clone & Configure Backend
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```
*Add your `GROQ_API_KEY` and PostgreSQL connection string in `.env`.*

Run database migrations & seed an admin user:
```bash
alembic upgrade head
python scripts/seed_admin.py --email admin@example.com --password AdminPassword123!
```

Start the backend API server:
```bash
uvicorn app.main:app --reload --port 8000
```
> API Swagger Docs will be live at: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Step 2: Launch Frontend
Open a new terminal:
```bash
cd frontend
npm install
npm run dev
```
> Web UI will be live at: [http://localhost:5173](http://localhost:5173)

---

### Step 3: Log In & Build
- Log in using your registered user account or the default admin account:
  - **Email**: `admin@example.com`
  - **Password**: `AdminPassword123!`
- Create a project or click **Admin Console** in the sidebar to open the administrative control plane.

---

## 🧠 Multi-Agent Architecture

```
                       User Prompt
                           │
                           ▼
                  ┌──────────────────┐
                  │ Clarifier Agent  │ ──> (Targeted Questions if ambiguous)
                  └──────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Planner Agent   │ ──> (Human Plan Approval / Changes)
                  └──────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ Architect Agent  │ ──> (Human Architecture Approval)
                  └──────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │   Coder Agent    │ ──> (Autonomous ReAct tool loop per file)
                  └──────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Reviewer Agent  │ ──> (Static lint checks + LLM verification)
                  └──────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Packager Node   │ ──> (UTF-8 Manifest & ZIP Packaging)
                  └──────────────────┘
                           │
                           ▼
                     [Download ZIP]
```

---

## ✨ Key Features Overview

### 🛠️ Developer Workspace
- **Autonomous Project Generation**: Full multi-file codebases generated with dependency planning.
- **Human-in-the-Loop Controls**: Review, modify, or reject architectures before code is generated.
- **Live SSE Event Streaming**: Real-time agent thought process, tool calls, and file-writing timeline.
- **CodeMirror File Explorer**: In-browser code preview with line numbers and syntax highlighting.
- **Project History Management**: Search projects with a triple-dot (`•••`) menu to **Rename** or **Delete** anytime.
- **Dynamic Theming**: Light/Dark mode plus **12 Color Palette Themes** (*Copper Slate*, *Ocean Blue*, *Veo Onyx*, *Barbie Pink*, etc.).

### 🛡️ Admin Control Plane (`/admin`)
- **System Overview & Metrics**: Live KPI counters for today's jobs, Groq tokens, success rate, and estimated API spend.
- **Interactive Timeseries Charts**: SVG Bezier curves and bar charts across 7d/14d/30d/90d historical windows.
- **User Management**: Search user accounts, monitor hourly token-bucket rate limits, reset buckets, and suspend/unsuspend users.
- **Job Oversight & Triage**: Filter jobs by status, user, and date range, inspect generated code files, and cancel running worker jobs.
- **Failure Diagnostics**: Failure rate analytics grouped across pipeline stages (*Planner*, *Architect*, *Coder*, *Reviewer*).
- **Immutable Audit Trail**: Automatic database logging of all admin actions with JSON metadata viewer.

---

## 🔒 Security & Reliability
- **PostgreSQL Native**: Robust schema with JSONB metadata, foreign key cascades, and Alembic migrations.
- **Admin Rate Limiting**: Dedicated token-bucket limiter (120 req/min) protecting all admin routes.
- **Directory Jail Isolation**: Secure path verification preventing path traversal (`../`) attacks.
- **Full Unicode Safety**: UTF-8 encoding support across file reading, writing, and packaging.

---

## 📂 Repository Structure

- [`backend/`](file:///D:/multi-agent-ai-coding-assistent/backend/README.md) — FastAPI backend, LangGraph state machine, PostgreSQL models, and admin routers.
- [`frontend/`](file:///D:/multi-agent-ai-coding-assistent/frontend/README.md) — React + Vite web application, CodeMirror explorer, and admin control suite.
- [`architecture.md`](file:///D:/multi-agent-ai-coding-assistent/architecture.md) — Deep architectural specification and system design details.
