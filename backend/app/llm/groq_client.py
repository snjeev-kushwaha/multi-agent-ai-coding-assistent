"""
Thin wrapper around the Groq SDK adding:
  - exponential backoff + jitter on timeouts / 5xx / 429
  - a self-throttling token bucket so we back off BEFORE Groq rate-limits us
  - a structured-JSON-output helper with schema validation + one repair retry
  - a tool-calling chat helper for the Coder Agent's ReAct loop

Verify current Groq model names, context windows, and rate limits at
https://console.groq.com/docs/models and https://console.groq.com/docs/rate-limits
before relying on the defaults in config.py -- these change over time.
"""
import json
import random
import time
from typing import Any, Callable, Optional, Type, TypeVar

from groq import Groq, APIError, APIStatusError, APITimeoutError
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.core.exceptions import LLMProviderError
from app.core.logging import get_logger
from app.core.rate_limit import _store  # reuse the same token-bucket implementation

logger = get_logger(__name__)
T = TypeVar("T", bound=BaseModel)


class GroqClient:
    def __init__(self):
        settings = get_settings()
        self._client = Groq(api_key=settings.GROQ_API_KEY, timeout=settings.GROQ_TIMEOUT_SECONDS)
        self._max_retries = settings.GROQ_MAX_RETRIES
        # Self-throttle: conservative default, tune against your actual Groq tier.
        self._rpm_bucket_key = "groq:global:rpm"
        self._rpm_capacity = 25

    def _throttle(self) -> None:
        # Wait until a token is free rather than firing and eating a 429.
        waited = 0.0
        while not _store.consume(self._rpm_bucket_key, self._rpm_capacity, 60.0):
            time.sleep(0.25)
            waited += 0.25
            if waited > 30:
                break  # don't hang forever; let the real call surface a rate-limit error

    def _call_with_retry(self, fn: Callable[[], Any]) -> Any:
        last_exc: Optional[Exception] = None
        for attempt in range(self._max_retries):
            self._throttle()
            try:
                return fn()
            except (APITimeoutError, APIStatusError, APIError) as exc:
                last_exc = exc
                status_code = getattr(exc, "status_code", None)
                retryable = status_code is None or status_code in (429, 500, 502, 503, 504)
                if not retryable or attempt == self._max_retries - 1:
                    break
                backoff = (2 ** attempt) + random.uniform(0, 1)
                logger.warning(
                    "Groq call failed (attempt %d/%d), retrying in %.1fs: %s",
                    attempt + 1, self._max_retries, backoff, exc,
                )
                time.sleep(backoff)
        raise LLMProviderError(f"Groq API failed after {self._max_retries} attempts: {last_exc}")

    def chat(self, model: str, messages: list[dict], temperature: float = 0.2,
              max_tokens: int = 4096, tools: Optional[list[dict]] = None) -> Any:
        def _do():
            kwargs: dict[str, Any] = dict(
                model=model, messages=messages, temperature=temperature, max_tokens=max_tokens,
            )
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"
            return self._client.chat.completions.create(**kwargs)
        return self._call_with_retry(_do)

    def structured(self, model: str, system_prompt: str, user_prompt: str,
                    schema: Type[T], temperature: float = 0.1, max_tokens: int = 4096,
                    return_usage: bool = False) -> T | tuple[T, int]:
        """
        Forces JSON-only output and validates against a Pydantic schema.
        On validation failure, re-prompts ONCE with the validation error appended
        (per the error-handling strategy: fail clearly after bounded retries,
        never silently accept malformed output).
        """
        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        full_system = (
            f"{system_prompt}\n\n"
            f"You MUST respond with ONLY valid JSON matching this schema, "
            f"no preamble, no markdown code fences, no explanation:\n{schema_json}"
        )
        messages = [
            {"role": "system", "content": full_system},
            {"role": "user", "content": user_prompt},
        ]

        total_tokens = 0
        for attempt in range(2):
            response = self.chat(model, messages, temperature=temperature, max_tokens=max_tokens)
            if response and getattr(response, "usage", None):
                total_tokens += getattr(response.usage, "total_tokens", 0) or 0
            raw = response.choices[0].message.content.strip()
            raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            try:
                data = json.loads(raw)
                result = schema.model_validate(data)
                if return_usage:
                    return result, total_tokens
                return result
            except (json.JSONDecodeError, ValidationError) as exc:
                logger.warning("Structured output validation failed (attempt %d): %s", attempt + 1, exc)
                if attempt == 0:
                    messages.append({"role": "assistant", "content": raw})
                    messages.append({
                        "role": "user",
                        "content": f"That was invalid: {exc}\nRespond again with ONLY corrected valid JSON.",
                    })
                    continue
                raise LLMProviderError(f"Model failed to produce valid structured output: {exc}")

    def structured_with_usage(self, model: str, system_prompt: str, user_prompt: str,
                              schema: Type[T], temperature: float = 0.1, max_tokens: int = 4096) -> tuple[T, int]:
        res = self.structured(
            model=model, system_prompt=system_prompt, user_prompt=user_prompt,
            schema=schema, temperature=temperature, max_tokens=max_tokens, return_usage=True,
        )
        return res  # type: ignore



_client_singleton: Optional[GroqClient] = None


def get_groq_client() -> GroqClient:
    global _client_singleton
    if _client_singleton is None:
        _client_singleton = GroqClient()
    return _client_singleton
