from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from src.services.source_service import SourceService


def test_save_raises_and_does_not_mutate_disk_on_failure(tmp_path: Path):
    target = tmp_path / "source.json"
    service = SourceService(target)
    service.add_source("Уже на диске", group="property_sources")
    on_disk = json.loads(target.read_text(encoding="utf-8"))

    with patch(
        "src.services.source_service.atomic_write_json",
        side_effect=OSError("disk full"),
    ):
        with pytest.raises(OSError, match="disk full"):
            service.add_source("Не должно сохраниться", group="property_sources")

    assert json.loads(target.read_text(encoding="utf-8")) == on_disk
    assert all(s["name_source"] != "Не должно сохраниться" for s in service.get_all())


def test_update_rolls_back_memory_if_save_fails(tmp_path: Path):
    target = tmp_path / "source.json"
    service = SourceService(target)
    source_id = service.add_source("Было", description="d", hyperlink="h", group="property_sources")

    with patch(
        "src.services.source_service.atomic_write_json",
        side_effect=OSError("disk full"),
    ):
        with pytest.raises(OSError, match="disk full"):
            service.update_source(source_id, "Стало", "new", "link")

    src = service.get_source_by_id(source_id)
    assert src is not None
    assert src["name_source"] == "Было"
    assert src["description"] == "d"
    assert json.loads(target.read_text(encoding="utf-8"))["property_sources"][0][
        "name_source"
    ] == "Было"


def test_delete_rolls_back_memory_if_save_fails(tmp_path: Path):
    target = tmp_path / "source.json"
    service = SourceService(target)
    source_id = service.add_source("Удалить?", group="chemical_sources")

    with patch(
        "src.services.source_service.atomic_write_json",
        side_effect=OSError("disk full"),
    ):
        with pytest.raises(OSError, match="disk full"):
            service.delete_source(source_id)

    assert service.get_source_by_id(source_id) is not None
    data = json.loads(target.read_text(encoding="utf-8"))
    assert any(s["id_source"] == source_id for s in data["chemical_sources"])
