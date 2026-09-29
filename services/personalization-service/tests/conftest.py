import os

# Test-only secret; must be set before app.core.config is imported.
os.environ.setdefault("JWT_ACCESS_SECRET", "test-access-secret-not-for-production-use")

import pytest
from unittest.mock import AsyncMock, MagicMock

LISTING_1 = "c9a6b5a3-0000-4000-8000-000000000001"
CATEGORY_1 = "a1b2c3d4-0000-4000-8000-000000000001"

@pytest.fixture(autouse=True)
def mock_services(monkeypatch):
    # Mock the Postgres pool: an insert returns the new row, the signals query the
    # aggregated categories / seen listings (the SQL itself runs in test_db_integration.py).
    from datetime import datetime, timezone
    mock_db = MagicMock()
    mock_db.connect = AsyncMock()
    mock_db.close = AsyncMock()
    mock_db.fetchval = AsyncMock(return_value=0)

    async def fetchrow(query, *args):
        if "INSERT INTO user_events" in query:
            return {"id": 123, "created_at": datetime(2026, 9, 29, tzinfo=timezone.utc)}
        return {"categories": [CATEGORY_1], "seen": [LISTING_1]}

    mock_db.fetchrow = AsyncMock(side_effect=fetchrow)

    # Mock Redis client
    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = None  # Cache miss by default
    mock_redis.set.return_value = True
    mock_redis.delete.return_value = True
    
    # Mock Elasticsearch client
    mock_es = AsyncMock()
    mock_es.ping.return_value = True
    mock_es.search.return_value = {
        "hits": {
            "hits": [
                {
                    "_id": "listing-1",
                    "_source": {
                        "title": "Test Listing",
                        "description": "A description",
                        "price": 100.0,
                        "category": "category-1",
                        "createdAt": "2026-06-14T21:00:00"
                    }
                }
            ]
        }
    }
    
    import app.core.db as db_module
    import app.main as main_module
    import app.services.event_service as event_module
    from app.services.event_service import event_service
    from app.services.recommendation_service import recommendation_service

    for module in (db_module, main_module, event_module):
        monkeypatch.setattr(module, "db", mock_db)
    monkeypatch.setattr(event_service, "redis_client", mock_redis)
    
    monkeypatch.setattr(recommendation_service, "es_client", mock_es)
    monkeypatch.setattr(recommendation_service, "redis_client", mock_redis)
    
    return {
        "db": mock_db,
        "redis": mock_redis,
        "es": mock_es
    }
