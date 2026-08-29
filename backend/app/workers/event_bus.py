"""
Simple pub/sub so the SSE endpoint can stream live progress from whatever is
running a job. Backed by in-memory asyncio.Queues, which is sufficient for a
single-process deployment.

PRODUCTION NOTE: for horizontal scaling (multiple API/worker replicas), this
must be swapped for a real pub/sub (Redis Streams / Redis Pub-Sub) so an SSE
connection on API replica A can receive events published by a worker on
replica B. The publish()/subscribe() interface below is deliberately kept
Redis-shaped so that swap is a small, contained change.
"""
import asyncio
import json
from collections import defaultdict


class JobEventBus:
    def __init__(self):
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self, job_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers[job_id].append(q)
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue) -> None:
        if q in self._subscribers.get(job_id, []):
            self._subscribers[job_id].remove(q)

    def publish(self, job_id: str, event: dict) -> None:
        """Thread-safe: safe to call from the worker thread, not just the event loop."""
        payload = json.dumps(event, default=str)
        queues = list(self._subscribers.get(job_id, []))
        if not queues:
            return
        if self._loop is None:
            return
        for q in queues:
            self._loop.call_soon_threadsafe(q.put_nowait, payload)


event_bus = JobEventBus()
