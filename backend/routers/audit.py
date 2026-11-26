"""API аудита: сессия браузера и произвольные события с клиента."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.audit_service import audit_log, get_audit_logger
from src.services.audit_events import AUDIT_EVENT_NAMES

router = APIRouter(tags=["Audit"])


class AuditSessionRequest(BaseModel):
    session_id: str = Field(min_length=1)
    actor_user: str | None = None
    duration_ms: float | None = None
    ok: bool = True


class AuditEventRequest(BaseModel):
    session_id: str = Field(min_length=1)
    event_name: str = Field(min_length=1)
    event_category: str = Field(min_length=1)
    event_action: str = Field(min_length=1)
    actor_user: str | None = None
    operation_id: str | None = None
    parent_operation_id: str | None = None
    result_ok: bool | None = None
    result_status: str | None = None
    result_error_kind: str | None = None
    duration_ms: float | None = None
    counters: dict[str, int | float] | None = None
    entity: dict | None = None
    changes_fields: list[str] | None = None
    data: dict | None = None


class AuditOkResponse(BaseModel):
    ok: bool


@router.post("/audit/session/start", response_model=AuditOkResponse)
def audit_session_start(body: AuditSessionRequest):
    try:
        al = get_audit_logger()
        if al:
            al.log_session_start(
                session_id=body.session_id,
                actor_user=body.actor_user,
            )
    except Exception:
        pass
    return AuditOkResponse(ok=True)


@router.post("/audit/session/end", response_model=AuditOkResponse)
def audit_session_end(body: AuditSessionRequest):
    try:
        al = get_audit_logger()
        if al:
            al.log_session_end(
                duration_ms=body.duration_ms,
                ok=body.ok,
                session_id=body.session_id,
                actor_user=body.actor_user,
            )
    except Exception:
        pass
    return AuditOkResponse(ok=True)


@router.post("/audit/event", response_model=AuditOkResponse)
def audit_event(body: AuditEventRequest):
    # Разрешаем и ключи словаря, и уже готовые русские имена
    event_name = AUDIT_EVENT_NAMES.get(body.event_name, body.event_name)
    audit_log(
        event_name=event_name,
        event_category=body.event_category,
        event_action=body.event_action,
        operation_id=body.operation_id,
        parent_operation_id=body.parent_operation_id,
        result_ok=body.result_ok,
        result_status=body.result_status,
        result_error_kind=body.result_error_kind,
        duration_ms=body.duration_ms,
        counters=body.counters,
        entity=body.entity,
        changes_fields=body.changes_fields,
        data=body.data,
        session_id=body.session_id,
        actor_user=body.actor_user,
    )
    return AuditOkResponse(ok=True)
