"""
السجلات المنظمة ومعرّف الطلب — Structured logs and request IDs

Python twin of services/*/src/common/logging.ts: same JSON line format, same X-Request-ID
handling, same redaction rules, so logs from every service can be searched the same way.

NOTE: duplicated in fraud-service and personalization-service (app/core). Keep both identical.
"""
import json
import logging
import os
import re
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Optional

REQUEST_ID_HEADER = "x-request-id"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")
_request_id: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def current_request_id() -> Optional[str]:
    return _request_id.get()


def resolve_request_id(incoming: Optional[str]) -> str:
    """The caller's ID when it is valid, a new one otherwise."""
    if incoming and _VALID_REQUEST_ID.match(incoming):
        return incoming
    return str(uuid.uuid4())


# ─── Redaction ───────────────────────────────────────────────────────────────

_SENSITIVE_KEYS = {
    "password", "otp", "otpcode", "pin", "token", "authorization", "cookie", "setcookie",
    "apikey", "phone", "phonenumber", "mobile", "nationalid", "documentnumber", "idnumber",
    "cardnumber", "cvc", "cvv", "iban", "xinternalsecret", "xapikey", "stripesignature",
    "xsignature", "xdiditsignature",
}
_SENSITIVE_SUFFIX = re.compile(r"(password|secret|token)$")


def is_sensitive_key(key: str) -> bool:
    k = re.sub(r"[^a-z0-9]", "", key.lower())
    return k in _SENSITIVE_KEYS or bool(_SENSITIVE_SUFFIX.search(k))


_TEXT_PATTERNS = [
    (re.compile(r"\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}"), "[redacted-jwt]"),
    (re.compile(r"\b(Bearer|Basic)\s+[\w.~+/-]+=*", re.I), r"\1 [redacted]"),
    (re.compile(r"([?&](?:token|access_token|refresh_token|id_token|code|otp|password|secret|key|signature)=)[^&\s\"']+", re.I), r"\1[redacted]"),
    (re.compile(r"(?<![\w+])\+\d{1,3}[\s-]?\d[\d\s-]{6,13}\d\b"), "[redacted-phone]"),
    (re.compile(r"\b00963\d{8,9}\b"), "[redacted-phone]"),
    (re.compile(r"\b09\d{8}\b"), "[redacted-phone]"),
    (re.compile(r"\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b"), r"\1***@\2"),
]


def redact_text(text: str) -> str:
    for pattern, replacement in _TEXT_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def redact(value: Any, depth: int = 0) -> Any:
    """A copy of `value` safe to log: sensitive fields masked, strings scrubbed."""
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, (bytes, bytearray)):
        return f"[binary {len(value)} bytes]"
    if depth >= 6:
        return "[truncated]"
    if isinstance(value, dict):
        return {
            k: "[redacted]" if is_sensitive_key(str(k)) and v not in (None, "") else redact(v, depth + 1)
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(v, depth + 1) for v in value]
    return value


def scrub_sentry_event(event: dict, _hint: Any = None) -> dict:
    """Sentry before_send: scrubs request data and extras, tags the request ID."""
    request = event.get("request")
    if request:
        request = redact(request)
        if isinstance(request.get("url"), str):
            request["url"] = request["url"].split("?")[0]
        request.pop("query_string", None)
        request.pop("cookies", None)
        event["request"] = request
    if event.get("extra"):
        event["extra"] = redact(event["extra"])
    if event.get("user"):
        event["user"] = {"id": event["user"].get("id")}
    for ex in (event.get("exception") or {}).get("values") or []:
        if isinstance(ex.get("value"), str):
            ex["value"] = redact_text(ex["value"])
    request_id = ((request or {}).get("headers") or {}).get(REQUEST_ID_HEADER) or current_request_id()
    if request_id:
        event["tags"] = {**(event.get("tags") or {}), "request_id": request_id}
    return event


# ─── Logger ──────────────────────────────────────────────────────────────────

_LEVEL_NAMES = {"DEBUG": "debug", "INFO": "info", "WARNING": "warn", "ERROR": "error", "CRITICAL": "fatal"}
_STANDARD_ATTRS = set(vars(logging.LogRecord("", 0, "", 0, "", None, None))) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    def __init__(self, service: str):
        super().__init__()
        self.service = service

    def format(self, record: logging.LogRecord) -> str:
        fields = {k: v for k, v in vars(record).items() if k not in _STANDARD_ATTRS}
        entry = {
            **fields,
            "time": datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "level": _LEVEL_NAMES.get(record.levelname, record.levelname.lower()),
            "service": self.service,
            "context": record.name,
            "requestId": fields.get("requestId") or current_request_id(),
            "msg": record.getMessage(),
        }
        if record.exc_info:
            entry["err"] = {"stack": self.formatException(record.exc_info)}
        return json.dumps(redact({k: v for k, v in entry.items() if v is not None}), ensure_ascii=False, default=str)


def setup_logging(service: str) -> None:
    """JSON logs on stdout for our loggers and uvicorn's; our access line replaces uvicorn's."""
    default = "INFO" if os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "")) == "production" else "DEBUG"
    level = {"verbose": "DEBUG", "warn": "WARNING", "fatal": "CRITICAL"}.get(
        os.getenv("LOG_LEVEL", "").lower(), os.getenv("LOG_LEVEL", default).upper()
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level if level in logging.getLevelNamesMapping() else default)
    # Libraries chatty at DEBUG level stay at INFO.
    for noisy in ("asyncio", "urllib3", "elastic_transport", "httpcore", "httpx"):
        logging.getLogger(noisy).setLevel(max(root.level, logging.INFO))
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
    logging.getLogger("uvicorn.access").disabled = True


# ─── HTTP wiring ─────────────────────────────────────────────────────────────

_QUIET_PATHS = re.compile(r"^/(health|metrics)(/|$)")
_access_log = logging.getLogger("HTTP")


class RequestContextMiddleware:
    """
    ASGI middleware, added last (so it runs first): assigns the request ID, returns it in
    X-Request-ID, runs the request inside its context, and writes one access line.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers") or [])
        incoming = headers.get(REQUEST_ID_HEADER.encode())
        request_id = resolve_request_id(incoming.decode("latin-1") if incoming else None)
        token = _request_id.set(request_id)
        started = time.perf_counter()
        status = {"code": 499}  # stays 499 if the client disconnects before a response

        async def send_with_id(message):
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
                message.setdefault("headers", [])
                message["headers"] = [*message["headers"], (b"x-request-id", request_id.encode())]
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            status["code"] = 500
            raise
        finally:
            path = scope.get("path", "")
            if not _QUIET_PATHS.match(path):
                code = status["code"]
                _access_log.log(
                    logging.WARNING if code >= 500 else logging.INFO,
                    "request",
                    extra={
                        "requestId": request_id,
                        "method": scope.get("method"),
                        "path": path,
                        "status": code,
                        "durationMs": round((time.perf_counter() - started) * 1000, 1),
                    },
                )
            _request_id.reset(token)
