from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_app_state
from backend.main import app
from backend.settings import MATERIALS_DIR_ENV
from src.infrastructure.storage_backend import SOURCE_JSON_NAME

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"


@pytest.fixture
def clear_app_state_cache():
    get_app_state.cache_clear()
    yield
    get_app_state.cache_clear()


def _prepare_smoke_workspace(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    shutil.copy2(DATA_DIR / "20К.json", target / "20К.json")
    root_source = PROJECT_ROOT / "source.json"
    if root_source.is_file():
        shutil.copy2(root_source, target / SOURCE_JSON_NAME)
    else:
        (target / SOURCE_JSON_NAME).write_text(
            json.dumps(
                {
                    "property_sources": [],
                    "strength_sources": [],
                    "chemical_sources": [],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )


def test_fs5_smoke_flow_with_materials_dir(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    clear_app_state_cache,
) -> None:
    workspace = tmp_path / "materials"
    _prepare_smoke_workspace(workspace)
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(workspace))

    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["workspace"] == str(workspace.resolve())

        ws = client.get("/api/workspace")
        assert ws.status_code == 200
        assert ws.json()["count"] >= 1

        materials = client.get("/api/materials")
        assert materials.status_code == 200
        mat_list = materials.json()
        assert mat_list
        assert all(item["filename"] != SOURCE_JSON_NAME for item in mat_list)
        mat_id = mat_list[0]["id"]

        created = client.post(
            "/api/sources",
            json={
                "group": "property_sources",
                "name": "smoke source",
                "description": "smoke",
                "hyperlink": "https://example.com/smoke",
            },
        )
        assert created.status_code == 201
        source_id = created.json()["id_source"]
        assert (workspace / SOURCE_JSON_NAME).is_file()

        listed = client.get("/api/sources")
        assert listed.status_code == 200
        names = [s["name_source"] for s in listed.json()["property_sources"]]
        assert "smoke source" in names

        updated = client.put(
            f"/api/sources/{source_id}",
            json={
                "name": "smoke source (updated)",
                "description": "smoke",
                "hyperlink": "",
            },
        )
        assert updated.status_code == 200
        assert updated.json()["name_source"] == "smoke source (updated)"

        body = client.get(f"/api/materials/{mat_id}")
        assert body.status_code == 200
        payload = body.json()
        meta_key = "name_material_standard"
        original_name = payload["metadata"][meta_key]
        payload["metadata"][meta_key] = f"{original_name} [smoke]"

        saved = client.put(f"/api/materials/{mat_id}", json=payload)
        assert saved.status_code == 200

        reloaded = client.get(f"/api/materials/{mat_id}").json()
        assert "[smoke]" in reloaded["metadata"][meta_key]

        payload["metadata"][meta_key] = original_name
        client.put(f"/api/materials/{mat_id}", json=payload)

        deleted = client.delete(f"/api/sources/{source_id}")
        assert deleted.status_code == 200
        assert deleted.json()["ok"] is True
