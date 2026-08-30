from langgraph.types import interrupt

from app.agents.prompts.prompts import PLANNER_REVISION_SYSTEM, PLANNER_SYSTEM
from app.agents.state import GraphState, Plan
from app.config import get_settings
from app.core.logging import get_logger
from app.llm.groq_client import get_groq_client

logger = get_logger(__name__)


def planner_node(state: GraphState) -> GraphState:
    settings = get_settings()
    client = get_groq_client()

    if state.get("plan") and state.get("plan_feedback"):
        system = PLANNER_REVISION_SYSTEM
        user = (
            f"Original request: {state['user_prompt']}\n\n"
            f"Previous plan: {state['plan'].model_dump_json(indent=2)}\n\n"
            f"User's requested changes: {state['plan_feedback']}"
        )
    else:
        system = PLANNER_SYSTEM
        user = f"User request: {state['user_prompt']}"

    plan, tokens = client.structured_with_usage(
        model=settings.GROQ_MODEL_PLANNER, system_prompt=system, user_prompt=user, schema=Plan,
    )
    tokens_used = state.get("groq_tokens_used", 0) + tokens
    return {
        **state,
        "plan": plan,
        "plan_feedback": None,
        "status": "awaiting_plan_confirmation",
        "groq_tokens_used": tokens_used,
    }



def plan_confirm_node(state: GraphState) -> GraphState:
    """
    Human-in-the-loop checkpoint. Pauses the graph; the frontend renders the
    plan and the user responds with one of: proceed / edit:<instruction> / cancel.
    """
    decision = interrupt({
        "type": "plan_confirmation",
        "plan": state["plan"].model_dump(),
    })

    action = decision.get("action") if isinstance(decision, dict) else decision
    if action == "cancel":
        return {**state, "status": "cancelled"}
    if action == "edit":
        return {**state, "plan_feedback": decision.get("instruction", ""), "status": "planning"}
    return {**state, "status": "architecting"}
