from src.core.chem_element_tolerances import (
    migrate_material_data,
    sync_element_tolerances,
)


def test_sync_rel_from_abs_min_max():
    el = {
        "element": "S",
        "min_value": 5.0,
        "max_value": 10.0,
        "min_value_tolerance": 4.75,
        "max_value_tolerance": 10.25,
    }
    assert sync_element_tolerances(el) is True
    assert el["min_value_tolerance_relative"] == 0.25
    assert el["max_value_tolerance_relative"] == 0.25


def test_sync_abs_from_rel_min_max():
    el = {
        "element": "S",
        "min_value": 5.0,
        "max_value": 10.0,
        "min_value_tolerance_relative": 0.25,
        "max_value_tolerance_relative": 0.25,
    }
    assert sync_element_tolerances(el) is True
    assert el["min_value_tolerance"] == 4.75
    assert el["max_value_tolerance"] == 10.25


def test_partial_abs_only_max():
    el = {
        "element": "Si",
        "min_value": 0.2,
        "max_value": 0.52,
        "max_value_tolerance": "0.57",
    }
    assert sync_element_tolerances(el) is True
    assert el["max_value_tolerance"] == 0.57
    assert el["max_value_tolerance_relative"] == 0.05
    assert el["min_value_tolerance"] == 0.0
    assert el["min_value_tolerance_relative"] == 0.0


def test_migrate_property_groups_and_legacy():
    data = {
        "material_id": "x",
        "metadata": {"name_material_standard": "T"},
        "chemical_properties": {
            "composition": [
                {
                    "other_elements": [
                        {
                            "element": "C",
                            "min_value": 0.22,
                            "max_value": 0.3,
                            "min_value_tolerance": "0.19",
                        }
                    ]
                }
            ]
        },
        "property_groups": [
            {
                "property_type": "chemical",
                "properties": [
                    {
                        "property_name": "composition",
                        "data": {
                            "other_elements": [
                                {
                                    "element": "Mn",
                                    "min_value": 0.4,
                                    "max_value": 0.9,
                                    "min_value_tolerance": 0.3,
                                    "max_value_tolerance": 1.0,
                                }
                            ]
                        },
                    }
                ],
            }
        ],
    }
    changed, updated = migrate_material_data(data)
    assert changed is True
    assert updated == 2
    c = data["chemical_properties"]["composition"][0]["other_elements"][0]
    assert c["min_value_tolerance_relative"] == 0.03
    mn = data["property_groups"][0]["properties"][0]["data"]["other_elements"][0]
    assert mn["min_value_tolerance_relative"] == 0.1
    assert mn["max_value_tolerance_relative"] == 0.1
