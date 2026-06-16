from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class EventType(str, Enum):
    VIEW = "view"
    FAVORITE = "favorite"
    MESSAGE = "message"
    SEARCH = "search"
    PURCHASE = "purchase"

class EventCreate(BaseModel):
    event_type: EventType = Field(..., alias="eventType")
    listing_id: Optional[str] = Field(default=None, alias="listingId")
    category_id: Optional[str] = Field(default=None, alias="categoryId")
    search_query: Optional[str] = Field(default=None, alias="searchQuery")
    metadata: Optional[Dict[str, Any]] = Field(default=None)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "eventType": "view",
                "listingId": "c9a6b5a3-0000-0000-0000-000000000000",
                "categoryId": "a1b2c3d4-0000-0000-0000-000000000000",
                "searchQuery": "cars",
                "metadata": {"source": "web"}
            }
        }
    }

class EventResponse(BaseModel):
    id: str = Field(..., alias="id")
    user_id: str = Field(..., alias="userId")
    event_type: EventType = Field(..., alias="eventType")
    listing_id: Optional[str] = Field(default=None, alias="listingId")
    category_id: Optional[str] = Field(default=None, alias="categoryId")
    search_query: Optional[str] = Field(default=None, alias="searchQuery")
    metadata: Optional[Dict[str, Any]] = Field(default=None)
    created_at: datetime = Field(..., alias="createdAt")

    model_config = {
        "populate_by_name": True
    }
