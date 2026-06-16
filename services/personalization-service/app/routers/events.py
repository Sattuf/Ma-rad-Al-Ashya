from fastapi import APIRouter, Depends, status
from app.core.security import get_current_user
from app.models.event import EventCreate, EventResponse
from app.services.event_service import event_service

router = APIRouter(prefix="/events", tags=["events"])

@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event: EventCreate,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["userId"]
    
    # Call the event service to write event and clear Redis cache
    saved = await event_service.save_event(
        user_id=user_id,
        event_type=event.event_type,
        listing_id=event.listing_id,
        category_id=event.category_id,
        search_query=event.search_query,
        metadata=event.metadata
    )
    
    return saved
