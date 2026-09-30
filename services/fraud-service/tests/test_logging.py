import json
import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from logging_setup import (
    JsonFormatter,
    RequestContextMiddleware,
    current_request_id,
    redact,
    redact_text,
    resolve_request_id,
    scrub_sentry_event,
)


def test_redacts_sensitive_fields_and_text():
    assert redact({"password": "x", "user": {"phone": "+963944123456", "name": "سارة"}, "empty": ""}) == {
        "password": "[redacted]",
        "user": {"phone": "[redacted]", "name": "سارة"},
        "empty": "",
    }
    assert redact_text("OTP to +963 944 123 456 / 0944123456, mail ahmad.k@mail.sy") == (
        "OTP to [redacted-phone] / [redacted-phone], mail a***@mail.sy"
    )
    assert redact_text("GET /cb?state=1&code=4/0AQl") == "GET /cb?state=1&code=[redacted]"
    keep = "listing 00000000-0000-4000-8000-000000000000 at 2026-09-30T00:00:00.000Z price 650"
    assert redact_text(keep) == keep


def test_request_id_validation():
    assert resolve_request_id("gateway-1234abcd") == "gateway-1234abcd"
    for bad in (None, "short", "has space inside", "x" * 200):
        assert len(resolve_request_id(bad)) == 36


def test_sentry_scrubbing():
    event = scrub_sentry_event({
        "request": {"url": "http://x/a?token=1", "query_string": "token=1", "data": {"otp": "123456"},
                    "headers": {"x-request-id": "req-12345678"}},
        "user": {"id": "u1", "email": "a@b.co"},
    })
    assert event == {
        "request": {"url": "http://x/a", "data": {"otp": "[redacted]"}, "headers": {"x-request-id": "req-12345678"}},
        "user": {"id": "u1"},
        "tags": {"request_id": "req-12345678"},
    }


def _app_with_captured_logs():
    lines = []

    class Capture(logging.Handler):
        def emit(self, record):
            lines.append(json.loads(JsonFormatter("test-service").format(record)))

    handler = Capture()
    for name in ("HTTP", "probe"):
        logging.getLogger(name).addHandler(handler)
        logging.getLogger(name).setLevel(logging.INFO)

    app = FastAPI()

    @app.get("/probe")
    async def probe():
        logging.getLogger("probe").info("inside handler for %s", "sara@example.com")
        return {"requestId": current_request_id()}

    @app.get("/health")
    async def health():
        return {"ok": True}

    app.add_middleware(RequestContextMiddleware)
    return TestClient(app), lines


def test_request_id_flows_into_response_logs_and_access_line():
    client, lines = _app_with_captured_logs()
    res = client.get("/probe?token=secret")
    request_id = res.headers["x-request-id"]
    assert len(request_id) == 36 and res.json() == {"requestId": request_id}
    handler_line = next(l for l in lines if l["context"] == "probe")
    assert handler_line["requestId"] == request_id
    assert handler_line["msg"] == "inside handler for s***@example.com"
    access = next(l for l in lines if l["context"] == "HTTP")
    assert access["msg"] == "request" and access["requestId"] == request_id
    assert access["status"] == 200 and access["path"] == "/probe" and access["level"] == "info"
    assert "secret" not in json.dumps(lines)

    res = client.get("/probe", headers={"X-Request-ID": "gateway-1234abcd"})
    assert res.headers["x-request-id"] == "gateway-1234abcd" and res.json()["requestId"] == "gateway-1234abcd"

    before = len(lines)
    client.get("/health")
    assert len(lines) == before
