"""
Token-bucket rate limiter.

Ships with an in-memory backend so the project runs with zero external
dependencies out of the box. In production, swap `InMemoryBucketStore` for
a Redis-backed implementation (same interface) so limits are enforced
correctly across multiple API replicas -- the in-memory version only rate
limits per-process, which is fine for a single instance but NOT for a
horizontally scaled deployment.
"""
import time
from dataclasses import dataclass, field
from threading import Lock

from app.core.exceptions import RateLimitError


@dataclass
class _Bucket:
    tokens: float
    last_refill: float
    lock: Lock = field(default_factory=Lock)


class InMemoryBucketStore:
    def __init__(self):
        self._buckets: dict[str, _Bucket] = {}
        self._store_lock = Lock()

    def _get_bucket(self, key: str, capacity: float) -> _Bucket:
        with self._store_lock:
            if key not in self._buckets:
                self._buckets[key] = _Bucket(tokens=capacity, last_refill=time.monotonic())
            return self._buckets[key]

    def consume(self, key: str, capacity: int, refill_period_seconds: float, cost: int = 1) -> bool:
        """
        capacity: max tokens (= max requests per refill_period_seconds)
        Returns True if the request is allowed, False if rate-limited.
        """
        bucket = self._get_bucket(key, capacity)
        refill_rate = capacity / refill_period_seconds  # tokens per second

        with bucket.lock:
            now = time.monotonic()
            elapsed = now - bucket.last_refill
            bucket.tokens = min(capacity, bucket.tokens + elapsed * refill_rate)
            bucket.last_refill = now

            if bucket.tokens >= cost:
                bucket.tokens -= cost
                return True
            return False

    def get_state(self, key: str, capacity: int, refill_period_seconds: float) -> dict:
        """Returns the current token balance and capacity of a bucket."""
        bucket = self._get_bucket(key, capacity)
        refill_rate = capacity / refill_period_seconds

        with bucket.lock:
            now = time.monotonic()
            elapsed = now - bucket.last_refill
            current_tokens = min(capacity, bucket.tokens + elapsed * refill_rate)
            return {
                "key": key,
                "tokens_remaining": round(current_tokens, 2),
                "capacity": capacity,
                "period_seconds": refill_period_seconds,
            }

    def reset(self, key_or_prefix: str) -> int:
        """Removes bucket(s) matching the key or starting with the prefix."""
        with self._store_lock:
            keys_to_delete = [
                k for k in self._buckets
                if k == key_or_prefix or k.startswith(f"{key_or_prefix}:") or k.startswith(key_or_prefix)
            ]
            for k in keys_to_delete:
                del self._buckets[k]
            return len(keys_to_delete)


_store = InMemoryBucketStore()
bucket_store = _store



def enforce_rate_limit(key: str, capacity: int, period_seconds: float, error_message: str) -> None:
    if not _store.consume(key, capacity, period_seconds):
        raise RateLimitError(error_message)


def get_user_rate_limit_state(user_id: str, capacity: int = 10, period_seconds: float = 3600.0) -> dict:
    return _store.get_state(f"jobs:{user_id}", capacity=capacity, refill_period_seconds=period_seconds)


def reset_user_rate_limit(user_id: str) -> int:
    return _store.reset(f"jobs:{user_id}")

