"""
Runs one job's agent graph to completion (or to a pause point) in a
dedicated background thread, since the Groq SDK calls inside our nodes are
synchronous and would otherwise block the API's event loop.

PRODUCTION NOTE: this in-process thread-per-job model is fine for a single
API instance / low concurrency. For real scale, replace this module with a
Celery/RQ/Arq task that a separate worker process pool consumes from a
Redis-backed queue -- the graph invocation logic below (build initial state,
graph.stream(), handle interrupts, persist checkpoints) moves unchanged into
the task body; only the "how is this task scheduled" layer changes.
"""
import threading
from pathlib import Path
from queue import Queue as ThreadQueue
from typing import Optional

from langgraph.types import Command

from app.agents.graph import get_graph
from app.agents.state import CoderState, GraphState
from app.config import get_settings
from app.core.logging import get_logger, job_id_ctx
from app.workers.event_bus import event_bus

logger = get_logger(__name__)

# job_id -> Queue used to deliver a human's confirm/edit/cancel or clarification
# answer back into the paused graph. In a multi-process deployment this would
# be a Redis list/stream keyed by job_id instead of an in-memory Queue.
_resume_queues: dict[str, ThreadQueue] = {}
_active_threads: dict[str, threading.Thread] = {}


def resume_job(job_id: str, payload) -> bool:
    """Called by the API layer when the user responds to a confirmation/clarification."""
    q = _resume_queues.get(job_id)
    if q is None:
        return False
    q.put(payload)
    return True


def _run(job_id: str, user_prompt: str, mode: str, project_root: str,
          on_status_change) -> None:
    job_id_ctx.set(job_id)
    settings = get_settings()
    graph = get_graph()
    config = {"configurable": {"thread_id": job_id}, "recursion_limit": 100}

    initial_state: GraphState = {
        "job_id": job_id,
        "user_prompt": user_prompt,
        "mode": mode,
        "project_root": project_root,
        "plan": None,
        "plan_feedback": None,
        "task_plan": None,
        "architecture_feedback": None,
        "coder_state": CoderState(),
        "status": "clarifying",
        "errors": [],
        "retry_budget": 10,
    }

    resume_queue: ThreadQueue = ThreadQueue()
    _resume_queues[job_id] = resume_queue

    graph_input = initial_state
    try:
        while True:
            interrupted = False
            for event in graph.stream(graph_input, config=config, stream_mode="values"):
                status = event.get("status")
                if status:
                    on_status_change(status, event)

            # Check whether the graph paused on an interrupt() call.
            snapshot = graph.get_state(config)
            if snapshot.next:  # non-empty = graph has pending nodes = paused
                pending_interrupts = snapshot.tasks
                interrupt_payload = None
                for task in pending_interrupts:
                    if task.interrupts:
                        interrupt_payload = task.interrupts[0].value
                        break
                if interrupt_payload is not None:
                    event_bus.publish(job_id, {"type": "interrupt", "payload": interrupt_payload})
                    on_status_change("awaiting_input", {"interrupt": interrupt_payload})
                    human_response = resume_queue.get()  # blocks this thread only
                    graph_input = Command(resume=human_response)
                    interrupted = True

            if not interrupted:
                break  # graph ran to completion (or hit an error) with no pending interrupt

        final_state = graph.get_state(config).values
        event_bus.publish(job_id, {"type": "done", "status": final_state.get("status")})

    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        event_bus.publish(job_id, {"type": "error", "message": str(exc)})
        on_status_change("failed", {"error": str(exc)})
    finally:
        _resume_queues.pop(job_id, None)
        _active_threads.pop(job_id, None)


def start_job(job_id: str, user_prompt: str, mode: str, on_status_change) -> None:
    settings = get_settings()
    project_root = str(Path(settings.OUTPUT_DIR) / job_id)
    thread = threading.Thread(
        target=_run, args=(job_id, user_prompt, mode, project_root, on_status_change),
        daemon=True, name=f"job-{job_id}",
    )
    _active_threads[job_id] = thread
    thread.start()
