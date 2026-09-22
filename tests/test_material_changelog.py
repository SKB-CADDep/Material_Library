"""Unit-тесты changelog и группировки вкладок аудита."""

from __future__ import annotations

from pathlib import Path

from src.core.schema_keys import Schema
from src.services.audit_events import group_editor_changes_by_tab
from src.services.material_changelog import find_changes, log_changes


def test_find_changes_detects_metadata_rename():
    old = {
        "material_id": "a",
        Schema.METADATA: {Schema.NAME_STD: "Old"},
    }
    new = {
        "material_id": "a",
        Schema.METADATA: {Schema.NAME_STD: "New"},
    }
    changes = find_changes(old, new)
    assert len(changes) == 1
    assert changes[0]["type"] == "modified"
    assert changes[0]["old"] == "Old"
    assert changes[0]["new"] == "New"
    assert Schema.METADATA in changes[0]["path"]


def test_group_editor_changes_by_tab_metadata():
    changes = [
        {
            "path": [Schema.METADATA, Schema.NAME_STD],
            "type": "modified",
            "old": "A",
            "new": "B",
        }
    ]
    grouped = group_editor_changes_by_tab(changes)
    assert "Общие данные" in grouped
    assert any("стандарт" in label.lower() or "Наименование" in label for label in grouped["Общие данные"])


def test_log_changes_writes_bylo_stalo(tmp_path: Path):
    log_path = tmp_path / "material_changelog.txt"
    changes = [
        {
            "path": [Schema.METADATA, Schema.NAME_STD],
            "type": "modified",
            "old": "Было",
            "new": "Стало",
        }
    ]
    log_changes("TestMat", changes, log_path=str(log_path), username="tester")
    text = log_path.read_text(encoding="utf-8")
    assert "Материал: TestMat" in text
    assert "Пользователь: tester" in text
    assert "[БЫЛО]" in text
    assert "[СТАЛО]" in text
    assert "Было" in text
    assert "Стало" in text
