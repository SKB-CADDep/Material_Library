"""Общие фикстуры pytest для Material Library."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_app_state
from backend.main import app
from backend.settings import MATERIALS_DIR_ENV
from tests.fixtures.workspace_factory import prepare_smoke_workspace
from tests.fixtures.workspace_paths import (
    FIXTURE_FULL_ID,
    FIXTURE_KP_ONLY_ID,
    WORKSPACE_MIN_DIR,
)

# Корень репозитория — родитель каталога tests/
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def clear_app_state_cache():
    get_app_state.cache_clear()
    yield
    get_app_state.cache_clear()


@pytest.fixture
def workspace_dir(tmp_path: Path) -> Path:
    return prepare_smoke_workspace(tmp_path / "materials")


@pytest.fixture
def open_workspace(client, workspace_dir):
    if not WORKSPACE_MIN_DIR.is_dir():
        pytest.skip(f"Fixture workspace not found: {WORKSPACE_MIN_DIR}")
    response = client.post(
        "/api/workspace/open",
        json={"directory": str(workspace_dir)},
    )
    assert response.status_code == 200
    payload = response.json()
    assert Path(payload["directory"]).resolve() == workspace_dir
    return payload


@pytest.fixture
def isolated_smoke_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    clear_app_state_cache,
):
    workspace = prepare_smoke_workspace(tmp_path / "materials")
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(workspace))
    return workspace


def _material_summary(client: TestClient, material_id: str) -> dict:
    materials = client.get("/api/materials").json()
    for item in materials:
        if item["id"] == material_id:
            return item
    raise AssertionError(f"Material {material_id} not found in workspace")


def _material_detail(client: TestClient, material_id: str) -> dict:
    response = client.get(f"/api/materials/{material_id}")
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def material_with_composition(client, open_workspace) -> str:
    """Material from workspace_min with chemical composition (FixtureFull)."""
    summary = _material_summary(client, FIXTURE_FULL_ID)
    assert summary.get("has_composition"), "FixtureFull must expose has_composition"
    detail = _material_detail(client, FIXTURE_FULL_ID)
    compositions = (detail.get("chemical_properties") or {}).get("composition") or []
    assert compositions, "FixtureFull must contain composition entries"
    return FIXTURE_FULL_ID


@pytest.fixture
def material_with_strength_category(client, open_workspace) -> str:
    """Material from workspace_min with strength categories (FixtureKpOnly)."""
    detail = _material_detail(client, FIXTURE_KP_ONLY_ID)
    categories = (detail.get("mechanical_properties") or {}).get("strength_category") or []
    assert categories, "FixtureKpOnly must contain strength categories"
    return FIXTURE_KP_ONLY_ID


@pytest.fixture
def material_id(material_with_composition) -> str:
    """Default editable material: FixtureFull (composition + strength category)."""
    return material_with_composition


@pytest.fixture(autouse=True)
def reset_workspace():
    state = get_app_state()
    state.repository = None
    state.storage = None
    yield
    state.repository = None
    state.storage = None
