"""Общие фикстуры pytest для Material Library."""
import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

from backend.main import app
from backend.dependencies import get_app_state

# Корень репозитория — родитель каталога tests/
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

DATA_DIR = str("C:/Users/Лиза/Desktop/jbsidian/data")

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def open_workspace(client):
    response = client.post("/api/workspace/open", json={"directory": DATA_DIR})
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def material_id(client, open_workspace):
    materials = client.get("/api/materials").json()
    assert len(materials) > 0
    return materials[0]["id"]


@pytest.fixture(autouse=True)
def reset_workspace():
    state = get_app_state()
    state.repository = None
    state.storage = None
    yield
    state.repository = None
    state.storage = None