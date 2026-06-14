from fastapi import FastAPI
from datetime import datetime

app = FastAPI(
    title="Personalization Service",
    description="خدمة التخصيص — Personalization & Recommendation Service for Ma'rad Al-Ashya'",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "personalization-service",
        "timestamp": datetime.utcnow().isoformat(),
    }
