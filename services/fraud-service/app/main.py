from fastapi import FastAPI
from datetime import datetime
import os
import sentry_sdk
from prometheus_fastapi_instrumentator import Instrumentator

sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"), traces_sample_rate=0.1)

app = FastAPI(
    title="Fraud Detection Service",
    description="خدمة كشف الاحتيال — Fraud Detection Service for Ma'rad Al-Ashya'",
    version="0.1.0",
)

Instrumentator().instrument(app).expose(app)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "fraud-service",
        "timestamp": datetime.utcnow().isoformat(),
    }
