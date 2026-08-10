"""D3e — smoke «Расчёт отдельно» (API-слой)."""

from __future__ import annotations

import pytest


def _find_material_with_calc_rows(client) -> tuple[str, dict]:
    materials = client.get("/api/materials").json()
    assert materials, "workspace must contain materials"

    for item in materials:
        material_id = item["id"]
        detail = client.get(f"/api/materials/{material_id}").json()
        categories = (
            (detail.get("mechanical_properties") or {}).get("strength_category") or []
        )
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
        if response.status_code != 200:
            continue

        payload = response.json()
        if payload.get("db_rows"):
            return material_id, payload

    pytest.skip("No material with temperature rows for single calculation")


def _pick_custom_temperature(baseline: dict) -> float:
    temps: list[float] = []
    for row in baseline.get("db_rows") or []:
        value = row.get("temperature")
        if isinstance(value, (int, float)):
            temps.append(float(value))
    if len(temps) >= 2:
        return (min(temps) + max(temps)) / 2
    if temps:
        return temps[0] + 50.0
    return 12345.5


@pytest.fixture
def calc_context(client, open_workspace):
    material_id, baseline = _find_material_with_calc_rows(client)
    return {"material_id": material_id, "baseline": baseline}


def test_d3e_calc_columns_have_display_symbol(calc_context):
    columns = calc_context["baseline"]["columns"]
    assert columns, "calculation must expose property columns"
    assert all(col.get("key") and col.get("label") for col in columns)
    assert all(
        isinstance(col.get("display_symbol"), str) and col["display_symbol"].strip()
        for col in columns
    )


def test_d3e_calc_db_rows_structure(calc_context):
    rows = calc_context["baseline"]["db_rows"]
    columns = calc_context["baseline"]["columns"]
    assert rows, "expected db_rows from material data"

    first = rows[0]
    assert "temperature" in first
    assert "values" in first
    assert isinstance(first["values"], dict)

    sample_key = columns[0]["key"]
    cell = first["values"].get(sample_key)
    assert cell is not None
    assert "value" in cell
    assert cell.get("mode") in {"exact", "interp", "approx", "scalar", None}


def test_d3e_calc_custom_temperature_row(client, calc_context):
    material_id = calc_context["material_id"]
    custom_temp = _pick_custom_temperature(calc_context["baseline"])

    response = client.post(
        "/api/selection/calculate",
        json={
            "material_id": material_id,
            "category_index": 0,
            "custom_temperatures": [custom_temp],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["custom_rows"], "custom temperature must produce calc row"
    custom = payload["custom_rows"][0]
    assert custom["temperature"] == custom_temp

    columns = payload["columns"]
    temp_columns = [col for col in columns if col.get("temperature_dependent", True)]
    assert temp_columns, "expected temperature-dependent columns"

    for col in temp_columns:
        cell = custom["values"].get(col["key"])
        assert cell is not None
        if cell.get("value") is None:
            continue
        assert cell.get("mode") in {"exact", "interp", "approx", "scalar"}

    assert any(
        custom["values"].get(col["key"], {}).get("value") is not None
        for col in temp_columns
    ), "custom row should contain at least one computed value"


def test_d3e_calc_units_catalog_for_columns(client, calc_context):
    unit_types = {
        col["unit_type"]
        for col in calc_context["baseline"]["columns"]
        if col.get("unit_type")
    }
    assert unit_types, "at least one column should declare unit_type"

    for unit_type in unit_types:
        response = client.get(f"/api/catalogs/units/{unit_type}")
        assert response.status_code == 200
        data = response.json()
        assert data["units"]
        assert data.get("system_unit")
        assert isinstance(data.get("display_labels"), dict)
        assert data["display_labels"]


def test_d3e_calc_unknown_material_returns_404(client, open_workspace):
    response = client.post(
        "/api/selection/calculate",
        json={
            "material_id": "00000000-0000-4000-8000-000000009999",
            "category_index": 0,
        },
    )
    assert response.status_code == 404


def test_d3e_temperature_selection_regression(client, open_workspace):
    response = client.post(
        "/api/selection/temperature",
        json={"prop_type": "physical", "temperature": 20},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("columns")
    assert isinstance(payload.get("rows"), list)
