"""Обёртка аудита для FastAPI: soft-fail как в десктопе."""

from __future__ import annotations

import logging
import time
from typing import Any

from src.infrastructure.paths import get_app_directory
from src.services.audit_events import (
    AUDIT_EVENT_NAMES,
    EDITOR_AUDIT_TAB_ORDER,
    group_editor_changes_by_tab,
)
from src.services.audit_logger import AuditLogger

logger = logging.getLogger(__name__)

APP_ID = "material_lib"
APP_VERSION = "0.1.0"

_audit_logger: AuditLogger | None = None
_init_attempted = False


def get_audit_logger() -> AuditLogger | None:
    global _audit_logger, _init_attempted
    if _init_attempted:
        return _audit_logger
    _init_attempted = True
    try:
        _audit_logger = AuditLogger(
            app_id=APP_ID,
            app_version=APP_VERSION,
            base_dir=get_app_directory(),
        )
    except Exception:
        logger.exception("AuditLogger init failed")
        _audit_logger = None
    return _audit_logger


def reset_audit_logger_for_tests(logger_instance: AuditLogger | None = None) -> None:
    """Только для тестов."""
    global _audit_logger, _init_attempted
    _audit_logger = logger_instance
    _init_attempted = logger_instance is not None


def audit_log(
    *,
    event_name: str,
    event_category: str,
    event_action: str,
    operation_id: str | None = None,
    parent_operation_id: str | None = None,
    result_ok: bool | None = None,
    result_status: str | None = None,
    result_error_kind: str | None = None,
    duration_ms: float | None = None,
    counters: dict[str, int | float] | None = None,
    entity: dict[str, Any] | None = None,
    changes_fields: list[str] | None = None,
    data: dict[str, Any] | None = None,
    session_id: str | None = None,
    actor_user: str | None = None,
) -> None:
    try:
        al = get_audit_logger()
        if not al:
            return
        al.log(
            event_name=event_name,
            event_category=event_category,
            event_action=event_action,
            operation_id=operation_id,
            parent_operation_id=parent_operation_id,
            result_ok=result_ok,
            result_status=result_status,
            result_error_kind=result_error_kind,
            duration_ms=duration_ms,
            counters=counters,
            entity=entity,
            changes_fields=changes_fields,
            data=data,
            session_id=session_id,
            actor_user=actor_user,
        )
    except Exception:
        return


def audit_log_material_save_by_tabs(
    operation_id: str | None,
    material_name: str,
    changes: list[dict[str, Any]] | None,
    *,
    data_extra: dict[str, Any],
    session_id: str | None = None,
    actor_user: str | None = None,
) -> dict[str, list[str]]:
    grouped = group_editor_changes_by_tab(changes)
    if not grouped:
        return grouped
    entity = {"type": "Материал", "name": material_name}
    for tab in EDITOR_AUDIT_TAB_ORDER:
        labels = grouped.get(tab)
        if not labels:
            continue
        audit_log(
            event_name=AUDIT_EVENT_NAMES["MATERIAL_SAVE_TAB"],
            event_category="Данные",
            event_action="Изменено",
            operation_id=operation_id,
            entity=entity,
            changes_fields=labels,
            counters={"полей": len(labels)},
            data={**data_extra, "вкладка": tab},
            session_id=session_id,
            actor_user=actor_user,
        )
    return grouped


def new_operation_id() -> str | None:
    try:
        al = get_audit_logger()
        return al.new_operation_id() if al else None
    except Exception:
        return None


def monotonic_ms_since(t0: float | None) -> float | None:
    if t0 is None:
        return None
    try:
        return (time.monotonic() - t0) * 1000.0
    except Exception:
        return None
