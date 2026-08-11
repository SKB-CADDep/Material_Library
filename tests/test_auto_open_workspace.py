from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_app_state, try_auto_open_workspace
from backend.main import app
from backend.settings import MATERIALS_DIR_ENV


@pytest.fixture
def clear_app_state_cache():
    get_app_state.cache_clear()
    yield
    get_app_state.cache_clear()


def test_try_auto_open_workspace_from_materials_dir(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    clear_app_state_cache,
):
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(tmp_path))

    state = get_app_state()
    assert try_auto_open_workspace(state) is True
    assert state.repository is not None
    assert Path(state.repository.work_dir).resolve() == tmp_path.resolve()


def test_health_reports_workspace_after_lifespan_auto_open(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    clear_app_state_cache,
):
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(tmp_path))

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["workspace"] == str(tmp_path.resolve())
    assert payload["materials_dir"] == str(tmp_path)


def test_auto_open_skipped_without_materials_dir(
    monkeypatch: pytest.MonkeyPatch,
    clear_app_state_cache,
):
    monkeypatch.delenv(MATERIALS_DIR_ENV, raising=False)

    state = get_app_state()
    assert try_auto_open_workspace(state) is False
    assert state.repository is None


def test_auto_open_skipped_when_materials_dir_invalid(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    clear_app_state_cache,
):
    missing = tmp_path / "missing"
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(missing))

    state = get_app_state()
    assert state.data_paths is not None
    assert state.data_paths.materials_dir is None
    assert try_auto_open_workspace(state) is False
    assert state.repository is None

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["workspace"] is None
    assert payload["materials_dir"] == str(missing)
