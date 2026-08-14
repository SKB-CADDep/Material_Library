"""Unit-тесты сравнения свойств (SelectionService.compare_props_*)."""

from src.core.models.material import Material
from src.services.properties_catalog import PropertiesCatalog
from src.services.selection_service import SelectionService


class _FakeRepo:
    def __init__(self, materials):
        self.materials = materials

    def get_by_id(self, material_id: str):
        for material in self.materials:
            mid = material.data.get("material_id", "") or material.filename
            if mid == material_id:
                return material
        return None


def _steel():
    return Material(
        data={
            "material_id": "m-compare-1",
            "metadata": {
                "name_material_standard": "CompareSteel",
                "name_material_alternative": [],
                "application_area": ["Материалы лопаток"],
                "classification": {
                    "classification_category": "",
                    "classification_class": "Ферритный",
                    "classification_subclass": "",
                },
            },
            "physical_properties": {
                "properties": [
                    {
                        "property_name": "density",
                        "temperature_value_pairs": [
                            [20.0, 7800.0],
                            [100.0, 7750.0],
                        ],
                    }
                ]
            },
            "mechanical_properties": {
                "strength_category": [
                    {
                        "value_strength_category": "КП360",
                        "properties": [
                            {
                                "property_name": "yield_strength",
                                "temperature_value_pairs": [
                                    [20.0, 360.0],
                                    [200.0, 300.0],
                                ],
                            }
                        ],
                    },
                    {
                        "value_strength_category": "КП420",
                        "properties": [],
                    },
                ]
            },
            "chemical_properties": {"composition": []},
        }
    )


def test_compare_props_pool_physical():
    service = SelectionService(PropertiesCatalog())
    repo = _FakeRepo([_steel()])

    result = service.compare_props_pool(repo, "density")
    assert result["property_key"] == "density"
    assert len(result["items"]) == 1
    assert result["items"][0]["label"] == "CompareSteel"
    assert result["items"][0]["category_index"] is None


def test_compare_props_pool_mechanical_filters_empty_kp():
    service = SelectionService(PropertiesCatalog())
    repo = _FakeRepo([_steel()])

    result = service.compare_props_pool(repo, "yield_strength")
    assert len(result["items"]) == 1
    item = result["items"][0]
    assert item["label"] == "CompareSteel КП360"
    assert item["category_index"] == 0


def test_compare_props_pool_area_filter():
    service = SelectionService(PropertiesCatalog())
    repo = _FakeRepo([_steel()])

    empty = service.compare_props_pool(
        repo, "density", area="Несуществующая область"
    )
    assert empty["items"] == []

    matched = service.compare_props_pool(
        repo, "density", area="Материалы лопаток"
    )
    assert len(matched["items"]) == 1


def test_compare_props_plot_and_no_data():
    service = SelectionService(PropertiesCatalog())
    repo = _FakeRepo([_steel()])

    plotted = service.compare_props_plot(
        repo,
        "density",
        [
            {
                "id": "m-compare-1",
                "label": "CompareSteel",
                "material_id": "m-compare-1",
                "category_index": None,
            }
        ],
    )
    assert plotted["property"]["key"] == "density"
    assert plotted["series"][0]["has_data"] is True
    assert len(plotted["series"][0]["points"]) == 2
    assert plotted["series"][0]["color"].startswith("#")

    # Базовый материал без КП при мех. свойстве → «нет данных»
    no_data = service.compare_props_plot(
        repo,
        "yield_strength",
        [
            {
                "id": "m-compare-1",
                "label": "CompareSteel",
                "material_id": "m-compare-1",
                "category_index": None,
            }
        ],
    )
    assert no_data["series"][0]["has_data"] is False
    assert "нет данных" in no_data["series"][0]["label"]
    assert no_data["series"][0]["points"] == []
