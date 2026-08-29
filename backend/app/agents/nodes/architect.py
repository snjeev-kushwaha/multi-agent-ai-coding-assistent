from langgraph.types import interrupt

from app.agents.prompts.prompts import ARCHITECT_REVISION_SYSTEM, ARCHITECT_SYSTEM
from app.agents.state import CoderState, GraphState, TaskPlan
from app.config import get_settings
from app.core.exceptions import ValidationFailedError
from app.core.logging import get_logger
from app.llm.groq_client import get_groq_client

logger = get_logger(__name__)


def architect_node(state: GraphState) -> GraphState:
    settings = get_settings()
    client = get_groq_client()

    if state.get("task_plan") and state.get("architecture_feedback"):
        system = ARCHITECT_REVISION_SYSTEM
        user = (
            f"Plan: {state['plan'].model_dump_json(indent=2)}\n\n"
            f"Previous task breakdown: {state['task_plan'].model_dump_json(indent=2)}\n\n"
            f"User's requested changes: {state['architecture_feedback']}"
        )
    else:
        system = ARCHITECT_SYSTEM
        user = f"Approved plan: {state['plan'].model_dump_json(indent=2)}"

    task_plan = client.structured(
        model=settings.GROQ_MODEL_ARCHITECT, system_prompt=system, user_prompt=user, schema=TaskPlan,
    )

    try:
        task_plan.validate_one_task_per_file()
    except ValueError as exc:
        # One retry with the violation fed back, then fail loudly rather than
        # silently proceeding with a broken task plan.
        logger.warning("Architect violated one-task-per-file rule, retrying: %s", exc)
        task_plan = client.structured(
            model=settings.GROQ_MODEL_ARCHITECT,
            system_prompt=system,
            user_prompt=user + f"\n\nYour previous attempt violated a hard constraint: {exc}. Fix this.",
            schema=TaskPlan,
        )
        task_plan.validate_one_task_per_file()  # let it raise -> caught by graph error handling

    settings_max = settings.MAX_FILES_PER_PROJECT
    if len(task_plan.implementation_steps) > settings_max:
        raise ValidationFailedError(
            f"Architect produced {len(task_plan.implementation_steps)} files, "
            f"exceeding the {settings_max}-file project limit."
        )

    return {
        **state,
        "task_plan": task_plan,
        "architecture_feedback": None,
        "coder_state": CoderState(),
        "status": "awaiting_architecture_confirmation",
    }


def architecture_confirm_node(state: GraphState) -> GraphState:
    decision = interrupt({
        "type": "architecture_confirmation",
        "task_plan": state["task_plan"].model_dump(),
    })

    action = decision.get("action") if isinstance(decision, dict) else decision
    if action == "cancel":
        return {**state, "status": "cancelled"}
    if action == "edit":
        return {**state, "architecture_feedback": decision.get("instruction", ""), "status": "architecting"}
    return {**state, "status": "coding"}
