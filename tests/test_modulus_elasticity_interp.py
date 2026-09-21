"""Регресс: E при 150°C для 08Х18Н10Т ≈ 199500 МПа, не 1995."""

from __future__ import annotations

from pathlib import Path

from src.core.math.interpolation import MathUtils
from src.core.models.material import Material
from src.core.schema_keys import Schema


DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "08Х18Н10Т_v1.json"


def test_linear_interp_halfway_between_100_and_200():
    pairs = [[100.0, 202000.0], [200.0, 197000.0]]
    assert MathUtils.linear_interpolate(pairs, 150.0) == 199500.0


def test_08x18n10t_modulus_at_150_from_data_file():
    assert DATA_FILE.is_file(), f"missing {DATA_FILE}"
    material = Material(DATA_FILE)
    value = material.get_interpolated_property("modulus_elasticity", 150.0)
    assert value == 199500.0

    prop = material.get_physical_data("modulus_elasticity")
    assert prop is not None
    assert prop.get("value_unit") == "МПа"
    pairs = prop.get(Schema.TEMP_PAIRS) or []
    assert [100.0, 202000.0] in pairs or any(
        p[0] == 100.0 and p[1] == 202000.0 for p in pairs
    )
