import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app
from app.core.config import settings
from tests.conftest import CATEGORY_1, LISTING_1

USER_ID = "5f0c3e1a-0000-4000-8000-000000000123"

def generate_test_token(user_id=USER_ID, email="user@example.com"):
    payload = {
        "sub": user_id,
        "email": email,
        "role": "user"
    }
    return jwt.encode(payload, settings.JWT_ACCESS_SECRET, algorithm="HS256")

@pytest.mark.anyio
async def test_health_check():
    """اختبار نقطة فحص الصحة — Test health check endpoint"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "personalization-service"
    assert "timestamp" in data
    assert "details" in data
    assert data["details"]["postgres"] == "ok"
    assert data["details"]["redis"] == "ok"
    assert data["details"]["elasticsearch"] == "ok"

@pytest.mark.anyio
async def test_create_event_authorized():
    """اختبار إنشاء حدث بمصادقة — Test creating event with authentication"""
    token = generate_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    event_data = {
        "eventType": "view",
        "listingId": LISTING_1,
        "categoryId": CATEGORY_1,
        "metadata": {"custom_key": "custom_val"}
    }
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/events", json=event_data, headers=headers)
        
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "123"
    assert data["userId"] == USER_ID
    assert data["eventType"] == "view"
    assert data["listingId"] == LISTING_1
    assert data["categoryId"] == CATEGORY_1

@pytest.mark.anyio
async def test_create_event_unauthorized():
    """اختبار إنشاء حدث بدون مصادقة — Test creating event without authentication"""
    event_data = {
        "eventType": "view",
        "listingId": LISTING_1
    }
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/events", json=event_data)
        
    # Missing credentials are rejected: FastAPI's HTTPBearer answers 401 in current releases
    # (403 before 0.117). Either way the event must not be accepted.
    assert response.status_code in (401, 403)

@pytest.mark.anyio
async def test_get_recommendations_authorized():
    """اختبار الحصول على التوصيات بمصادقة — Test retrieving recommendations with authentication"""
    token = generate_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/recommendations?limit=5", headers=headers)
        
    assert response.status_code == 200
    data = response.json()
    assert "listings" in data
    assert "based_on" in data
    assert len(data["listings"]) > 0
    assert data["listings"][0]["id"] == "listing-1"

@pytest.mark.anyio
async def test_get_cold_start():
    """اختبار البداية الباردة بدون مصادقة — Test cold-start recommendations without authentication"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/recommendations/cold-start?limit=3")
        
    assert response.status_code == 200
    data = response.json()
    assert "listings" in data
    assert data["based_on"] == "cold_start"
    assert len(data["listings"]) > 0
    assert data["listings"][0]["title"] == "Test Listing"


@pytest.mark.anyio
async def test_create_event_rejects_malformed_ids():
    """A malformed id is a 422 at the edge, never a database error."""
    headers = {"Authorization": f"Bearer {generate_test_token()}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/events", json={"eventType": "view", "listingId": "1; DROP TABLE"}, headers=headers)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_only_strong_signals_invalidate_the_cache(mock_services):
    """Browsing must not wipe the recommendations cache; favorites, messages, purchases do."""
    headers = {"Authorization": f"Bearer {generate_test_token()}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/events", json={"eventType": "view", "listingId": LISTING_1}, headers=headers)
        mock_services["redis"].delete.assert_not_called()
        await client.post("/events", json={"eventType": "favorite", "listingId": LISTING_1}, headers=headers)
    mock_services["redis"].delete.assert_called_once_with(f"recommendations:{USER_ID}")


@pytest.mark.anyio
async def test_recommendations_use_aggregated_categories_and_exclude_seen(mock_services):
    headers = {"Authorization": f"Bearer {generate_test_token()}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/recommendations?limit=5", headers=headers)
    assert response.json()["based_on"] == "frequent_categories"
    query = mock_services["es"].search.call_args.kwargs["body"]["query"]["function_score"]["query"]["bool"]
    assert {"terms": {"id": [LISTING_1]}} in query["must_not"]
    assert CATEGORY_1 in str(query["must"])
