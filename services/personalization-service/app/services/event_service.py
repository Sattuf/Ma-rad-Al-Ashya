import json
import logging
from typing import Optional
from uuid import UUID

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.db import db

logger = logging.getLogger("event_service")

# Events that change what we should recommend right away. Views and searches are the bulk of
# the traffic: invalidating on each one would make the recommendations cache useless for
# anyone browsing (every request a fresh Postgres + Elasticsearch computation). They are
# picked up when the cached result expires (RECOMMENDATIONS_TTL_SECONDS).
STRONG_SIGNALS = {"favorite", "message", "purchase"}

# How far back and how many events shape recommendations. The time bound lets Postgres
# prune older monthly partitions; the row bound caps the work for very active users.
SIGNAL_WINDOW_DAYS = 90
SIGNAL_EVENT_LIMIT = 200
HALF_LIFE_DAYS = 14

# One round trip: the user's latest events (index (user_id, created_at DESC) on each recent
# partition, merged in order and stopped at the limit), then two aggregates over them:
#   - category scores: each event weighted by its strength and halved every HALF_LIFE_DAYS;
#   - listings already seen, to exclude from recommendations.
SIGNALS_SQL = f"""
WITH recent AS (
  SELECT event_type, listing_id, category_id, created_at
  FROM user_events
  WHERE user_id = $1 AND created_at > now() - interval '{SIGNAL_WINDOW_DAYS} days'
  ORDER BY created_at DESC
  LIMIT {SIGNAL_EVENT_LIMIT}
), scored AS (
  SELECT category_id,
         sum(
           CASE event_type
             WHEN 'purchase' THEN 5 WHEN 'message' THEN 4 WHEN 'favorite' THEN 3
             WHEN 'view' THEN 1 ELSE 0.5
           END
           * power(0.5, extract(epoch FROM now() - created_at) / ({HALF_LIFE_DAYS} * 86400.0))
         ) AS score
  FROM recent
  WHERE category_id IS NOT NULL
  GROUP BY category_id
)
SELECT
  coalesce((SELECT array_agg(category_id::text ORDER BY score DESC) FROM (
    SELECT category_id, score FROM scored ORDER BY score DESC LIMIT 5
  ) top), '{{}}') AS categories,
  coalesce((SELECT array_agg(DISTINCT listing_id::text) FROM recent WHERE listing_id IS NOT NULL), '{{}}') AS seen
"""


class EventService:
    def __init__(self):
        logger.info(f"Connecting to Redis at: {settings.REDIS_URL}")
        self.redis_client = aioredis.from_url(settings.REDIS_URL)

    async def save_event(
        self,
        user_id: str,
        event_type: str,
        listing_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        search_query: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        row = await db.fetchrow(
            """
            INSERT INTO user_events (user_id, event_type, listing_id, category_id, search_query, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            RETURNING id, created_at
            """,
            UUID(user_id),
            event_type,
            listing_id,
            category_id,
            search_query,
            json.dumps(metadata or {}),
        )

        if event_type in STRONG_SIGNALS:
            cache_key = f"recommendations:{user_id}"
            try:
                await self.redis_client.delete(cache_key)
            except Exception as e:
                logger.error(f"Failed to invalidate Redis cache key {cache_key}: {str(e)}")

        return {
            "id": str(row["id"]),
            "user_id": user_id,
            "event_type": event_type,
            "listing_id": str(listing_id) if listing_id else None,
            "category_id": str(category_id) if category_id else None,
            "search_query": search_query,
            "metadata": metadata or {},
            "created_at": row["created_at"],
        }

    async def user_signals(self, user_id: str) -> dict:
        """Top categories (best first) and listings already seen, from recent events."""
        row = await db.fetchrow(SIGNALS_SQL, UUID(user_id))
        return {"categories": list(row["categories"]), "seen_listings": list(row["seen"])}

    async def maintain_partitions(self, keep_months: int = 6) -> int:
        """Creates the coming monthly partitions and drops expired ones (see migration 0003)."""
        await db.fetchval("SELECT ensure_user_event_partitions(2)")
        return await db.fetchval("SELECT prune_user_event_partitions($1)", keep_months)


# Singleton instance of EventService
event_service = EventService()
