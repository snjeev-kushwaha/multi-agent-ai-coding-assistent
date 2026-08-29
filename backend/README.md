# AI Coding Assistant -- Backend

Multi-agent (Clarifier -> Planner -> Architect -> Coder -> Reviewer -> Packager)
project generator built on LangGraph + FastAPI + Groq.

## Quick start (local, SQLite)

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env -- at minimum set GROQ_API_KEY (free key: https://console.groq.com)

uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs
Health check: http://localhost:8000/health

## Quick start (Docker, Postgres)

```bash
export GROQ_API_KEY=your_key_here
export JWT_SECRET_KEY=$(openssl rand -hex 32)
docker compose up --build
```

## Architecture

See `app/agents/graph.py` for the full pipeline wiring. Short version:

```
Clarifier -> Planner -> [Plan Confirm] -> Architect -> [Architecture Confirm]
  -> Coder (loops per file, tool-calling ReAct agent)
  -> Reviewer (static check + LLM verdict, retries failed files)
  -> Packager -> done
```

The two `[... Confirm]` steps pause the graph via LangGraph's `interrupt()`
and wait for a human response delivered through `POST /jobs/{id}/respond` --
this is what lets the frontend show "review the plan" / "review the file
list" screens before any code gets written.

## Key things to know before deploying this for real

- **Rate limiting is in-memory** (`app/core/rate_limit.py`). Fine for one
  process; swap for Redis before running multiple API replicas.
- **The job worker runs in a background thread**, not a real task queue
  (`app/workers/job_worker.py`). Fine for low concurrency / a demo; swap for
  Celery/RQ/Arq consuming from Redis before scaling this for real traffic --
  the graph-invocation logic itself doesn't need to change, just how it's
  scheduled.
- **The `run_cmd` tool executes real shell commands** on the host running the
  worker, gated only by the pattern blocklist in `app/agents/tools.py`. This
  is NOT sufficient isolation for untrusted, multi-tenant traffic on its own
  -- before exposing this publicly, route command execution through the
  sandbox layer described in the architecture doc (§5.2): ephemeral,
  network-isolated containers (Docker `--network=none`, or Firecracker/gVisor
  for stronger isolation), not direct `subprocess.run` on the host.
- **SQLite is the default DB** for zero-setup local dev. Switch
  `DATABASE_URL` to Postgres (already supported, see `.env.example`) before
  running more than one process against the same data.
- Verify current Groq model names and rate limits before deploying --
  https://console.groq.com/docs/models and
  https://console.groq.com/docs/rate-limits -- these change over time and
  the defaults in `app/config.py` may go stale.

## Tests

The pipeline was validated end-to-end with mocked LLM responses (auth flow,
plan/architecture confirmation pause+resume, tool-calling coder loop,
reviewer, packager, zip output). Add these as pytest fixtures under
`tests/integration/` following the pattern used during development --
mock `GroqClient.structured` and `GroqClient.chat`, then drive
`graph.stream()` / `Command(resume=...)` exactly as shown in this README's
git history / dev notes.
