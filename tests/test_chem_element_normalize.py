from src.core.models.material import Material
from src.core.schema_keys import Schema


def test_normalize_chemical_replaces_none_and_empty_with_zero():
    mat = Material(
        data={
            Schema.METADATA: {"name_material_standard": "T"},
            Schema.CHEMICAL: {
                Schema.COMPOSITION: [
                    {
                        "composition_source": "G",
                        "other_elements": [
                            {
                                "element": "C",
                                "unit_value": "%",
                                "min_value": None,
                                "max_value": 0.08,
                            },
                            {
                                "element": "Si",
                                "unit_value": "%",
                                "min_value": "",
                                "max_value": 0.8,
                                "min_value_tolerance": "",
                                "max_value_tolerance": "0.85",
                            },
                        ],
                    }
                ]
            },
        }
    )

    elements = mat.data[Schema.CHEMICAL][Schema.COMPOSITION][0]["other_elements"]
    carbon = elements[0]
    assert carbon["min_value"] == 0.0
    assert carbon["max_value"] == 0.08
    assert carbon["min_value_tolerance"] == 0.0
    assert carbon["max_value_tolerance"] == 0.0
    assert carbon["min_value_tolerance_relative"] == 0.0
    assert carbon["max_value_tolerance_relative"] == 0.0

    silicon = elements[1]
    assert silicon["min_value"] == 0.0
    assert silicon["max_value_tolerance"] == 0.85
    assert silicon["min_value_tolerance"] == 0.0
    assert silicon["min_value_tolerance_relative"] == 0.0


def test_coerce_chem_number_keeps_positive():
    assert Material._coerce_chem_number(0.15) == 0.15
    assert Material._coerce_chem_number("0,09") == 0.09
    assert Material._coerce_chem_number(0) == 0.0
    assert Material._coerce_chem_number(None) == 0.0
