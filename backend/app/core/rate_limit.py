"""
Distributed and In-Memory Token-bucket rate limiter.

Provides:
- RedisBucketStore: Distributed, atomic Lua-scripted token bucket execution across
  multiple API replicas and workers.
- InMemoryBucketStore: Local thread-safe token bucket store for zero-dependency development/testing.
- Auto-fallback: If Redis is configured, RedisBucketStore is used automatically.
  If Redis is down or unreachable, gracefully falls back to in-memory store.
"""
import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Optional

from app.config import get_settings
from app.core.exceptions import RateLimitError
from app.core.logging import get_logger

logger = get_logger(__name__)


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


class RedisBucketStore:
    """
    Production-grade Redis-backed token bucket rate limiter.
    Executes an atomic Lua script on Redis, guaranteeing thread-safe and
    multi-process-safe rate limiting across all API replicas without race conditions.
    """

    # Lua script for atomic consume
    _CONSUME_LUA = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_period = tonumber(ARGV[2])
    local cost = tonumber(ARGV[3])
    local now = tonumber(ARGV[4])
    local ttl = math.max(60, math.ceil(refill_period * 2))

    local refill_rate = capacity / refill_period

    local data = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(data[1])
    local last_refill = tonumber(data[2])

    if not tokens or not last_refill then
        tokens = capacity
        last_refill = now
    else
        local elapsed = math.max(0, now - last_refill)
        tokens = math.min(capacity, tokens + (elapsed * refill_rate))
        last_refill = now
    end

    local allowed = 0
    if tokens >= cost then
        tokens = tokens - cost
        allowed = 1
    end

    redis.call('HMSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(last_refill))
    redis.call('EXPIRE', key, ttl)

    return {allowed, tostring(tokens)}
    """

    # Lua script for atomic get_state
    _GET_STATE_LUA = """
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_period = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])

    local refill_rate = capacity / refill_period
    local data = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(data[1])
    local last_refill = tonumber(data[2])

    if not tokens or not last_refill then
        tokens = capacity
    else
        local elapsed = math.max(0, now - last_refill)
        tokens = math.min(capacity, tokens + (elapsed * refill_rate))
    end

    return tostring(tokens)
    """

    def __init__(self, redis_client):
        self._redis = redis_client
        self._consume_script = self._redis.register_script(self._CONSUME_LUA)
        self._get_state_script = self._redis.register_script(self._GET_STATE_LUA)
        self._fallback_store = InMemoryBucketStore()

    def _format_key(self, key: str) -> str:
        return f"ratelimit:{key}"

    def consume(self, key: str, capacity: int, refill_period_seconds: float, cost: int = 1) -> bool:
        redis_key = self._format_key(key)
        now = time.time()
        try:
            result = self._consume_script(
                keys=[redis_key],
                args=[capacity, refill_period_seconds, cost, now],
            )
            return bool(result[0] == 1)
        except Exception as exc:
            logger.warning("Redis rate limit consume failed (%s), falling back to in-memory store", exc)
            return self._fallback_store.consume(key, capacity, refill_period_seconds, cost)

    def get_state(self, key: str, capacity: int, refill_period_seconds: float) -> dict:
        redis_key = self._format_key(key)
        now = time.time()
        try:
            tokens_str = self._get_state_script(
                keys=[redis_key],
                args=[capacity, refill_period_seconds, now],
            )
            current_tokens = float(tokens_str) if tokens_str else float(capacity)
            return {
                "key": key,
                "tokens_remaining": round(current_tokens, 2),
                "capacity": capacity,
                "period_seconds": refill_period_seconds,
            }
        except Exception as exc:
            logger.warning("Redis rate limit get_state failed (%s), falling back to in-memory store", exc)
            return self._fallback_store.get_state(key, capacity, refill_period_seconds)

    def reset(self, key_or_prefix: str) -> int:
        redis_key = self._format_key(key_or_prefix)
        deleted = 0
        try:
            pattern = f"{redis_key}*"
            cursor = 0
            while True:
                cursor, keys = self._redis.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    deleted += self._redis.delete(*keys)
                if cursor == 0:
                    break
            self._fallback_store.reset(key_or_prefix)
            return deleted
        except Exception as exc:
            logger.warning("Redis rate limit reset failed (%s), resetting in-memory fallback", exc)
            return self._fallback_store.reset(key_or_prefix)


def _init_store():
    settings = get_settings()
    if settings.REDIS_URL:
        try:
            import redis
            client = redis.from_url(
                settings.REDIS_URL,
                socket_connect_timeout=2.0,
                socket_timeout=2.0,
                retry_on_timeout=True,
                decode_responses=True,
            )
            client.ping()
            logger.info("Connected to Redis at %s for distributed rate limiting", settings.REDIS_URL)
            return RedisBucketStore(client)
        except Exception as exc:
            logger.warning("Could not connect to Redis at %s (%s). Using InMemoryBucketStore", settings.REDIS_URL, exc)
    return InMemoryBucketStore()


_store = _init_store()
bucket_store = _store


def enforce_rate_limit(key: str, capacity: int, period_seconds: float, error_message: str) -> None:
    if not _store.consume(key, capacity, period_seconds):
        raise RateLimitError(error_message)


def get_user_rate_limit_state(user_id: str, capacity: int = 10, period_seconds: float = 3600.0) -> dict:
    return _store.get_state(f"jobs:{user_id}", capacity=capacity, refill_period_seconds=period_seconds)


def reset_user_rate_limit(user_id: str) -> int:
    return _store.reset(f"jobs:{user_id}")


