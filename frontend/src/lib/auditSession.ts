import {
  postAuditEvent,
  postAuditSessionEnd,
  postAuditSessionStart,
  type AuditEventPayload,
} from "../api/audit";

const SESSION_STORAGE_KEY = "material_lib_audit_session_id";
const SESSION_STARTED_KEY = "material_lib_audit_session_started_ms";

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateAuditSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
    const id = newSessionId();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return newSessionId();
  }
}

function markSessionStarted(): void {
  try {
    if (!sessionStorage.getItem(SESSION_STARTED_KEY)) {
      sessionStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

function sessionDurationMs(): number | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STARTED_KEY);
    if (!raw) return null;
    const t0 = Number(raw);
    if (!Number.isFinite(t0)) return null;
    return Math.max(0, Date.now() - t0);
  } catch {
    return null;
  }
}

/** Fire-and-forget: ошибки аудита не должны мешать UX. */
export function postAuditEventSafe(
  partial: Omit<AuditEventPayload, "session_id"> & { session_id?: string },
): void {
  const session_id = partial.session_id ?? getOrCreateAuditSessionId();
  void postAuditEvent({ ...partial, session_id }).catch(() => undefined);
}

export async function startAuditSession(): Promise<string> {
  const session_id = getOrCreateAuditSessionId();
  markSessionStarted();
  try {
    await postAuditSessionStart({ session_id });
  } catch {
    /* soft-fail */
  }
  return session_id;
}

export function endAuditSession(ok = true): void {
  const session_id = getOrCreateAuditSessionId();
  const duration_ms = sessionDurationMs();
  const body = JSON.stringify({
    session_id,
    duration_ms,
    ok,
  });
  const url = `${apiBaseUrl()}/audit/session/end`;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) {
        return;
      }
    }
  } catch {
    /* fall through */
  }
  void postAuditSessionEnd({ session_id, duration_ms, ok }).catch(() => undefined);
}

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";
}

export function auditNavTabSelected(container: string, tab: string): void {
  postAuditEventSafe({
    event_name: "NAV_TAB_SELECTED",
    event_category: "Навигация",
    event_action: "Выбрано",
    data: { контейнер: container, вкладка: tab },
  });
}

export function auditMaterialSelected(name: string): void {
  postAuditEventSafe({
    event_name: "MATERIAL_SELECTED",
    event_category: "Данные",
    event_action: "Выбрано",
    entity: { type: "Материал", name },
  });
}

export function auditMaterialCreateDraft(name: string): void {
  postAuditEventSafe({
    event_name: "MATERIAL_CREATE_DRAFT",
    event_category: "Данные",
    event_action: "Создано",
    entity: { type: "Материал", name },
  });
}

export function auditMaterialResetCreate(): void {
  postAuditEventSafe({
    event_name: "MATERIAL_RESET_CREATE",
    event_category: "Данные",
    event_action: "Сброшено",
  });
}

export function auditMaterialCancelChanges(name?: string): void {
  postAuditEventSafe({
    event_name: "MATERIAL_CANCEL_CHANGES",
    event_category: "Данные",
    event_action: "Отменено",
    entity: name ? { type: "Материал", name } : undefined,
  });
}

export function auditHelpOpen(
  eventName: "HELP_ABOUT_OPEN" | "HELP_INSTRUCTIONS_OPEN" | "HELP_CHANGELOG_OPEN",
): void {
  postAuditEventSafe({
    event_name: eventName,
    event_category: "Навигация",
    event_action: "Открыто",
  });
}
