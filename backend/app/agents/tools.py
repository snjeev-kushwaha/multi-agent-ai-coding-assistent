"""
Tools available to the Coder Agent's ReAct loop.

This is the single most important departure from a naive "one LLM call per
file" design: giving the Coder Agent tools lets it read what it already
wrote before editing it, check for conflicts before creating a file, and
(optionally) run install/build commands to self-verify -- instead of
blindly trusting one-shot generation.

All file operations are jailed to the job's project_root -- path traversal
outside that directory is rejected unconditionally, regardless of what the
model asks for.
"""
import fnmatch
import re
import subprocess
from pathlib import Path

from app.core.logging import get_logger

logger = get_logger(__name__)

# Dangerous command patterns -- reused pattern from the reference implementation.
# This blocklist gates the run_cmd tool. It is a defense-in-depth layer on TOP of
# container-level sandboxing (network=none, resource limits, ephemeral FS) --
# never rely on this list alone; see app/sandbox/executor.py for the real isolation.
DANGEROUS_PATTERNS = [
    r"rm\s+-rf",
    r"sudo\s+",
    r"chmod\s+777",
    r"curl.*\|\s*sh",
    r"wget.*\|\s*sh",
    r"dd\s+if=",
    r"mkfs\.",
    r":\(\)\s*\{\s*:\|\s*:&\s*\}\s*;\s*:",  # fork bomb
    r">\s*/dev/sd",
    r"mv.*\s+/dev/null",
    r"eval\s*\(",
    r"exec\s*\(",
]


class ToolError(Exception):
    pass


def _resolve_safe_path(project_root: str, relative_path: str) -> Path:
    """Resolves a path and rejects any attempt to escape project_root."""
    root = Path(project_root).resolve()
    target = (root / relative_path).resolve()
    if root not in target.parents and target != root:
        raise ToolError(f"Path '{relative_path}' escapes the project sandbox. Rejected.")
    return target


class CoderTools:
    """
    Instantiated once per job with a fixed project_root, so every tool call
    from the LLM is automatically scoped to that job's sandbox directory.
    permissive=False (default) blocks anything matching DANGEROUS_PATTERNS
    outright -- this should never be flipped to True for untrusted, multi-tenant
    web requests. It exists to mirror the reference implementation's CLI modes.
    """

    def __init__(self, project_root: str, permissive: bool = False, max_file_bytes: int = 200_000):
        Path(project_root).mkdir(parents=True, exist_ok=True)
        self.project_root = project_root
        self.permissive = permissive
        self.max_file_bytes = max_file_bytes

    # ---- read/write/edit ----

    def read_file(self, path: str) -> str:
        target = _resolve_safe_path(self.project_root, path)
        if not target.exists():
            raise ToolError(f"File not found: {path}")
        return target.read_text(encoding="utf-8", errors="replace")

    def write_file(self, path: str, content: str) -> str:
        if len(content.encode("utf-8")) > self.max_file_bytes:
            raise ToolError(f"File '{path}' exceeds max size of {self.max_file_bytes} bytes.")
        target = _resolve_safe_path(self.project_root, path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} chars to {path}"

    def edit_file(self, path: str, old_str: str, new_str: str) -> str:
        """
        Precise string replacement. Requires old_str to match EXACTLY ONCE --
        errors on zero or multiple matches rather than guessing, so an edit
        can never silently corrupt a file or apply to the wrong location.
        """
        target = _resolve_safe_path(self.project_root, path)
        if not target.exists():
            raise ToolError(f"File not found: {path}")
        content = target.read_text(encoding="utf-8")
        count = content.count(old_str)
        if count == 0:
            raise ToolError(f"old_str not found in {path}. No changes made.")
        if count > 1:
            raise ToolError(
                f"old_str matches {count} times in {path} -- must be unique. "
                f"Provide more surrounding context to disambiguate."
            )
        target.write_text(content.replace(old_str, new_str, 1), encoding="utf-8")
        return f"Edited {path} ({len(old_str)} chars -> {len(new_str)} chars)"

    # ---- discovery ----

    def list_files(self, path: str = ".") -> str:
        target = _resolve_safe_path(self.project_root, path)
        if not target.exists():
            return f"(path '{path}' does not exist yet)"
        entries = sorted(str(p.relative_to(self.project_root)) for p in target.rglob("*") if p.is_file())
        return "\n".join(entries) if entries else "(empty)"

    def glob_files(self, pattern: str, max_results: int = 100) -> str:
        root = Path(self.project_root)
        matches = [
            str(p.relative_to(root))
            for p in root.rglob("*")
            if p.is_file() and fnmatch.fnmatch(str(p.relative_to(root)), pattern)
        ]
        matches = matches[:max_results]
        return "\n".join(matches) if matches else f"(no files match '{pattern}')"

    def grep(self, pattern: str, path: str = ".", max_results: int = 50, ignore_case: bool = False) -> str:
        target = _resolve_safe_path(self.project_root, path)
        flags = re.IGNORECASE if ignore_case else 0
        try:
            regex = re.compile(pattern, flags)
        except re.error as exc:
            raise ToolError(f"Invalid regex: {exc}")

        results: list[str] = []
        files = [target] if target.is_file() else list(target.rglob("*"))
        for f in files:
            if not f.is_file():
                continue
            try:
                text = f.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for lineno, line in enumerate(text.splitlines(), start=1):
                if regex.search(line):
                    rel = f.relative_to(self.project_root)
                    results.append(f"{rel}:{lineno}: {line.strip()[:200]}")
                    if len(results) >= max_results:
                        return "\n".join(results)
        return "\n".join(results) if results else f"(no matches for '{pattern}')"

    # ---- execution (heavily gated) ----

    def run_cmd(self, command: str, timeout_seconds: int = 30) -> str:
        if not self.permissive:
            for pattern in DANGEROUS_PATTERNS:
                if re.search(pattern, command):
                    logger.warning("Blocked dangerous command: %s", command)
                    raise ToolError(
                        f"Command rejected by the safety filter (matched pattern for a "
                        f"potentially destructive operation). Not executed."
                    )
        try:
            result = subprocess.run(
                command, shell=True, cwd=self.project_root,
                capture_output=True, text=True, timeout=timeout_seconds,
            )
            output = (result.stdout or "") + (result.stderr or "")
            return output[:4000] or "(command produced no output)"
        except subprocess.TimeoutExpired:
            raise ToolError(f"Command timed out after {timeout_seconds}s")


# --- Tool schemas for Groq's OpenAI-compatible function-calling API ---
TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the current contents of a file in the project.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "description": "Relative file path"}},
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create a file or overwrite it completely with new content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": (
                "Make a precise edit to an existing file by replacing an exact, unique "
                "substring. Use this instead of write_file when only part of a file needs "
                "to change. old_str must match exactly once."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "old_str": {"type": "string"},
                    "new_str": {"type": "string"},
                },
                "required": ["path", "old_str", "new_str"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List all files currently in the project (or a subdirectory).",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "default": "."}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "glob_files",
            "description": "Find files matching a glob pattern, e.g. '**/*.tsx' or 'src/**/*.js'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string"},
                    "max_results": {"type": "integer", "default": 100},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "grep",
            "description": "Search file contents with a regex pattern.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string"},
                    "path": {"type": "string", "default": "."},
                    "ignore_case": {"type": "boolean", "default": False},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_cmd",
            "description": (
                "Run a shell command inside the sandboxed project directory, e.g. to "
                "install dependencies or check syntax. Dangerous commands are blocked."
            ),
            "parameters": {
                "type": "object",
                "properties": {"command": {"type": "string"}},
                "required": ["command"],
            },
        },
    },
]


def dispatch_tool_call(tools: CoderTools, name: str, arguments: dict) -> str:
    handler = {
        "read_file": tools.read_file,
        "write_file": tools.write_file,
        "edit_file": tools.edit_file,
        "list_files": tools.list_files,
        "glob_files": tools.glob_files,
        "grep": tools.grep,
        "run_cmd": tools.run_cmd,
    }.get(name)
    if handler is None:
        return f"Unknown tool: {name}"
    try:
        return handler(**arguments)
    except ToolError as exc:
        return f"ERROR: {exc}"
    except TypeError as exc:
        return f"ERROR: invalid arguments for {name}: {exc}"
