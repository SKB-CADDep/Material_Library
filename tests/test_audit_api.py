"""API-тесты аудита: changelog + JSONL при сохранении материала."""

from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from backend.audit_service import reset_audit_logger_for_tests
from src.core.schema_keys import Schema
from src.services.audit_logger import AuditLogger


def _wait_jsonl_lines(path: Path, min_lines: int = 1, timeout_s: float = 2.0) -> list[dict]:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if path.is_file() and path.stat().st_size > 0:
            rows = []
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line:
                    continue
                rows.append(json.loads(line))
            if len(rows) >= min_lines:
                return rows
        time.sleep(0.05)
    if not path.is_file():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


@pytest.fixture
def audit_tmpdir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    base = tmp_path / "audit_base"
    base.mkdir()
    log_path = base / "logs" / "audit.jsonl"
    changelog = base / "material_changelog.txt"

    monkeypatch.setattr(
        "src.services.material_changelog.get_app_directory",
        lambda: str(base),
    )
    monkeypatch.setattr(
        "backend.audit_service.get_app_directory",
        lambda: base,
    )

    logger = AuditLogger(
        app_id="material_lib_test",
        app_version="test",
        main_log_path=log_path,
        base_dir=base,
    )
    reset_audit_logger_for_tests(logger)
    yield {"base": base, "jsonl": log_path, "changelog": changelog}
    reset_audit_logger_for_tests(None)


def test_audit_session_endpoints(client, audit_tmpdir):
    sid = "web_session_test_001"
    r1 = client.post("/api/audit/session/start", json={"session_id": sid})
    assert r1.status_code == 200
    assert r1.json()["ok"] is True

    r2 = client.post(
        "/api/audit/event",
        json={
            "session_id": sid,
            "event_name": "NAV_TAB_SELECTED",
            "event_category": "Навигация",
            "event_action": "Выбрано",
            "data": {"контейнер": "Тест", "вкладка": "A"},
        },
    )
    assert r2.status_code == 200

    r3 = client.post(
        "/api/audit/session/end",
        json={"session_id": sid, "duration_ms": 12.5, "ok": True},
    )
    assert r3.status_code == 200

    rows = _wait_jsonl_lines(audit_tmpdir["jsonl"], min_lines=3)
    names = [row["event"]["name"] for row in rows]
    assert any("сесс" in n.lower() or "Старт" in n or "session" in n.lower() for n in names) or any(
        row.get("session", {}).get("id") == sid for row in rows
    )
    assert any(row.get("session", {}).get("id") == sid for row in rows)
    assert any(row["event"]["name"] == "Навигация: вкладка выбрана" for row in rows)


def test_put_material_writes_changelog_and_jsonl(
    client,
    material_id,
    open_workspace,
    audit_tmpdir,
):
    detail = client.get(f"/api/materials/{material_id}").json()
    original = detail["metadata"][Schema.NAME_STD]
    detail["metadata"][Schema.NAME_STD] = f"{original} AuditMark"

    put = client.put(f"/api/materials/{material_id}", json=detail)
    assert put.status_code == 200

    changelog: Path = audit_tmpdir["changelog"]
    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline and not changelog.is_file():
        time.sleep(0.05)
    assert changelog.is_file(), "material_changelog.txt должен появиться после save"
    text = changelog.read_text(encoding="utf-8")
    assert "[БЫЛО]" in text
    assert "[СТАЛО]" in text
    assert "AuditMark" in text

    rows = _wait_jsonl_lines(audit_tmpdir["jsonl"], min_lines=2)
    save_names = [row["event"]["name"] for row in rows]
    assert "Материал: сохранение" in save_names
    assert any(
        row["event"]["name"] == "Материал: изменения по вкладке"
        or row["event"]["action"] == "Изменено"
        for row in rows
    )

    # restore
    detail["metadata"][Schema.NAME_STD] = original
    client.put(f"/api/materials/{material_id}", json=detail)
