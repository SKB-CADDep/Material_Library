
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_app_state
from backend.main import app
from backend.settings import MATERIALS_DIR_ENV
from src.core.schema_keys import Schema
from src.infrastructure.storage_backend import SOURCE_JSON_NAME, LocalDirectoryStorage
from src.services.material_repository import MaterialRepository
from src.services.source_service import SourceService


def _minimal_material_json(material_id: str = "mat-fs4-001", name: str = "Сталь FS4") -> dict:
    return {
        "material_id": material_id,
        Schema.METADATA: {
            Schema.NAME_STD: name,
            Schema.NAME_ALT: [],
            Schema.APP_AREA: [],
        },
        Schema.PHYSICAL: {},
        Schema.MECHANICAL: {Schema.STRENGTH_CAT: []},
        Schema.CHEMICAL: {Schema.COMPOSITION: []},
    }


def _seed_workspace(directory: Path) -> None:
    (directory / "source.json").write_text(
        json.dumps(
            {
                "property_sources": [],
                "strength_sources": [],
                "chemical_sources": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (directory / "material-fs4.json").write_text(
        json.dumps(_minimal_material_json(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def test_list_material_paths_excludes_source_json(tmp_path: Path) -> None:
    _seed_workspace(tmp_path)

    paths = LocalDirectoryStorage(tmp_path).list_material_paths()

    names = [p.name for p in paths]
    assert SOURCE_JSON_NAME not in names
    assert "material-fs4.json" in names
    assert len(paths) == 1


def test_repository_load_excludes_source_json(tmp_path: Path) -> None:
    _seed_workspace(tmp_path)

    repo = MaterialRepository(storage=LocalDirectoryStorage(tmp_path))
    repo.load_materials_from_dir(tmp_path)

    assert len(repo.materials) == 1
    assert repo.materials[0].filename == "material-fs4.json"
    assert all(m.filename != SOURCE_JSON_NAME for m in repo.materials)


def test_api_materials_list_excludes_source_json(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_workspace(tmp_path)
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(tmp_path))
    get_app_state.cache_clear()

    with TestClient(app) as client:
        response = client.get("/api/materials")

    assert response.status_code == 200
    items = response.json()
    filenames = [item["filename"] for item in items]
    assert SOURCE_JSON_NAME not in filenames
    assert "material-fs4.json" in filenames
    assert len(items) == 1


def test_source_json_in_workspace_after_fs2_still_excluded(tmp_path: Path) -> None:
    workspace = tmp_path / "data"
    workspace.mkdir()
    _seed_workspace(workspace)

    from backend.dependencies import AppState, open_workspace
    from backend.settings import DataPathsConfig

    state = AppState(
        sources=SourceService(workspace / "source.json"),
        data_paths=DataPathsConfig(materials_dir=None, source_json_path=None),
    )
    open_workspace(state, workspace)

    assert state.sources.filepath_path == (workspace / "source.json").resolve()
    assert len(state.repository.materials) == 1
    assert state.repository.materials[0].filename != SOURCE_JSON_NAME
