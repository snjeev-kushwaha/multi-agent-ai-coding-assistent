"""
Structured JSON logging so every log line can be correlated by job_id / user_id
in a log aggregator (CloudWatch, Datadog, ELK, etc.) in production.
"""
import json
import logging
import sys
import time
from contextvars import ContextVar

# job_id is set per-request/per-job so every log line downstream carries it
# automatically without threading it through every function signature.
job_id_ctx: ContextVar[str] = ContextVar("job_id", default="-")


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": round(time.time(), 3),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "job_id": job_id_ctx.get(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        extra = getattr(record, "extra_fields", None)
        if extra:
            payload.update(extra)
        return json.dumps(payload, default=str)


def setup_logging(debug: bool = False) -> None:
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if debug else logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root.handlers = [handler]


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def log_extra(**kwargs) -> dict:
    """Usage: logger.info('message', extra={'extra_fields': log_extra(file='x.py')})"""
    return kwargs
