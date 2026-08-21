from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

PropType = str


def _post_temperature(
    client: TestClient,
    *,
    prop_type: PropType = "physical",
    temperature: float = 20.0,
    areas: list[str] | None = None,
) -> dict:
    body: dict = {"prop_type": prop_type, "temperature": temperature}
    if areas is not None:
        body["areas"] = areas
    response = client.post("/api/selection/temperature", json=body)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("prop_type", ["physical", "mechanical", "hardness"])
def test_d2_temperature_columns_have_display_symbol(
    client,
    open_workspace,
    prop_type: PropType,
) -> None:
    payload = _post_temperature(client, prop_type=prop_type)
    columns = payload.get("columns") or []
    assert columns, f"{prop_type}: expected property columns"
    assert all(col.get("key") and col.get("label") for col in columns)
    assert all(
        isinstance(col.get("display_symbol"), str) and col["display_symbol"].strip()
        for col in columns
    )


@pytest.mark.parametrize("prop_type", ["physical", "mechanical", "hardness"])
def test_d2_temperature_units_catalog_for_columns(
    client,
    open_workspace,
    prop_type: PropType,
) -> None:
    payload = _post_temperature(client, prop_type=prop_type)
    unit_types = {
        col["unit_type"]
        for col in payload.get("columns") or []
        if col.get("unit_type")
    }
    if prop_type == "hardness":
        assert unit_types, "hardness columns should declare unit_type"
    elif not unit_types:
        pytest.skip(f"{prop_type}: no unit_type columns in smoke workspace")

    for unit_type in unit_types:
        response = client.get(f"/api/catalogs/units/{unit_type}")
        assert response.status_code == 200, unit_type
        data = response.json()
        assert data["units"]
        assert data.get("system_unit")
        assert isinstance(data.get("display_labels"), dict)
        assert data["display_labels"]


def test_temperature_rows_structure(client, open_workspace) -> None:
    payload = _post_temperature(client)
    rows = payload.get("rows") or []
    if not rows:
        pytest.skip("smoke workspace has no temperature selection rows")

    columns = payload["columns"]
    sample = rows[0]
    assert sample.get("material_id")
    assert sample.get("material_name")
    assert isinstance(sample.get("values"), dict)

    value_key = columns[0]["key"]
    assert value_key in sample["values"]


def test_temperature_areas_filter(client, open_workspace) -> None:
    all_payload = _post_temperature(client)
    all_rows = all_payload.get("rows") or []
    if not all_rows:
        pytest.skip("smoke workspace has no temperature selection rows")

    workspace = client.get("/api/workspace").json()
    areas = workspace.get("application_areas") or []
    if not areas:
        pytest.skip("workspace has no application areas")

    matched = _post_temperature(client, areas=[areas[0]])
    assert len(matched.get("rows") or []) <= len(all_rows)

    empty = _post_temperature(client, areas=["__no_such_area__"])
    assert empty.get("rows") == []


def test_temperature_unknown_prop_type_returns_422(
    client,
    open_workspace,
) -> None:
    response = client.post(
        "/api/selection/temperature",
        json={"prop_type": "invalid", "temperature": 20},
    )
    assert response.status_code == 422
