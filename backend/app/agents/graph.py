"""
Compiles the full agent pipeline:

  Clarifier -> Planner -> [Plan Confirm] -> Architect -> [Architecture Confirm]
    -> Coder (loops per file) -> Reviewer (loops back to Coder on fail/next-file)
    -> Packager -> END

Uses a checkpointer so the graph is:
  - Resumable: a worker crash mid-job resumes from the last completed node,
    not from scratch.
  - Interruptible: the Plan/Architecture confirmation nodes use LangGraph's
    interrupt() to pause execution and wait for a human response delivered
    over the API layer, without any custom pause/resume plumbing.

In production, swap MemorySaver for a Postgres-backed checkpointer
(langgraph.checkpoint.postgres.PostgresSaver) so state survives process
restarts and is shared across worker replicas.
"""
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from langgraph.graph import END, StateGraph

# GraphState carries Pydantic models (Plan, TaskPlan, CoderState, ClarificationRequest)
# as values. LangGraph's default msgpack checkpoint serializer will eventually require
# custom types to be explicitly allow-listed (currently a deprecation warning, not a
# hard failure). Register them here so checkpointing keeps working across upgrades.
_ALLOWED_MSGPACK_MODULES = [
    ("app.agents.state", "Plan"),
    ("app.agents.state", "TaskPlan"),
    ("app.agents.state", "ImplementationTask"),
    ("app.agents.state", "ProjectFile"),
    ("app.agents.state", "CoderState"),
    ("app.agents.state", "ClarificationRequest"),
]

from app.agents.nodes.architect import architect_node, architecture_confirm_node
from app.agents.nodes.clarifier import clarifier_node
from app.agents.nodes.coder import coder_node
from app.agents.nodes.packager import packager_node
from app.agents.nodes.planner import plan_confirm_node, planner_node
from app.agents.nodes.reviewer import reviewer_node
from app.agents.routers import (
    route_after_architecture_confirm,
    route_after_plan_confirm,
    route_after_reviewer,
)
from app.agents.state import GraphState


def _default_checkpointer() -> MemorySaver:
    serde = JsonPlusSerializer(allowed_msgpack_modules=_ALLOWED_MSGPACK_MODULES)
    return MemorySaver(serde=serde)


def build_graph(checkpointer=None):
    graph = StateGraph(GraphState)

    graph.add_node("clarifier", clarifier_node)
    graph.add_node("planner", planner_node)
    graph.add_node("plan_confirm", plan_confirm_node)
    graph.add_node("architect", architect_node)
    graph.add_node("architecture_confirm", architecture_confirm_node)
    graph.add_node("coder", coder_node)
    graph.add_node("reviewer", reviewer_node)
    graph.add_node("packager", packager_node)

    graph.set_entry_point("clarifier")
    graph.add_edge("clarifier", "planner")
    graph.add_edge("planner", "plan_confirm")
    graph.add_conditional_edges(
        "plan_confirm", route_after_plan_confirm,
        {"planner": "planner", "architect": "architect", "end": END},
    )
    graph.add_edge("architect", "architecture_confirm")
    graph.add_conditional_edges(
        "architecture_confirm", route_after_architecture_confirm,
        {"architect": "architect", "coder": "coder", "end": END},
    )
    graph.add_edge("coder", "reviewer")
    graph.add_conditional_edges(
        "reviewer", route_after_reviewer,
        {"coder": "coder", "packager": "packager"},
    )
    graph.add_edge("packager", END)

    return graph.compile(checkpointer=checkpointer or _default_checkpointer())


# Module-level singleton; in a multi-worker deployment each worker process
# builds its own graph instance bound to a SHARED (Postgres) checkpointer.
_compiled_graph = None


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph
