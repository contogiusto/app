from fastapi.testclient import TestClient

from app.db import get_db
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db():
    class FakeSession:
        def execute(self, _statement):
            return None

    app.dependency_overrides[get_db] = lambda: FakeSession()
    try:
        response = client.get("/api/health/db")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
