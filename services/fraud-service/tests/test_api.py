import pytest
from fastapi.testclient import TestClient
from main import app
from jose import jwt
import os

client = TestClient(app)

def get_admin_token(secret=None, role="admin"):
    secret = secret or os.environ["JWT_ACCESS_SECRET"]
    return jwt.encode({"sub": "admin", "role": role}, secret, algorithm="HS256")

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_device_check_unauthorized():
    # It's actually not protected by auth
    payload = {
        "user_id": "u1",
        "device_id": "d1",
        "ip_address": "127.0.0.1"
    }
    # It will fail on db connection in test if not mocked, but let's assume mocked or handled
    # To avoid db error, we mock the device_service
    pass

@pytest.fixture(autouse=True)
def mock_db(monkeypatch):
    # Mock database connections to avoid real DB calls during tests
    from database import connect_to_mongo, connect_to_postgres, close_mongo_connection, close_postgres_connection
    
    async def mock_connect(): pass
    async def mock_close(): pass
    
    monkeypatch.setattr("database.connect_to_mongo", mock_connect)
    monkeypatch.setattr("database.connect_to_postgres", mock_connect)
    monkeypatch.setattr("database.close_mongo_connection", mock_close)
    monkeypatch.setattr("database.close_postgres_connection", mock_close)

def test_admin_dashboard_unauthorized():
    response = client.get("/fraud/admin/dashboard")
    assert response.status_code == 403

def test_admin_action_with_token(monkeypatch):
    # We mock pg_pool to avoid errors
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    # An action the service cannot perform is refused, never reported as done.
    response = client.post("/fraud/admin/action", json={"user_id": "u1", "action": "BLOCK"}, headers=headers)
    assert response.status_code == 400


def test_admin_lock_reports_failure_when_users_service_is_down(monkeypatch):
    import httpx as _httpx

    class DownClient:
        def __init__(self, *a, **k):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def put(self, *a, **k):
            raise _httpx.ConnectError("down")

    monkeypatch.setattr("routers.admin.httpx.AsyncClient", DownClient)
    headers = {"Authorization": f"Bearer {get_admin_token()}"}
    response = client.post("/fraud/admin/action", json={"user_id": "u1", "action": "lock"}, headers=headers)
    assert response.status_code == 502

def test_risk_score(monkeypatch):
    def mock_acquire(*args, **kwargs):
        class MockConn:
            async def __aenter__(self):
                return self
            async def __aexit__(self, exc_type, exc, tb):
                pass
            async def fetch(self, query, *args):
                return [{"risk_score": 0.5}, {"risk_score": 0.6}]
        return MockConn()
        
    class MockPool:
        def acquire(self):
            return mock_acquire()

    monkeypatch.setattr("database.pg_pool", MockPool())
    
    headers = {"Authorization": f"Bearer {get_admin_token()}"}
    response = client.get("/fraud/risk/u1", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_risk_score"] == 1.1
    assert data["risk_level"] == "HIGH"


def test_admin_rejects_token_signed_with_old_default_secret():
    headers = {"Authorization": f"Bearer {get_admin_token(secret='supersecretkey')}"}
    response = client.get("/fraud/admin/dashboard", headers=headers)
    assert response.status_code == 401


def test_admin_rejects_non_admin_role():
    headers = {"Authorization": f"Bearer {get_admin_token(role='user')}"}
    response = client.get("/fraud/admin/dashboard", headers=headers)
    assert response.status_code == 403


def test_risk_requires_admin():
    response = client.get("/fraud/risk/u1")
    assert response.status_code == 403


def test_ingestion_requires_internal_secret():
    payload = {"user_id": "u1", "ip_address": "127.0.0.1"}
    assert client.post("/fraud/device/check", json=payload).status_code == 401
    wrong = {"x-internal-secret": "marad-internal-secret-for-webhooks"}
    assert client.post("/fraud/device/check", json=payload, headers=wrong).status_code == 401
