"""Unit и API-тесты хим. подбора"""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app
from src.core.models.material import Material
from src.services.material_repository import MaterialRepository
from tests.fixtures.workspace_paths import (
    FIXTURE_BARE_ID,
    FIXTURE_FULL_ID,
    FIXTURE_KP_ONLY_ID,
)


def _chem_material(
    *,
    material_id: str,
    name: str,
    areas: list[str] | None = None,
    compositions: list[dict] | None = None,
) -> Material:
    if areas is None:
        areas = ["Конструкционные материалы"]
    if compositions is None:
        compositions = []

    return Material(
        data={
            "material_id": material_id,
            "metadata": {
                "name_material_standard": name,
                "name_material_alternative": [],
                "application_area": areas,
            },
            "chemical_properties": {"composition": compositions},
        }
    )


def _repo_with(*materials: Material) -> MaterialRepository:
    repo = MaterialRepository()
    repo.materials = list(materials)
    return repo


def _composition_block(
    *,
    base_element: str = "Fe",
    elements: list[dict] | None = None,
    tolerance_type: str = "absolute",
    composition_source: str = "GOST",
) -> dict:
    if elements is None:
        elements = [
            {"element": "C", "unit_value": "%", "min_value": 0.17, "max_value": 0.24},
        ]
    return {
        "composition_source": composition_source,
        "base_element": base_element,
        "tolerance_type": tolerance_type,
        "other_elements": elements,
    }



def test_list_chem_composition_entries_skips_empty_composition() -> None:
    with_comp = _chem_material(
        material_id="m1",
        name="WithComp",
        compositions=[_composition_block()],
    )
    without_comp = _chem_material(
        material_id="m2",
        name="Bare",
        compositions=[],
    )
    repo = _repo_with(with_comp, without_comp)

    entries = repo.list_chem_composition_entries()

    assert len(entries) == 1
    assert entries[0]["material_id"] == "m1"


def test_list_chem_composition_entries_one_row_per_composition_block() -> None:
    material = _chem_material(
        material_id="m-multi",
        name="MultiSource",
        compositions=[
            _composition_block(composition_source="GOST A"),
            _composition_block(composition_source="GOST B", base_element="Ni"),
        ],
    )
    repo = _repo_with(material)

    entries = repo.list_chem_composition_entries()

    assert len(entries) == 2
    assert {e["composition"]["composition_source"] for e in entries} == {
        "GOST A",
        "GOST B",
    }
    assert all(e["material_id"] == "m-multi" for e in entries)
    assert all(e["material_name"] == "MultiSource" for e in entries)


def test_list_chem_composition_entries_preserves_areas_and_elements() -> None:
    elements = [
        {
            "element": "C",
            "unit_value": "%",
            "min_value": 0.17,
            "max_value": 0.24,
            "min_value_tolerance": 0.15,
            "max_value_tolerance": 0.26,
        },
        {"element": "Mn", "unit_value": "%", "min_value": 0.35, "max_value": 0.65},
    ]
    material = _chem_material(
        material_id="m-areas",
        name="AreaSteel",
        areas=["Конструкционные материалы", "Сварные конструкции"],
        compositions=[
            _composition_block(
                elements=elements,
                tolerance_type="absolute",
            )
        ],
    )
    repo = _repo_with(material)

    entries = repo.list_chem_composition_entries()
    assert len(entries) == 1

    entry = entries[0]
    assert entry["areas"] == [
        "Конструкционные материалы",
        "Сварные конструкции",
    ]
    composition = entry["composition"]
    assert composition["tolerance_type"] == "absolute"
    assert len(composition["other_elements"]) == 2
    c_elem = composition["other_elements"][0]
    assert c_elem["min_value_tolerance"] == 0.15
    assert c_elem["max_value_tolerance"] == 0.26


def test_list_chem_composition_entries_multiple_materials_sorted_by_repo_order() -> None:
    mat_a = _chem_material(
        material_id="a",
        name="Alpha",
        compositions=[_composition_block(composition_source="A")],
    )
    mat_b = _chem_material(
        material_id="b",
        name="Beta",
        compositions=[_composition_block(composition_source="B")],
    )
    repo = _repo_with(mat_a, mat_b)

    entries = repo.list_chem_composition_entries()

    assert len(entries) == 2
    assert {e["material_id"] for e in entries} == {"a", "b"}


def test_list_summary_has_composition_flag() -> None:
    with_comp = _chem_material(
        material_id="m1",
        name="WithComp",
        compositions=[_composition_block()],
    )
    without_comp = _chem_material(
        material_id="m2",
        name="Bare",
        compositions=[],
    )
    repo = _repo_with(with_comp, without_comp)

    summary = {item["id"]: item["has_composition"] for item in repo.list_summary()}

    assert summary["m1"] is True
    assert summary["m2"] is False


def test_api_composition_entries_excludes_materials_without_composition(
    open_workspace,
) -> None:
    client = TestClient(app)

    response = client.get("/api/selection/chem/composition-entries")
    assert response.status_code == 200

    entries = response.json()["entries"]
    material_ids = {entry["material_id"] for entry in entries}

    assert FIXTURE_FULL_ID in material_ids
    assert FIXTURE_KP_ONLY_ID not in material_ids
    assert FIXTURE_BARE_ID not in material_ids


def test_api_composition_entries_shape_for_pivot_and_target(
    open_workspace,
) -> None:
    client = TestClient(app)

    response = client.get("/api/selection/chem/composition-entries")
    assert response.status_code == 200

    entries = response.json()["entries"]
    fixture_entries = [e for e in entries if e["material_id"] == FIXTURE_FULL_ID]
    assert fixture_entries, "FixtureFull must appear in composition-entries"

    entry = fixture_entries[0]
    assert entry["material_name"] == "FixtureFull"
    assert "Конструкционные материалы" in entry["areas"]

    composition = entry["composition"]
    assert composition.get("base_element") == "Fe"
    elements = composition.get("other_elements") or []
    symbols = {elem["element"] for elem in elements}
    assert "C" in symbols
    assert "Mn" in symbols

    for elem in elements:
        assert elem.get("unit_value") == "%"
        assert elem.get("min_value") is not None or elem.get("max_value") is not None


def test_api_materials_has_composition_aligns_with_entries(open_workspace) -> None:
    client = TestClient(app)

    materials = client.get("/api/materials").json()
    with_composition = {m["id"] for m in materials if m.get("has_composition")}

    entries = client.get("/api/selection/chem/composition-entries").json()["entries"]
    entry_ids = {e["material_id"] for e in entries}

    assert entry_ids <= with_composition
    assert FIXTURE_FULL_ID in entry_ids


def test_api_composition_entries_relative_tolerance_preserved(
    open_workspace,
    client,
) -> None:
    """S2: tolerance_type и relative-поля должны доходить до клиента без потерь."""
    material_id = FIXTURE_FULL_ID
    detail = client.get(f"/api/materials/{material_id}").json()
    compositions = (detail.get("chemical_properties") or {}).get("composition") or []
    assert compositions

    updated = dict(detail)
    chem = dict(updated.get("chemical_properties") or {})
    comp = dict(compositions[0])
    comp["tolerance_type"] = "relative"
    comp["other_elements"] = [
        {
            "element": "C",
            "unit_value": "%",
            "min_value": 0.20,
            "max_value": 0.30,
            "min_value_tolerance_relative": 10,
            "max_value_tolerance_relative": 5,
        }
    ]
    chem["composition"] = [comp]
    updated["chemical_properties"] = chem

    put = client.put(f"/api/materials/{material_id}", json=updated)
    assert put.status_code == 200, put.text

    entries = client.get("/api/selection/chem/composition-entries").json()["entries"]
    fixture_entry = next(e for e in entries if e["material_id"] == material_id)
    saved_comp = fixture_entry["composition"]

    assert saved_comp["tolerance_type"] == "relative"
    c_elem = saved_comp["other_elements"][0]
    assert c_elem["min_value_tolerance_relative"] == 10
    assert c_elem["max_value_tolerance_relative"] == 5
