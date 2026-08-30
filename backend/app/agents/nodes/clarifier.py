from langgraph.types import interrupt

from app.agents.prompts.prompts import CLARIFIER_SYSTEM
from app.agents.state import ClarificationRequest, GraphState
from app.config import get_settings
from app.core.logging import get_logger
from app.llm.groq_client import get_groq_client

logger = get_logger(__name__)


class ClarifierDecision(ClarificationRequest):
    needs_clarification: bool = False


def clarifier_node(state: GraphState) -> GraphState:
    settings = get_settings()
    client = get_groq_client()

    decision, tokens = client.structured_with_usage(
        model=settings.GROQ_MODEL_PLANNER,
        system_prompt=CLARIFIER_SYSTEM,
        user_prompt=f"User request: {state['user_prompt']}",
        schema=ClarifierDecision,
    )
    tokens_used = state.get("groq_tokens_used", 0) + tokens

    if not decision.needs_clarification or not decision.questions:
        return {**state, "needs_clarification": False, "status": "planning", "groq_tokens_used": tokens_used}

    # Pause the graph here and surface the questions to the frontend via SSE;
    # resumes when the API layer calls graph.invoke(Command(resume=answers)).
    answers = interrupt({
        "type": "clarification_request",
        "questions": decision.questions[:3],
        "reason": decision.reason,
    })

    enhanced_prompt = state["user_prompt"] + "\n\nAdditional details from the user:\n" + "\n".join(
        f"Q: {q}\nA: {a}" for q, a in zip(decision.questions, answers or [])
    )
    return {
        **state,
        "user_prompt": enhanced_prompt,
        "needs_clarification": False,
        "clarification_answers": answers,
        "status": "planning",
        "groq_tokens_used": tokens_used,
    }

