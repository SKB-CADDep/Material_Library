"""API catalogs: properties, classification, hardness, units."""

from __future__ import annotations

import pytest

from src.services.unit_manager import UnitManager

KNOWN_UNIT_TYPES = ("Давление", "Температура", "Твердость")


@pytest.mark.parametrize("unit_type", KNOWN_UNIT_TYPES)
def test_get_units_catalog_returns_registry(client, unit_type: str) -> None:
    response = client.get(f"/api/catalogs/units/{unit_type}")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["unit_type"] == unit_type
    assert data["system_unit"] == UnitManager.get_system_unit(unit_type)
    assert data["units"] == UnitManager.get_units(unit_type)
    assert data["display_labels"] == UnitManager.get_display_labels(unit_type)
    assert isinstance(data["factors"], dict)
    assert data["units"]


def test_get_units_unknown_type_returns_404(client) -> None:
    response = client.get("/api/catalogs/units/__no_such_unit_type__")
    assert response.status_code == 404
    assert "не найден" in response.json()["detail"].lower()


def test_get_properties_catalog_item_shape(client) -> None:
    response = client.get("/api/catalogs/properties")
    assert response.status_code == 200
    data = response.json()
    assert data["physical"] and data["mechanical"]

    sample_key, sample_meta = next(iter(data["physical"].items()))
    assert isinstance(sample_key, str) and sample_key
    assert isinstance(sample_meta, dict)
    assert sample_meta.get("label") or sample_meta.get("name") or sample_meta


def test_get_classification_nested_shape(client) -> None:
    response = client.get("/api/catalogs/classification")
    assert response.status_code == 200
    categories = response.json()["categories"]
    assert categories
    category = categories[0]
    assert category["name"]
    assert category["classes"]
    assert category["classes"][0]["subclasses"] is not None


def test_post_hardness_convert_roundtrip(client) -> None:
    response = client.post(
        "/api/catalogs/hardness/convert",
        json={"value": 600.0, "from_unit": "HB", "to_unit": "HRC"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["from_unit"] == "HB"
    assert data["to_unit"] == "HRC"
    assert data["result"] is not None


def test_post_hardness_convert_invalid_body_returns_422(client) -> None:
    response = client.post("/api/catalogs/hardness/convert", json={})
    assert response.status_code == 422
