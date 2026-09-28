from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from src.core.models.material import Material
from src.infrastructure.atomic_io import atomic_write_json


def test_atomic_write_json_creates_valid_file(tmp_path: Path):
    target = tmp_path / "sample.json"
    atomic_write_json(target, {"a": 1, "b": [2, 3]})

    assert target.is_file()
    assert json.loads(target.read_text(encoding="utf-8")) == {"a": 1, "b": [2, 3]}
    leftovers = list(tmp_path.glob(".sample.json.*.tmp"))
    assert leftovers == []


def test_atomic_write_json_keeps_original_if_dump_fails(tmp_path: Path):
    target = tmp_path / "material.json"
    original = {"material_id": "keep-me", "ok": True}
    target.write_text(json.dumps(original), encoding="utf-8")

    with patch("src.infrastructure.atomic_io.json.dump", side_effect=OSError("disk full")):
        with pytest.raises(OSError, match="disk full"):
            atomic_write_json(target, {"material_id": "new", "ok": False})

    assert json.loads(target.read_text(encoding="utf-8")) == original
    assert list(tmp_path.glob(".material.json.*.tmp")) == []


def test_material_save_uses_atomic_write(tmp_path: Path):
    path = tmp_path / "steel.json"
    path.write_text(
        json.dumps(
            {
                "material_id": "m1",
                "metadata": {"name_material_standard": "Before"},
                "physical_properties": {"properties": []},
                "mechanical_properties": {"strength_category": []},
                "chemical_properties": {"composition": []},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    mat = Material(filepath=str(path))
    mat.data["metadata"]["name_material_standard"] = "After"
    mat.save()

    reloaded = json.loads(path.read_text(encoding="utf-8"))
    assert reloaded["metadata"]["name_material_standard"] == "After"
    assert list(tmp_path.glob(".steel.json.*.tmp")) == []
