"""API smoke и unit-тесты SelectionService"""

from __future__ import annotations

import pytest

from src.core.models.material import Material
from src.services.properties_catalog import PropertiesCatalog
from src.services.selection_service import SelectionService
from tests.fixtures.workspace_paths import FIXTURE_FULL_ID


class _FakeRepo:
    def __init__(self, materials: list[Material]):
        self.materials = materials
        self.source_manager = None

    def get_by_id(self, material_id: str) -> Material | None:
        for material in self.materials:
            if material.data.get("material_id") == material_id:
                return material
        return None


def _calc_service() -> SelectionService:
    return SelectionService(PropertiesCatalog())


def _calc_material(
    *,
    material_id: str = "calc-mat-1",
    areas: list[str] | None = None,
    strength_categories: list[dict] | None = None,
    physical_properties: list[dict] | None = None,
) -> Material:
    if areas is None:
        areas = ["Конструкционные материалы"]
    if strength_categories is None:
        strength_categories = [
            {
                "value_strength_category": "КП360",
                "properties": [
                    {
                        "property_name": "yield_strength",
                        "temperature_value_pairs": [[20.0, 360.0], [200.0, 300.0]],
                    }
                ],
            },
            {
                "value_strength_category": "КП420",
                "properties": [
                    {
                        "property_name": "yield_strength",
                        "temperature_value_pairs": [[20.0, 420.0], [200.0, 350.0]],
                    }
                ],
            },
        ]
    if physical_properties is None:
        physical_properties = [
            {
                "property_name": "density",
                "temperature_value_pairs": [[20.0, 7800.0], [200.0, 7750.0]],
            }
        ]

    return Material(
        data={
            "material_id": material_id,
            "metadata": {
                "name_material_standard": "CalcSteel",
                "name_material_alternative": [],
                "application_area": areas,
                "classification": {
                    "classification_category": "",
                    "classification_class": "",
                    "classification_subclass": "",
                },
            },
            "physical_properties": {"properties": physical_properties},
            "mechanical_properties": {"strength_category": strength_categories},
            "chemical_properties": {"composition": []},
        }
    )


def test_single_calculation_raises_when_material_missing() -> None:
    service = _calc_service()
    repo = _FakeRepo([])

    with pytest.raises(ValueError, match="Материал не найден"):
        service.single_calculation(repo, "missing-id", 0)


def test_single_calculation_raises_on_invalid_category_index() -> None:
    material = _calc_material()
    service = _calc_service()
    repo = _FakeRepo([material])

    with pytest.raises(ValueError, match="category_index"):
        service.single_calculation(repo, "calc-mat-1", 99)


def test_single_calculation_db_rows_sorted_by_temperature() -> None:
    material = _calc_material(
        physical_properties=[
            {
                "property_name": "density",
                "temperature_value_pairs": [
                    [200.0, 7750.0],
                    [20.0, 7800.0],
                    [100.0, 7775.0],
                ],
            }
        ]
    )
    result = _calc_service().single_calculation(_FakeRepo([material]), "calc-mat-1", 0)

    temps = [row["temperature"] for row in result["db_rows"] if isinstance(row["temperature"], (int, float))]
    assert temps == sorted(temps)


def test_single_calculation_exact_mode_at_catalog_temperature() -> None:
    material = _calc_material()
    result = _calc_service().single_calculation(_FakeRepo([material]), "calc-mat-1", 0)

    row_20 = next(row for row in result["db_rows"] if row["temperature"] == 20.0)
    density_cell = row_20["values"]["density"]
    assert density_cell["value"] == 7800.0
    assert density_cell["mode"] == "exact"


def test_single_calculation_db_rows_skip_extrapolation_outside_range() -> None:
    material = _calc_material()
    result = _calc_service().single_calculation(
        _FakeRepo([material]),
        "calc-mat-1",
        0,
        custom_temperatures=[],
    )

    yield_cells = [
        row["values"].get("yield_strength")
        for row in result["db_rows"]
        if row["temperature"] == 500.0
    ]
    assert yield_cells == []


def test_single_calculation_custom_temperature_interpolates() -> None:
    material = _calc_material()
    result = _calc_service().single_calculation(
        _FakeRepo([material]),
        "calc-mat-1",
        0,
        custom_temperatures=[110.0],
    )

    assert len(result["custom_rows"]) == 1
    density_cell = result["custom_rows"][0]["values"]["density"]
    assert density_cell["mode"] == "interp"
    assert density_cell["value"] == pytest.approx(7775.0)


def test_single_calculation_custom_temperature_extrapolates() -> None:
    material = _calc_material()
    result = _calc_service().single_calculation(
        _FakeRepo([material]),
        "calc-mat-1",
        0,
        custom_temperatures=[500.0],
    )

    yield_cell = result["custom_rows"][0]["values"]["yield_strength"]
    assert yield_cell["mode"] == "approx"
    assert yield_cell["value"] is not None


def test_single_calculation_skips_invalid_custom_temperatures() -> None:
    material = _calc_material()
    result = _calc_service().single_calculation(
        _FakeRepo([material]),
        "calc-mat-1",
        0,
        custom_temperatures=["not-a-temp", 20.0],
    )

    assert len(result["custom_rows"]) == 1
    assert result["custom_rows"][0]["temperature"] == 20.0


def test_single_calculation_uses_selected_strength_category() -> None:
    material = _calc_material()
    service = _calc_service()
    repo = _FakeRepo([material])

    kp0 = service.single_calculation(repo, "calc-mat-1", 0, custom_temperatures=[20.0])
    kp1 = service.single_calculation(repo, "calc-mat-1", 1, custom_temperatures=[20.0])

    y0 = kp0["custom_rows"][0]["values"]["yield_strength"]["value"]
    y1 = kp1["custom_rows"][0]["values"]["yield_strength"]["value"]
    assert y0 == 360.0
    assert y1 == 420.0


def test_single_calculation_without_strength_categories() -> None:
    material = _calc_material(strength_categories=[])
    result = _calc_service().single_calculation(_FakeRepo([material]), "calc-mat-1", 0)

    assert result["db_rows"]
    assert any(row["values"].get("density", {}).get("value") == 7800.0 for row in result["db_rows"])


def test_temperature_selection_filters_by_area() -> None:
    material = _calc_material(areas=["Материалы лопаток"])
    service = _calc_service()
    repo = _FakeRepo([material])

    matched = service.temperature_selection(
        repo, "physical", 20.0, area="Материалы лопаток"
    )
    empty = service.temperature_selection(
        repo, "physical", 20.0, area="Несуществующая область"
    )

    assert matched["rows"]
    assert empty["rows"] == []


def test_temperature_selection_areas_list_matches_any() -> None:
    material = _calc_material(areas=["A", "B"])
    service = _calc_service()
    repo = _FakeRepo([material])

    result = service.temperature_selection(
        repo, "physical", 20.0, areas=["B", "C"]
    )
    assert len(result["rows"]) == 1


@pytest.fixture
def calc_context(client, material_with_composition):
    response = client.post(
        "/api/selection/calculate",
        json={
            "material_id": material_with_composition,
            "category_index": 0,
            "custom_temperatures": [],
        },
    )
    assert response.status_code == 200, response.text
    baseline = response.json()
    assert baseline.get("db_rows"), "FixtureFull must produce calculation db_rows"
    assert material_with_composition == FIXTURE_FULL_ID
    return {"material_id": material_with_composition, "baseline": baseline}


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


def test_calc_columns_have_display_symbol(calc_context):
    columns = calc_context["baseline"]["columns"]
    assert columns, "calculation must expose property columns"
    assert all(col.get("key") and col.get("label") for col in columns)
    assert all(
        isinstance(col.get("display_symbol"), str) and col["display_symbol"].strip()
        for col in columns
    )


def test_calc_db_rows_structure(calc_context):
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


def test_calc_custom_temperature_row(client, calc_context):
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


def test_calc_units_catalog_for_columns(client, calc_context):
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


def test_calc_unknown_material_returns_404(client, open_workspace):
    response = client.post(
        "/api/selection/calculate",
        json={
            "material_id": "00000000-0000-4000-8000-000000009999",
            "category_index": 0,
        },
    )
    assert response.status_code == 404


def test_calc_temperature_selection_regression(client, open_workspace):
    response = client.post(
        "/api/selection/temperature",
        json={"prop_type": "physical", "temperature": 20},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("columns")
    assert isinstance(payload.get("rows"), list)
