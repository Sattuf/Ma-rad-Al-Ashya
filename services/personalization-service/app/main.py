# Logging first, before modules that may log while loading.
from app.core.logging_setup import setup_logging

setup_logging("personalization-service")

import asyncio  # noqa: E402
import logging
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI
from datetime import datetime
from app.core.db import db
from app.services.event_service import event_service
from app.services.recommendation_service import recommendation_service
from app.routers import events, recommendations
import os
import sentry_sdk
from prometheus_fastapi_instrumentator import Instrumentator
from app.core.logging_setup import RequestContextMiddleware, scrub_sentry_event

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    traces_sample_rate=0.1,
    before_send=scrub_sentry_event,
    before_send_transaction=scrub_sentry_event,
)

logger = logging.getLogger("personalization")
MAINTENANCE_INTERVAL_SECONDS = 24 * 3600


async def _maintain_partitions_forever():
    # Idempotent and safe across pods (advisory lock in the SQL functions).
    while True:
        try:
            dropped = await event_service.maintain_partitions()
            if dropped:
                logger.info(f"Dropped {dropped} expired user_events partition(s)")
        except Exception as e:
            logger.error(f"user_events partition maintenance failed: {e}")
        await asyncio.sleep(MAINTENANCE_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.connect()
    maintenance = asyncio.create_task(_maintain_partitions_forever())
    try:
        yield
    finally:
        maintenance.cancel()
        with suppress(asyncio.CancelledError):
            await maintenance
        await db.close()


app = FastAPI(
    lifespan=lifespan,
    title="Personalization Service",
    description="خدمة التخصيص — Personalization & Recommendation Service for Ma'rad Al-Ashya'",
    version="0.1.0",
)

Instrumentator().instrument(app).expose(app)
# Added last so it runs first: everything after it sees the request ID.
app.add_middleware(RequestContextMiddleware)

app.include_router(events.router)
app.include_router(recommendations.router)

async def _check(probe) -> str:
    try:
        await probe()
        return "ok"
    except Exception:
        return "error"


@app.get("/health")
async def health_check():
    details = {
        "postgres": await _check(lambda: db.fetchval("SELECT 1")),
        "redis": await _check(event_service.redis_client.ping),
        "elasticsearch": await _check(recommendation_service.es_client.ping),
    }
    return {
        "status": "ok" if all(v == "ok" for v in details.values()) else "degraded",
        "service": "personalization-service",
        "timestamp": datetime.utcnow().isoformat(),
        "details": details,
    }
