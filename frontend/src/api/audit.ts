import { api } from "./client";

export type AuditEventPayload = {
  session_id: string;
  event_name: string;
  event_category: string;
  event_action: string;
  actor_user?: string | null;
  operation_id?: string | null;
  parent_operation_id?: string | null;
  result_ok?: boolean | null;
  result_status?: string | null;
  result_error_kind?: string | null;
  duration_ms?: number | null;
  counters?: Record<string, number> | null;
  entity?: Record<string, unknown> | null;
  changes_fields?: string[] | null;
  data?: Record<string, unknown> | null;
};

export type AuditSessionPayload = {
  session_id: string;
  actor_user?: string | null;
  duration_ms?: number | null;
  ok?: boolean;
};

export async function postAuditSessionStart(
  body: AuditSessionPayload,
): Promise<void> {
  await api.post("/audit/session/start", body);
}

export async function postAuditSessionEnd(
  body: AuditSessionPayload,
): Promise<void> {
  await api.post("/audit/session/end", body);
}

export async function postAuditEvent(body: AuditEventPayload): Promise<void> {
  await api.post("/audit/event", body);
}
