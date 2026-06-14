from fastapi import FastAPI
from datetime import datetime

app = FastAPI(
    title="Fraud Detection Service",
    description="خدمة كشف الاحتيال — Fraud Detection Service for Ma'rad Al-Ashya'",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "fraud-service",
        "timestamp": datetime.utcnow().isoformat(),
    }
