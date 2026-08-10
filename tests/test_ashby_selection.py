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
    assert result["class_legend"][0]["color"] == "#1f77b4"
    # кривая — HSV, класс — tab10
    assert result["series"][0]["color"] != result["class_legend"][0]["color"]


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
