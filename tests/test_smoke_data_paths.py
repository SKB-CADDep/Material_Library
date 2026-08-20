from __future__ import annotations

from pathlib import Path

from src.infrastructure.storage_backend import SOURCE_JSON_NAME
from tests.fixtures.workspace_factory import prepare_smoke_workspace
from tests.fixtures.workspace_paths import WORKSPACE_MIN_DIR


def test_workspace_min_fixture_covers_smoke_cases() -> None:
    assert WORKSPACE_MIN_DIR.is_dir(), WORKSPACE_MIN_DIR

    material_files = sorted(
        path
        for path in WORKSPACE_MIN_DIR.iterdir()
        if path.is_file() and path.suffix.lower() == ".json" and path.name != SOURCE_JSON_NAME
    )
    assert len(material_files) >= 2, "workspace_min must contain at least 2 material JSON files"
    assert (WORKSPACE_MIN_DIR / SOURCE_JSON_NAME).is_file()

    from src.core.models.material import Material

    has_kp = False
    has_composition = False
    has_without_composition = False

    for path in material_files:
        material = Material(filepath=str(path))
        categories = material.get_strength_categories()
        compositions = material.data.get("chemical_properties", {}).get("composition") or []

        if categories:
            has_kp = True
        if compositions:
            has_composition = True
        if not compositions:
            has_without_composition = True

    assert has_kp, "workspace_min must include material with strength category"
    assert has_composition, "workspace_min must include material with composition"
    assert has_without_composition, "workspace_min must include material without composition"


def test_prepare_smoke_workspace_copies_fixture_json(tmp_path: Path) -> None:
    workspace = prepare_smoke_workspace(tmp_path / "materials")
    assert workspace != WORKSPACE_MIN_DIR.resolve()
    assert (workspace / "FixtureFull.json").is_file()
    assert (workspace / SOURCE_JSON_NAME).is_file()


def test_open_workspace_uses_isolated_copy(client, workspace_dir, open_workspace) -> None:
    assert workspace_dir.resolve() != WORKSPACE_MIN_DIR.resolve()
    assert Path(open_workspace["directory"]).resolve() == workspace_dir
    materials = client.get("/api/materials").json()
    assert materials
    assert all(item["filename"] != SOURCE_JSON_NAME for item in materials)


def test_smoke_flow_with_materials_dir(isolated_smoke_env, clear_app_state_cache) -> None:
    from fastapi.testclient import TestClient

    from backend.main import app
    from src.infrastructure.storage_backend import SOURCE_JSON_NAME

    workspace = isolated_smoke_env

    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["workspace"] == str(workspace)

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

    assert "[smoke]" not in (WORKSPACE_MIN_DIR / "FixtureFull.json").read_text(encoding="utf-8")
