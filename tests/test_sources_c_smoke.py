
from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app
from tests.fixtures.workspace_paths import FIXTURE_FULL_ID


def _find_physical_property(material: dict, property_name: str) -> dict:
    for item in material.get("physical_properties", {}).get("properties", []):
        if item.get("property_name") == property_name:
            return item
    raise KeyError(property_name)


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


def test_c_smoke_sources_create_editor_edit_delete(
    isolated_smoke_env,
    clear_app_state_cache,
) -> None:
    source_name = "C-SMOKE Source"
    edited_name = "C-SMOKE Source (edited)"
    mat_id = FIXTURE_FULL_ID

    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200

        materials = client.get("/api/materials")
        assert materials.status_code == 200
        mat_list = materials.json()
        assert mat_list
        assert any(item["id"] == mat_id for item in mat_list)

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
        modulus = _find_physical_property(material, "modulus_elasticity")
        modulus["source_ref_id"] = source_id
        modulus["property_subsource"] = source_name
        saved = client.put(f"/api/materials/{mat_id}", json=material)
        assert saved.status_code == 200

        listed = client.get("/api/sources").json()["property_sources"]
        reloaded = client.get(f"/api/materials/{mat_id}").json()
        resolved = _resolve_property_source_name(
            _find_physical_property(reloaded, "modulus_elasticity"),
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
            _find_physical_property(
                client.get(f"/api/materials/{mat_id}").json(),
                "modulus_elasticity",
            ),
            listed_after_edit,
        )
        assert resolved_after_edit == edited_name

        material_before_delete = client.get(f"/api/materials/{mat_id}").json()
        modulus = _find_physical_property(material_before_delete, "modulus_elasticity")
        modulus["source_ref_id"] = ""
        modulus["property_subsource"] = ""
        assert client.put(f"/api/materials/{mat_id}", json=material_before_delete).status_code == 200

        deleted = client.delete(f"/api/sources/{source_id}")
        assert deleted.status_code == 200
        assert deleted.json()["ok"] is True
        assert edited_name not in _property_source_names(client)
