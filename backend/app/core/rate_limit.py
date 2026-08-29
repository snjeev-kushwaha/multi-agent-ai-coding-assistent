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


_store = InMemoryBucketStore()


def enforce_rate_limit(key: str, capacity: int, period_seconds: float, error_message: str) -> None:
    if not _store.consume(key, capacity, period_seconds):
        raise RateLimitError(error_message)
