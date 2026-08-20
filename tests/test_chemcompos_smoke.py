from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app
from tests.fixtures.workspace_paths import FIXTURE_FULL_ID


def test_gate_smoke_chem_composition_entries(
    isolated_smoke_env,
    clear_app_state_cache,
) -> None:
    workspace = isolated_smoke_env

    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["workspace"] == str(workspace)

        materials = client.get("/api/materials")
        assert materials.status_code == 200
        mat_list = materials.json()
        assert mat_list

        with_composition = [item for item in mat_list if item.get("has_composition")]
        assert with_composition, "smoke workspace should include material with composition"
        assert any(item["id"] == FIXTURE_FULL_ID for item in with_composition)

        response = client.get("/api/selection/chem/composition-entries")
        assert response.status_code == 200
        body = response.json()
        entries = body.get("entries")
        assert isinstance(entries, list)
        assert len(entries) >= 1

        material_ids_with_comp = {item["id"] for item in with_composition}
        for entry in entries:
            assert entry["material_id"] in material_ids_with_comp
            assert isinstance(entry["material_name"], str) and entry["material_name"]
            assert isinstance(entry["areas"], list)
            composition = entry["composition"]
            assert isinstance(composition, dict)
            assert composition.get("other_elements") or composition.get("base_element")

        first_id = FIXTURE_FULL_ID
        detail = client.get(f"/api/materials/{first_id}")
        assert detail.status_code == 200
        chem = detail.json().get("chemical_properties") or {}
        detail_compositions = chem.get("composition") or []
        assert len(detail_compositions) >= len(
            [e for e in entries if e["material_id"] == first_id]
        )
