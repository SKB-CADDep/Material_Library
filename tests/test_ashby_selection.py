"""Unit-тесты диаграммы Эшби (SelectionService)."""

from src.core.models.material import Material
from src.services.properties_catalog import PropertiesCatalog
from src.services.selection_service import SelectionService


class _FakeRepo:
    def __init__(self, materials):
        self.materials = materials


def test_convex_hull_square():
    hull = SelectionService._compute_convex_hull(
        [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.5, 0.5)]
    )
    assert set(hull) == {(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)}


def test_convex_hull_few_points():
    assert SelectionService._compute_convex_hull([(1.0, 2.0)]) == [(1.0, 2.0)]
    assert SelectionService._compute_convex_hull([]) == []


def test_series_color_distinct():
    c0 = SelectionService._series_color(0)
    c1 = SelectionService._series_color(1)
    c11 = SelectionService._series_color(11)
    assert c0.startswith("#") and len(c0) == 7
    assert c0 != c1 != c11


def test_class_color_unlimited():
    c0 = SelectionService._class_color(0)
    c10 = SelectionService._class_color(10)
    c11 = SelectionService._class_color(11)
    assert c0.startswith("#") and len(c0) == 7
    assert c0 != c10 != c11


def test_ashby_options_and_diagram_smoke():
    material = Material(
        data={
            "material_id": "m1",
            "metadata": {
                "name_material_standard": "TestSteel",
                "name_material_alternative": [],
                "application_area": ["Материалы лопаток"],
                "classification": {
                    "classification_category": "",
                    "classification_class": "Ферритный",
                    "classification_subclass": "",
                },
            },
            "physical_properties": {
                "density": {
                    "temperature_value_pairs": [[20.0, 7800.0], [100.0, 7750.0]],
                }
            },
            "mechanical_properties": {"strength_category": []},
            "chemical_properties": {"composition": []},
        }
    )
    service = SelectionService(PropertiesCatalog())
    repo = _FakeRepo([material])

    options = service.ashby_options(repo)
    assert "temperature" in {a["key"] for a in options["axes"]}
    assert "Ферритный" in options["classes"]

    result = service.ashby_diagram(
        repo,
        x_prop="density",
        y_prop="temperature",
        class_names=["Ферритный"],
    )
    assert result["x_axis"]["key"] == "density"
    assert result["x_axis"]["symbol"] == "ρ"
    assert result["y_axis"]["key"] == "temperature"
    assert result["y_axis"]["symbol"] == "T"
    assert len(result["series"]) == 1
    assert len(result["series"][0]["points"]) == 2
    assert result["series"][0]["color"].startswith("#")
    assert result["class_legend"][0]["color"].startswith("#")
    assert result["series"][0]["color"] != result["class_legend"][0]["color"]


def test_ashby_named_properties_schema():
    """Новая схема: physical_properties.properties[{property_name, ...}]."""
    material = Material(
        data={
            "material_id": "m2",
            "metadata": {
                "name_material_standard": "NamedSteel",
                "name_material_alternative": [],
                "application_area": [],
                "classification": {
                    "classification_category": "",
                    "classification_class": "Аустенитный",
                    "classification_subclass": "",
                },
            },
            "physical_properties": {
                "properties": [
                    {
                        "property_name": "density",
                        "temperature_value_pairs": [[20.0, 7900.0], [200.0, 7850.0]],
                        "value_unit": "кг/м3",
                    }
                ]
            },
            "mechanical_properties": {
                "strength_category": [
                    {
                        "value_strength_category": "КП40",
                        "properties": [
                            {
                                "property_name": "yield_strength",
                                "temperature_value_pairs": [
                                    [20.0, 400.0],
                                    [100.0, 380.0],
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

    phys = service.ashby_diagram(
        repo,
        x_prop="density",
        y_prop="temperature",
        class_names=["Аустенитный"],
    )
    assert len(phys["series"]) == 1
    assert len(phys["series"][0]["points"]) == 2

    mech = service.ashby_diagram(
        repo,
        x_prop="yield_strength",
        y_prop="temperature",
        class_names=["Аустенитный"],
    )
    assert len(mech["series"]) == 1
    assert len(mech["series"][0]["points"]) == 2


def test_ashby_empty_classes_ok():
    service = SelectionService(PropertiesCatalog())
    result = service.ashby_diagram(
        _FakeRepo([]),
        x_prop="density",
        y_prop="temperature",
        class_names=[],
    )
    assert result["series"] == []
    assert result["hulls"] == []
    assert result["class_legend"] == []


def test_ashby_skips_series_without_points():
    """Серии без точек (нет данных по осям) не попадают в ответ и легенду."""
    with_data = Material(
        data={
            "material_id": "with",
            "metadata": {
                "name_material_standard": "WithData",
                "name_material_alternative": [],
                "application_area": [],
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
                        "temperature_value_pairs": [[20.0, 7800.0]],
                    }
                ]
            },
            "mechanical_properties": {"strength_category": []},
            "chemical_properties": {"composition": []},
        }
    )
    without_data = Material(
        data={
            "material_id": "without",
            "metadata": {
                "name_material_standard": "NoData",
                "name_material_alternative": [],
                "application_area": [],
                "classification": {
                    "classification_category": "",
                    "classification_class": "Ферритный",
                    "classification_subclass": "",
                },
            },
            "physical_properties": {"properties": []},
            "mechanical_properties": {"strength_category": []},
            "chemical_properties": {"composition": []},
        }
    )
    service = SelectionService(PropertiesCatalog())
    result = service.ashby_diagram(
        _FakeRepo([with_data, without_data]),
        x_prop="density",
        y_prop="temperature",
        class_names=["Ферритный"],
    )
    assert len(result["series"]) == 1
    assert result["series"][0]["label"] == "WithData"
    assert all(s["points"] for s in result["series"])
    assert result["class_legend"] == [
        {"class_name": "Ферритный", "color": result["class_legend"][0]["color"]}
    ]


def test_ashby_empty_classification_class_excluded_until_filled():
    """Пустой classification_class не в опциях/диаграмме; после заполнения — появляется."""
    bare = {
        "material_id": "later",
        "metadata": {
            "name_material_standard": "LaterClass",
            "name_material_alternative": [],
            "application_area": [],
            "classification": {
                "classification_category": "",
                "classification_class": "",
                "classification_subclass": "",
            },
        },
        "physical_properties": {
            "properties": [
                {
                    "property_name": "density",
                    "temperature_value_pairs": [[20.0, 7700.0], [100.0, 7650.0]],
                }
            ]
        },
        "mechanical_properties": {"strength_category": []},
        "chemical_properties": {"composition": []},
    }
    material = Material(data=bare)
    service = SelectionService(PropertiesCatalog())
    repo = _FakeRepo([material])

    options = service.ashby_options(repo)
    assert options["classes"] == []

    empty_pick = service.ashby_diagram(
        repo,
        x_prop="density",
        y_prop="temperature",
        class_names=[""],
    )
    assert empty_pick["series"] == []
    assert empty_pick["class_legend"] == []

    material.data["metadata"]["classification"]["classification_class"] = "Мартенситный"
    options_filled = service.ashby_options(repo)
    assert "Мартенситный" in options_filled["classes"]

    diagram = service.ashby_diagram(
        repo,
        x_prop="density",
        y_prop="temperature",
        class_names=["Мартенситный"],
    )
    assert len(diagram["series"]) == 1
    assert diagram["series"][0]["label"] == "LaterClass"
    assert diagram["class_legend"][0]["class_name"] == "Мартенситный"
