"""
Shared state for the LangGraph agent pipeline.

Schema shape follows the reference coder-buddy implementation (flat Plan /
TaskPlan / CoderState) rather than a more granular per-file status model --
simpler to reason about, and proven to work end to end.
"""
from typing import Literal, Optional, TypedDict

from pydantic import BaseModel, Field


class ProjectFile(BaseModel):
    path: str
    description: str


class Plan(BaseModel):
    name: str
    description: str
    tech_stack: list[str]
    features: list[str]
    files: list[ProjectFile] = Field(default_factory=list)  # rough sketch from Planner


class ImplementationTask(BaseModel):
    filepath: str
    task_description: str  # the ONLY context the Coder Agent gets for this file
    depends_on: list[str] = Field(default_factory=list)


class TaskPlan(BaseModel):
    implementation_steps: list[ImplementationTask]

    def validate_one_task_per_file(self) -> None:
        """Architect-enforced invariant: exactly one task per file path.
        Prevents the Coder Agent from overwriting its own earlier work."""
        paths = [t.filepath for t in self.implementation_steps]
        if len(set(paths)) != len(paths):
            dupes = {p for p in paths if paths.count(p) > 1}
            raise ValueError(f"Architect produced duplicate tasks for file(s): {dupes}")


class CoderState(BaseModel):
    current_step_idx: int = 0
    files_written: dict[str, str] = Field(default_factory=dict)  # path -> final content
    failed_files: dict[str, str] = Field(default_factory=dict)   # path -> last error


class ClarificationRequest(BaseModel):
    questions: list[str]
    reason: str


JobStatus = Literal[
    "clarifying",
    "awaiting_clarification",
    "planning",
    "awaiting_plan_confirmation",
    "architecting",
    "awaiting_architecture_confirmation",
    "coding",
    "reviewing",
    "packaging",
    "done",
    "failed",
    "cancelled",
]


class GraphState(TypedDict, total=False):
    job_id: str
    user_prompt: str
    mode: Literal["build", "edit"]
    project_root: str

    # Clarification
    needs_clarification: bool
    clarification: Optional[ClarificationRequest]
    clarification_answers: Optional[list[str]]

    # Planning / architecture
    plan: Optional[Plan]
    plan_feedback: Optional[str]        # user edit instruction, if they requested changes
    task_plan: Optional[TaskPlan]
    architecture_feedback: Optional[str]

    # Coding
    coder_state: CoderState

    # Bookkeeping
    status: JobStatus
    errors: list[str]
    retry_budget: int                    # global cap so a bad retry loop can't run forever
