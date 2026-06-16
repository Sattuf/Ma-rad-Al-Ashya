from fastapi import FastAPI, Depends, Request
from datetime import datetime
from app.models.event import EventCreate
from app.services.event_service import event_service
from app.services.recommendation_service import recommendation_service
from app.core.security import get_current_user
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from app.core.config import settings
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

security_scheme = HTTPBearer(auto_error=False)

def get_current_user_optional(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    if not credentials:
        return {"userId": "anonymous", "email": None, "role": None}
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.JWT_ACCESS_SECRET,
            algorithms=["HS256"]
        )
        user_id = payload.get("sub")
        if not user_id:
            return {"userId": "anonymous", "email": None, "role": None}
        return {
            "userId": user_id,
            "email": payload.get("email"),
            "role": payload.get("role")
        }
    except Exception:
        return {"userId": "anonymous", "email": None, "role": None}

@app.on_event("startup")
async def startup_event():
    await event_service.init_indices()

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "personalization-service",
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.post("/events")
async def create_event(
    event: EventCreate,
    current_user: dict = Depends(get_current_user_optional)
):
    user_id = current_user["userId"]
    saved = await event_service.save_event(
        user_id=user_id,
        event_type=event.event_type,
        listing_id=event.listing_id,
        category_id=event.category_id,
        search_query=event.search_query,
        metadata=event.metadata
    )
    return saved

@app.get("/recommendations")
async def get_recommendations(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["userId"]
    return await recommendation_service.get_recommendations(user_id=user_id, limit=limit)
