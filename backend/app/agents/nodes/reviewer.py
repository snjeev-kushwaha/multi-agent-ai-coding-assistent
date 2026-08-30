from pydantic import BaseModel

from app.agents.prompts.prompts import REVIEWER_SYSTEM
from app.agents.state import GraphState
from app.config import get_settings
from app.core.logging import get_logger
from app.llm.groq_client import get_groq_client
from app.sandbox.validators import validate_file

logger = get_logger(__name__)


class ReviewVerdict(BaseModel):
    verdict: str  # "PASS" | "FAIL"
    reason: str


def reviewer_node(state: GraphState) -> GraphState:
    settings = get_settings()
    coder_state = state["coder_state"]
    task_plan = state["task_plan"]
    idx = coder_state.current_step_idx
    task = task_plan.implementation_steps[idx]

    # If the coder already failed (e.g. exceeded tool-step budget), skip straight
    # to the retry/give-up decision -- no point reviewing content that doesn't exist.
    if task.filepath in coder_state.failed_files and task.filepath not in coder_state.files_written:
        return _advance_or_retry(state, passed=False)

    content = coder_state.files_written.get(task.filepath, "")
    static_ok, static_msg = validate_file(task.filepath, content)

    client = get_groq_client()
    review, tokens = client.structured_with_usage(
        model=settings.GROQ_MODEL_PLANNER,  # cheap model is fine for pass/fail judgment
        system_prompt=REVIEWER_SYSTEM,
        user_prompt=(
            f"File: {task.filepath}\nTask description: {task.task_description}\n\n"
            f"Static check result: {'PASS' if static_ok else 'FAIL'} -- {static_msg}\n\n"
            f"File content:\n{content[:6000]}"
        ),
        schema=ReviewVerdict,
    )
    tokens_used = state.get("groq_tokens_used", 0) + tokens

    passed = static_ok and review.verdict.upper() == "PASS"
    if not passed:
        logger.info("Review FAILED for %s: static=%s llm=%s (%s)",
                    task.filepath, static_ok, review.verdict, review.reason)
    reason = static_msg if not static_ok else review.reason
    return _advance_or_retry({**state, "groq_tokens_used": tokens_used}, passed=passed, reason=reason)



def _advance_or_retry(state: GraphState, passed: bool, reason: str = "") -> GraphState:
    settings = get_settings()
    coder_state = state["coder_state"].model_copy(deep=True)
    task_plan = state["task_plan"]
    idx = coder_state.current_step_idx
    task = task_plan.implementation_steps[idx]

    if passed:
        coder_state.failed_files.pop(task.filepath, None)
        coder_state.current_step_idx += 1
    else:
        retry_count = coder_state.failed_files.get(task.filepath, "")
        attempts_so_far = state.get("_retry_counts", {}).get(task.filepath, 0)
        retry_counts = dict(state.get("_retry_counts", {}))
        retry_counts[task.filepath] = attempts_so_far + 1

        if attempts_so_far + 1 > settings.MAX_RETRIES_PER_FILE:
            # Give up on this file, but keep going with the rest of the project --
            # partial success beats an all-or-nothing failure.
            coder_state.failed_files[task.filepath] = f"Gave up after {attempts_so_far + 1} attempts: {reason}"
            coder_state.current_step_idx += 1
            return {**state, "coder_state": coder_state, "_retry_counts": retry_counts, "status": "coding"}

        coder_state.failed_files[task.filepath] = reason
        return {**state, "coder_state": coder_state, "_retry_counts": retry_counts, "status": "coding"}

    is_last = coder_state.current_step_idx >= len(task_plan.implementation_steps)
    return {**state, "coder_state": coder_state, "status": "packaging" if is_last else "coding"}
