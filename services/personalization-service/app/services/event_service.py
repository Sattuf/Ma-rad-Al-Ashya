from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as aioredis
import logging
from app.core.config import settings

logger = logging.getLogger("event_service")

class EventService:
    def __init__(self):
        # Never log the URI itself: it contains the database password.
        logger.info("Connecting to MongoDB")
        self.client = AsyncIOMotorClient(settings.MONGODB_URI)

        # Determine the database name. If not present in URI, default to 'marad_db'
        db_name = self.client.get_default_database(default="marad_db").name
        if db_name == "admin":
            db_name = "marad_db"
            
        self.db = self.client[db_name]
        self.collection = self.db["user_events"]
        
        logger.info(f"Connecting to Redis at: {settings.REDIS_URL}")
        self.redis_client = aioredis.from_url(settings.REDIS_URL)

    async def init_indices(self):
        try:
            # Index user_id and created_at to speed up event history queries
            user_idx = await self.collection.create_index("user_id")
            time_idx = await self.collection.create_index("created_at")
            logger.info(f"MongoDB indices initialized: {user_idx}, {time_idx}")
        except Exception as e:
            logger.error(f"Error initializing MongoDB indices: {str(e)}")

    async def save_event(
        self,
        user_id: str,
        event_type: str,
        listing_id: str = None,
        category_id: str = None,
        search_query: str = None,
        metadata: dict = None
    ) -> dict:
        event_doc = {
            "user_id": user_id,
            "event_type": event_type,
            "listing_id": listing_id,
            "category_id": category_id,
            "search_query": search_query,
            "metadata": metadata or {},
            "created_at": datetime.utcnow()
        }
        
        # Save document to MongoDB 'user_events' collection
        result = await self.collection.insert_one(event_doc)
        
        # Convert _id to string for serialization
        event_doc["id"] = str(result.inserted_id)
        if "_id" in event_doc:
            del event_doc["_id"]
            
        # Invalidate the Redis cache for recommendations
        cache_key = f"recommendations:{user_id}"
        try:
            await self.redis_client.delete(cache_key)
            logger.debug(f"Invalidated Redis cache key: {cache_key}")
        except Exception as e:
            logger.error(f"Failed to invalidate Redis cache key {cache_key}: {str(e)}")
            
        return event_doc

# Singleton instance of EventService
event_service = EventService()
