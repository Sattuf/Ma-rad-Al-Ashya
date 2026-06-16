from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user
from app.services.recommendation_service import recommendation_service

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

@router.get("")
async def get_recommendations(
    limit: int = Query(default=20, ge=1, le=20),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["userId"]
    res = await recommendation_service.get_recommendations(user_id=user_id, limit=limit)
    return res

@router.get("/cold-start")
async def get_cold_start(
    limit: int = Query(default=20, ge=1, le=20)
):
    listings = await recommendation_service.get_cold_start(limit=limit)
    return {
        "listings": listings,
        "based_on": "cold_start"
    }
