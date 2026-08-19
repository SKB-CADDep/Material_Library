"""Unit-тесты расчётов Ларсона–Миллера."""

import pytest

from src.core.math.larson_miller import (
    interpolate_stress_at_p,
    larson_miller_parameter,
    property_key_for_service_hours,
)
from src.core.models.material import Material
from src.services.properties_catalog import PropertiesCatalog
from src.services.selection_service import SelectionService


class _FakeRepo:
    def __init__(self, materials):
        self.materials = materials

    def get_by_id(self, material_id: str):
        for material in self.materials:
            if material.data.get("material_id") == material_id:
                return material
        return None


def test_larson_miller_parameter_excel_example():
    # Excel: T=470, tau=1000, C=18 -> P=15.60615
    p_value = larson_miller_parameter(470, 1000, 18)
    assert p_value == pytest.approx(15.60615, rel=1e-4)


def test_property_key_for_service_hours():
    assert (
        property_key_for_service_hours(10000)
        == "tensile_strength_limit_10_thousands_hours"
    )
    assert property_key_for_service_hours(12345) is None


def test_interpolate_stress_at_p_linear():
    points = [(15.0, 294.0), (16.0, 265.0), (17.0, 226.0)]
    stress, extrapolated = interpolate_stress_at_p(16.5, points)
    assert extrapolated is False
    assert stress == pytest.approx(245.5)


def test_larson_miller_service_smoke():
    material = Material(
        data={
            "material_id": "m-lm",
            "metadata": {
                "name_material_standard": "12Х13",
                "name_material_alternative": [],
                "application_area": [],
                "larson_miller_constant_c": 18,
            },
            "physical_properties": {"properties": []},
            "mechanical_properties": {
                "strength_category": [
                    {
                        "value_strength_category": "КП55",
                        "properties": [
                            {
                                "property_name": "tensile_strength_limit_10_thousands_hours",
                                "temperature_value_pairs": [
                                    [470.0, 255.0],
                                    [500.0, 216.0],
                                    [530.0, 186.0],
                                ],
                            }
                        ],
                    }
                ]
            },
            "chemical_properties": {"composition": []},
        }
    )
    service = SelectionService(PropertiesCatalog())
    repo = _FakeRepo([material])

    result = service.larson_miller(
        repo,
        "m-lm",
        0,
        10_000,
        constant_c=18,
        calc_temperature=470,
        calc_service_hours=10_000,
    )

    assert result["from_database"] is True
    assert len(result["table_points"]) == 3
    assert result["table_points"][0]["p"] == pytest.approx(
        larson_miller_parameter(470, 10_000, 18), rel=1e-6
    )
    assert result["calc_stress"] == pytest.approx(255.0, rel=1e-6)
    assert result["is_extrapolated"] is False
    assert len(result["chart_curve"]) == 3


def test_larson_miller_custom_table_points():
    material = Material(
        data={
            "material_id": "m-custom",
            "metadata": {
                "name_material_standard": "Test",
                "name_material_alternative": [],
                "application_area": [],
            },
            "physical_properties": {"properties": []},
            "mechanical_properties": {
                "strength_category": [
                    {"value_strength_category": "КП1", "properties": []}
                ]
            },
            "chemical_properties": {"composition": []},
        }
    )
    service = SelectionService(PropertiesCatalog())
    repo = _FakeRepo([material])

    result = service.larson_miller(
        repo,
        "m-custom",
        0,
        1000,
        constant_c=18,
        custom_table_points=[
            {"temperature": 470, "stress": 294},
            {"temperature": 500, "stress": 265},
            {"temperature": 530, "stress": 226},
        ],
        calc_temperature=470,
        calc_service_hours=10_000,
    )

    assert result["from_database"] is False
    assert result["table_points"][0]["stress"] == 294
    assert result["calc_p"] == pytest.approx(
        larson_miller_parameter(470, 10_000, 18), rel=1e-6
    )
    assert result["calc_stress"] is not None
