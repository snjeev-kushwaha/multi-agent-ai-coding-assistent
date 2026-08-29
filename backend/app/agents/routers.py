from app.agents.state import GraphState


def route_after_plan_confirm(state: GraphState) -> str:
    if state["status"] == "cancelled":
        return "end"
    if state["status"] == "planning":
        return "planner"  # user requested edits -> loop back
    return "architect"


def route_after_architecture_confirm(state: GraphState) -> str:
    if state["status"] == "cancelled":
        return "end"
    if state["status"] == "architecting":
        return "architect"  # user requested edits -> loop back
    return "coder"


def route_after_reviewer(state: GraphState) -> str:
    if state["status"] == "packaging":
        return "packager"
    return "coder"  # either the next file, or a retry of the same file
