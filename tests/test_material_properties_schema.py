"""Тесты схемы properties[] (physical_properties.properties / strength_category.properties)."""
import unittest
from pathlib import Path

from src.core.models.material import Material
from src.core.schema_keys import Schema


class PropertiesArraySchemaTests(unittest.TestCase):
    def test_empty_structure(self):
        data = Material.get_empty_structure()
        self.assertIsInstance(data[Schema.PHYSICAL][Schema.PROPERTIES], list)
        self.assertEqual(data[Schema.MECHANICAL][Schema.STRENGTH_CAT], [])

    def test_load_data_08h13(self):
        path = Path(__file__).resolve().parents[1] / "data" / "08Х13_v1.json"
        if not path.is_file():
            self.skipTest("data/08Х13_v1.json missing")
        mat = Material(filepath=str(path))
        self.assertEqual(mat.get_interpolated_property("density", 20), 7760.0)
        self.assertEqual(mat.get_interpolated_property("yield_strength", 20, 0), 392.0)
        cats = mat.get_strength_categories()
        self.assertEqual(Material.category_name(cats[0]), "КП40")
        hard = Material.get_hardness_entries(cats[0])
        self.assertEqual(hard[0]["min_value"], 187.0)
        self.assertEqual(Material.get_hardness_unit(cats[0]), "HB")
        dens = mat.get_physical_data("density")
        self.assertEqual(dens[Schema.PROP_NAME], "density")
        self.assertIn(Schema.TEMP_PAIRS, dens)

    def test_normalize_legacy_dict(self):
        legacy = {
            "material_id": "x",
            Schema.METADATA: {Schema.NAME_STD: "T"},
            Schema.PHYSICAL: {
                "density": {Schema.TEMP_PAIRS: [[20.0, 7800.0]], "value_unit": "кг/м3"},
            },
            Schema.MECHANICAL: {
                Schema.STRENGTH_CAT: [
                    {
                        Schema.VAL_STR_CAT: "КП1",
                        "hardness": [{"unit_value": "HB", "min_value": 100, "max_value": 120}],
                        "yield_strength": {Schema.TEMP_PAIRS: [[20.0, 300.0]]},
                    }
                ]
            },
            Schema.CHEMICAL: {Schema.COMPOSITION: []},
        }
        mat = Material(data=legacy)
        self.assertIsInstance(mat.data[Schema.PHYSICAL][Schema.PROPERTIES], list)
        self.assertEqual(mat.get_interpolated_property("density", 20), 7800.0)
        self.assertEqual(mat.get_interpolated_property("yield_strength", 20, 0), 300.0)
        cat = mat.get_strength_categories()[0]
        self.assertNotIn("yield_strength", cat)
        self.assertIsInstance(cat[Schema.PROPERTIES], list)
        self.assertEqual(Material.get_hardness_entries(cat)[0]["min_value"], 100)

    def test_set_physical_and_hardness_roundtrip(self):
        mat = Material()
        mat.set_physical_data("density", {Schema.TEMP_PAIRS: [[20.0, 7900.0]]})
        self.assertEqual(mat.get_physical_data("density")[Schema.TEMP_PAIRS][0][1], 7900.0)
        cat = Material.empty_strength_category("КП2")
        mat.data[Schema.MECHANICAL][Schema.STRENGTH_CAT].append(cat)
        Material.set_hardness_entries(
            cat, [{"unit_value": "HB", "min_value": 10, "max_value": 20}], unit="HB"
        )
        # одна запись тоже всегда list
        self.assertIsInstance(cat[Schema.HARDNESS], list)
        self.assertEqual(Material.get_hardness_entries(cat)[0]["max_value"], 20)

    def test_normalize_hardness_object_to_list(self):
        data = {
            "material_id": "x",
            Schema.METADATA: {Schema.NAME_STD: "T"},
            Schema.PHYSICAL: {Schema.PROPERTIES: []},
            Schema.MECHANICAL: {
                Schema.STRENGTH_CAT: [
                    {
                        Schema.VAL_STR_CAT: "КП1",
                        "hardness": {
                            "unit_value": "HB",
                            "min_value": 187.0,
                            "max_value": 217.0,
                        },
                    }
                ]
            },
            Schema.CHEMICAL: {Schema.COMPOSITION: []},
        }
        mat = Material(data=data)
        cat = mat.get_strength_categories()[0]
        self.assertIsInstance(cat[Schema.HARDNESS], list)
        self.assertEqual(cat[Schema.HARDNESS][0]["min_value"], 187.0)

    def test_source_info_from_property(self):
        mat = Material(data={
            "material_id": "x",
            Schema.METADATA: {Schema.NAME_STD: "T"},
            Schema.PHYSICAL: {
                Schema.PROPERTIES: [{
                    Schema.PROP_NAME: "density",
                    Schema.TEMP_PAIRS: [[20.0, 1.0]],
                    "property_subsource": "Источник А",
                }]
            },
            Schema.MECHANICAL: {Schema.STRENGTH_CAT: []},
            Schema.CHEMICAL: {Schema.COMPOSITION: []},
        })
        self.assertEqual(mat.get_source_info(Schema.PHYSICAL, prop_key="density"), "Источник А")
        self.assertEqual(mat.get_source_info(Schema.PHYSICAL), "Источник А")

    def test_hydrate_property_groups_into_legacy_lists(self):
        mat = Material(data={
            "material_id": "x",
            Schema.METADATA: {Schema.NAME_STD: "T"},
            "property_groups": [
                {
                    "property_type": "physical",
                    "properties": [{
                        "property_name": "density",
                        "data": {Schema.TEMP_PAIRS: [[20.0, 7760.0]], "value_unit": "кг/м3"},
                    }],
                },
                {
                    "property_type": "mechanical",
                    "strength_groups": [{
                        "strength_category": "КП40",
                        "properties": [
                            {
                                "property_name": "yield_strength",
                                "data": {Schema.TEMP_PAIRS: [[20.0, 392.0]]},
                            },
                            {
                                "property_name": "hardness",
                                "data": {
                                    "hardness_values": [{"unit_value": "HB", "min_value": 187.0}],
                                    "hardness_unit": "HB",
                                },
                            },
                        ],
                    }],
                },
                {
                    "property_type": "chemical",
                    "properties": [{
                        "property_name": "composition",
                        "data": {"base_element": "Fe", "other_elements": []},
                    }],
                },
            ],
        })
        self.assertEqual(mat.get_physical_data("density")[Schema.TEMP_PAIRS][0][1], 7760.0)
        cats = mat.get_strength_categories()
        self.assertEqual(Material.category_name(cats[0]), "КП40")
        self.assertEqual(mat.get_interpolated_property("yield_strength", 20, 0), 392.0)
        self.assertEqual(cats[0][Schema.HARDNESS][0]["min_value"], 187.0)
        self.assertEqual(mat.data[Schema.CHEMICAL][Schema.COMPOSITION][0]["base_element"], "Fe")


if __name__ == "__main__":
    unittest.main()
