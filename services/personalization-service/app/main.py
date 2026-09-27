from fastapi import FastAPI
from datetime import datetime
from app.services.event_service import event_service
from app.services.recommendation_service import recommendation_service
from app.routers import events, recommendations
import os
import sentry_sdk
from prometheus_fastapi_instrumentator import Instrumentator

sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"), traces_sample_rate=0.1)

app = FastAPI(
    title="Personalization Service",
    description="خدمة التخصيص — Personalization & Recommendation Service for Ma'rad Al-Ashya'",
    version="0.1.0",
)

Instrumentator().instrument(app).expose(app)

app.include_router(events.router)
app.include_router(recommendations.router)

@app.on_event("startup")
async def startup_event():
    await event_service.init_indices()

async def _check(probe) -> str:
    try:
        await probe()
        return "ok"
    except Exception:
        return "error"


@app.get("/health")
async def health_check():
    details = {
        "mongodb": await _check(lambda: event_service.db.command("ping")),
        "redis": await _check(event_service.redis_client.ping),
        "elasticsearch": await _check(recommendation_service.es_client.ping),
    }
    return {
        "status": "ok" if all(v == "ok" for v in details.values()) else "degraded",
        "service": "personalization-service",
        "timestamp": datetime.utcnow().isoformat(),
        "details": details,
    }
