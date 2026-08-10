

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_app_state
from backend.main import app
from backend.settings import MATERIALS_DIR_ENV
from tests.test_smoke_data_paths import _prepare_smoke_workspace


def _property_source_names(client: TestClient) -> list[str]:
    listed = client.get("/api/sources")
    assert listed.status_code == 200
    return [item["name_source"] for item in listed.json()["property_sources"]]


def _resolve_property_source_name(prop: dict, sources: list[dict]) -> str:
    """Как resolvePropertySourceName во frontend."""
    ref_id = str(prop.get("source_ref_id") or "").strip()
    if ref_id:
        for src in sources:
            if src.get("id_source") == ref_id:
                return str(src.get("name_source") or "")
        return ref_id
    return str(prop.get("property_subsource") or "").strip()


@pytest.fixture
def clear_app_state_cache():
    get_app_state.cache_clear()
    yield
    get_app_state.cache_clear()


def test_c_smoke_sources_create_editor_edit_delete(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
    clear_app_state_cache,
) -> None:
    workspace = tmp_path / "materials"
    _prepare_smoke_workspace(workspace)
    monkeypatch.setenv(MATERIALS_DIR_ENV, str(workspace))

    source_name = "C-SMOKE Source"
    edited_name = "C-SMOKE Source (edited)"

    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200

        materials = client.get("/api/materials")
        assert materials.status_code == 200
        mat_list = materials.json()
        assert mat_list
        mat_id = mat_list[0]["id"]

        created = client.post(
            "/api/sources",
            json={
                "group": "property_sources",
                "name": source_name,
                "description": "28h smoke",
                "hyperlink": "https://example.com/c-smoke",
            },
        )
        assert created.status_code == 201
        created_body = created.json()
        source_id = created_body["id_source"]
        assert created_body["name_source"] == source_name

        assert source_name in _property_source_names(client)

        material = client.get(f"/api/materials/{mat_id}").json()
        modulus = material["physical_properties"]["modulus_elasticity"]
        modulus["source_ref_id"] = source_id
        modulus["property_subsource"] = source_name
        saved = client.put(f"/api/materials/{mat_id}", json=material)
        assert saved.status_code == 200

        listed = client.get("/api/sources").json()["property_sources"]
        reloaded = client.get(f"/api/materials/{mat_id}").json()
        resolved = _resolve_property_source_name(
            reloaded["physical_properties"]["modulus_elasticity"],
            listed,
        )
        assert resolved == source_name

        updated = client.put(
            f"/api/sources/{source_id}",
            json={
                "name": edited_name,
                "description": "28h smoke updated",
                "hyperlink": "https://example.com/c-smoke",
            },
        )
        assert updated.status_code == 200
        assert updated.json()["name_source"] == edited_name
        assert edited_name in _property_source_names(client)
        assert source_name not in _property_source_names(client)

        listed_after_edit = client.get("/api/sources").json()["property_sources"]
        resolved_after_edit = _resolve_property_source_name(
            client.get(f"/api/materials/{mat_id}").json()["physical_properties"][
                "modulus_elasticity"
            ],
            listed_after_edit,
        )
        assert resolved_after_edit == edited_name

        deleted = client.delete(f"/api/sources/{source_id}")
        assert deleted.status_code == 200
        assert deleted.json()["ok"] is True
        assert edited_name not in _property_source_names(client)
