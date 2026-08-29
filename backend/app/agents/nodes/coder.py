import json

from app.agents.prompts.prompts import CODER_SYSTEM
from app.agents.state import GraphState
from app.agents.tools import TOOL_SCHEMAS, CoderTools, dispatch_tool_call
from app.config import get_settings
from app.core.logging import get_logger
from app.llm.groq_client import get_groq_client

logger = get_logger(__name__)


def _dependency_context(tools: CoderTools, depends_on: list[str]) -> str:
    if not depends_on:
        return "(no dependencies)"
    parts = []
    for path in depends_on:
        try:
            content = tools.read_file(path)
            parts.append(f"--- {path} ---\n{content}")
        except Exception:
            parts.append(f"--- {path} --- (not yet generated)")
    return "\n\n".join(parts)


def coder_node(state: GraphState) -> GraphState:
    """
    Generates ONE file per invocation (the graph loops back to this node until
    every task in task_plan.implementation_steps is done). Uses a bounded
    tool-calling loop -- this is what lets the agent read its own dependencies,
    check what already exists, and self-correct instead of one-shot generating
    blind.
    """
    settings = get_settings()
    client = get_groq_client()
    coder_state = state["coder_state"]
    task_plan = state["task_plan"]
    plan = state["plan"]

    idx = coder_state.current_step_idx
    task = task_plan.implementation_steps[idx]
    tools = CoderTools(project_root=state["project_root"])

    dep_context = _dependency_context(tools, task.depends_on)
    user_prompt = (
        f"Project: {plan.name} -- {plan.description}\n"
        f"Tech stack: {', '.join(plan.tech_stack)}\n\n"
        f"Your assigned file: {task.filepath}\n"
        f"Task: {task.task_description}\n\n"
        f"Dependency file contents:\n{dep_context}\n\n"
        f"Write this file using write_file(path='{task.filepath}', content=<full file content as a string>)."
    )

    messages = [
        {"role": "system", "content": CODER_SYSTEM},
        {"role": "user", "content": user_prompt},
    ]

    error: str | None = None
    for step in range(settings.MAX_CODER_TOOL_STEPS):
        response = client.chat(
            model=settings.GROQ_MODEL_CODER, messages=messages,
            temperature=0.15, tools=TOOL_SCHEMAS,
        )
        msg = response.choices[0].message

        if msg.tool_calls:
            messages.append({
                "role": "assistant", "content": msg.content or "",
                "tool_calls": [
                    tc.model_dump() if hasattr(tc, "model_dump") else tc for tc in msg.tool_calls
                ],
            })
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}
                result = dispatch_tool_call(tools, tc.function.name, args)
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": str(result)[:4000]})
            continue

        # No more tool calls -- the model is done (or gave up).
        final_text = msg.content or ""
        norm_task_path = task.filepath.replace("\\", "/").lstrip("./")
        file_list = [
            f.strip().replace("\\", "/").lstrip("./")
            for f in tools.list_files().splitlines()
            if f.strip() and not f.strip().startswith("(")
        ]
        if norm_task_path not in file_list:
            error = f"Coder finished without writing {task.filepath}. Last message: {final_text[:300]}"
        break
    else:
        error = f"Coder exceeded {settings.MAX_CODER_TOOL_STEPS} tool-call steps without finishing."

    new_coder_state = coder_state.model_copy(deep=True)
    if error:
        new_coder_state.failed_files[task.filepath] = error
        logger.warning("Coder failed on %s: %s", task.filepath, error)
    else:
        new_coder_state.files_written[task.filepath] = tools.read_file(task.filepath)

    return {**state, "coder_state": new_coder_state, "status": "reviewing"}
