"""
Cheap, fast static checks run BEFORE the LLM reviewer looks at a file.
These catch outright syntax errors without spending a model call, and their
result is fed to the Reviewer Agent as evidence either way.

Deliberately dependency-light: Python's own `compile()` for .py, `json.loads`
for .json, and a naive balanced-brackets check as a fallback for JS/TS/CSS/etc.
where a real parser isn't worth the dependency. For stricter checking in
production, shell out to language-specific tools (eslint --no-eslintrc,
tsc --noEmit, etc.) inside the sandbox container from app/sandbox/executor.py.
"""
import ast
import json
from pathlib import Path


def _check_python(content: str) -> tuple[bool, str]:
    try:
        ast.parse(content)
        return True, "valid Python syntax"
    except SyntaxError as exc:
        return False, f"SyntaxError: {exc}"


def _check_json(content: str) -> tuple[bool, str]:
    try:
        json.loads(content)
        return True, "valid JSON"
    except json.JSONDecodeError as exc:
        return False, f"JSONDecodeError: {exc}"


def _check_balanced_brackets(content: str) -> tuple[bool, str]:
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    in_string = None
    escaped = False
    for ch in content:
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == in_string:
                in_string = None
            continue
        if ch in ("'", '"', "`"):
            in_string = ch
        elif ch in "([{":
            stack.append(ch)
        elif ch in ")]}":
            if not stack or stack[-1] != pairs[ch]:
                return False, f"Unbalanced bracket near '{ch}'"
            stack.pop()
    if stack:
        return False, f"Unclosed bracket(s): {''.join(stack)}"
    return True, "balanced brackets (basic check only)"


def _check_passthrough(content: str) -> tuple[bool, str]:
    return True, "text content ok"


_CHECKERS = {
    ".py": _check_python,
    ".json": _check_json,
    ".md": _check_passthrough,
    ".txt": _check_passthrough,
    ".html": _check_passthrough,
    ".htm": _check_passthrough,
    ".yaml": _check_passthrough,
    ".yml": _check_passthrough,
    ".toml": _check_passthrough,
    ".env": _check_passthrough,
    ".css": _check_balanced_brackets,
    ".js": _check_balanced_brackets,
    ".jsx": _check_balanced_brackets,
    ".ts": _check_balanced_brackets,
    ".tsx": _check_balanced_brackets,
}


def validate_file(path: str, content: str) -> tuple[bool, str]:
    ext = Path(path).suffix.lower()
    checker = _CHECKERS.get(ext, _check_balanced_brackets)
    return checker(content)
