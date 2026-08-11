from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_app_state
from backend.main import app
from backend.settings import MATERIALS_DIR_ENV
from tests.test_smoke_data_paths import _prepare_smoke_workspace


@pytest.fixture
def clear_app_state_cache():
    get_app_state.cache_clear()
    yield
    get_app_state.cache_clear()


def _find_material_with_calc_rows(client: TestClient) -> str:
    for item in client.get("/api/materials").json():
        material_id = item["id"]
        detail = client.get(f"/api/materials/{material_id}").json()
        categories = (detail.get("mechanical_properties") or {}).get("strength_category") or []
        if not categories:
            continue
        response = client.post(
            "/api/selection/calculate",
            json={
                "material_id": material_id,
                "category_index": 0,
                "custom_temperatures": [],
            },
        )
        if response.status_code == 200 and response.json().get("db_rows"):
            return material_id
    pytest.skip("No material with calculation rows in smoke workspace")


def test_d7_gate_smoke_workspace_temperature_save_calc(
    tmp_path,
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
        mat_id = mat_list[0]["id"]

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

        calc_material_id = _find_material_with_calc_rows(client)
        calc = client.post(
            "/api/selection/calculate",
            json={
                "material_id": calc_material_id,
                "category_index": 0,
                "custom_temperatures": [150.0],
            },
        )
        assert calc.status_code == 200
        calc_body = calc.json()
        assert calc_body.get("db_rows")
        assert calc_body.get("custom_rows")
