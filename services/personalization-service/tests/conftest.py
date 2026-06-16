import pytest
from unittest.mock import AsyncMock, MagicMock

@pytest.fixture(autouse=True)
def mock_services(monkeypatch):
    # Mock MongoDB db and collection
    mock_db = AsyncMock()
    mock_db.command.return_value = {"ok": 1.0}
    
    mock_collection = AsyncMock()
    # Mock cursor return value for event querying
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[
        {"event_type": "view", "listing_id": "listing-1", "category_id": "category-1"}
    ])
    mock_collection.find.return_value = mock_cursor
    mock_collection.insert_one = AsyncMock(return_value=MagicMock(inserted_id="event-uuid-123"))
    mock_collection.create_index = AsyncMock(return_value="index_created")
    
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
    
    from app.services.event_service import event_service
    from app.services.recommendation_service import recommendation_service
    
    monkeypatch.setattr(event_service, "db", mock_db)
    monkeypatch.setattr(event_service, "collection", mock_collection)
    monkeypatch.setattr(event_service, "redis_client", mock_redis)
    
    monkeypatch.setattr(recommendation_service, "es_client", mock_es)
    monkeypatch.setattr(recommendation_service, "redis_client", mock_redis)
    
    return {
        "db": mock_db,
        "collection": mock_collection,
        "redis": mock_redis,
        "es": mock_es
    }
