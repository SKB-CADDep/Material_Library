from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app
from tests.fixtures.workspace_paths import FIXTURE_FULL_ID


def test_smoke_workspace_temperature_save_calc(
    isolated_smoke_env,
    clear_app_state_cache,
) -> None:
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
        mat_id = FIXTURE_FULL_ID

        temp = client.post(
            "/api/selection/temperature",
            json={"prop_type": "physical", "temperature": 20},
        )
        assert temp.status_code == 200
        temp_body = temp.json()
        assert isinstance(temp_body.get("columns"), list) and temp_body["columns"]
        assert isinstance(temp_body.get("rows"), list)

        material = client.get(f"/api/materials/{mat_id}").json()
        meta_key = "name_material_standard"
        original_name = material["metadata"][meta_key]
        material["metadata"][meta_key] = f"{original_name} [d7-smoke]"

        saved = client.put(f"/api/materials/{mat_id}", json=material)
        assert saved.status_code == 200
        reloaded = client.get(f"/api/materials/{mat_id}").json()
        assert "[d7-smoke]" in reloaded["metadata"][meta_key]

        material["metadata"][meta_key] = original_name
        assert client.put(f"/api/materials/{mat_id}", json=material).status_code == 200

        calc = client.post(
            "/api/selection/calculate",
            json={
                "material_id": FIXTURE_FULL_ID,
                "category_index": 0,
                "custom_temperatures": [150.0],
            },
        )
        assert calc.status_code == 200
        calc_body = calc.json()
        assert calc_body.get("db_rows")
        assert calc_body.get("custom_rows")
