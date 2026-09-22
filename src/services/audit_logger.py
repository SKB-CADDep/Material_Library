from __future__ import annotations

import datetime as dt
import json
import os
import queue
import re
import sys
import threading
import uuid
from pathlib import Path
from typing import Any

import platform as platform_mod


class AuditLogger:
    """Универсальный аудит-логгер (JSONL) для аналитики.

    Пишет 1 JSON = 1 строка (JSONL), UTF-8.

    Основной файл: <base_dir>/logs/audit.jsonl (base_dir определяется автоматически или задаётся явно)
    Если основной файл недоступен (например, занят другим процессом / нет прав / не удалось залочить)
    — пишет fallback локально:
        %LOCALAPPDATA%\\AuditLogs\\<app_id>\\audit_fallback_<user>_<host>.jsonl

    Важно:
    - не пишет пути/формулы сам по себе; что передали в data/entity/counters — то и запишет,
      поэтому эти части должны формироваться кодом приложения с учетом вашей политики приватности.
    """

    # Рекомендованные словари: НЕ строгие, только для самодокументации/будущей валидации.
    RECOMMENDED_CATEGORIES = {
        "Сессия", "Навигация", "Импорт", "Операция", "Данные", "Экспорт",
        "Диаграммы", "Шаблоны", "Очереди", "База", "Система",
    }
    RECOMMENDED_ACTIONS = {
        "Старт", "Финиш", "Создано", "Изменено", "Удалено",
        "Загружено", "Сохранено", "Открыто", "Закрыто", "Выбрано", "Ошибка",
    }

    def __init__(
        self,
        app_id: str,
        app_version: str,
        *,
        main_log_path: Path | None = None,
        base_dir: Path | None = None,
        file_name: str = "audit.jsonl",
        enable_console_fallback: bool = False,
        session_id: str | None = None,
    ):
        self.app_id = str(app_id or "").strip() or "app"
        self.app_version = str(app_version or "").strip() or "Unknown"

        self.enable_console_fallback = bool(enable_console_fallback)

        self.user = self._safe_get_user()
        self.host = platform_mod.node() or os.environ.get("COMPUTERNAME", "") or "UnknownHost"
        self.user_domain = os.environ.get("USERDOMAIN", "")
        self.pid = os.getpid()

        self.device_os = "Windows" if os.name == "nt" else os.name
        self.device_os_version = platform_mod.version() if os.name == "nt" else platform_mod.platform()

        sid = (str(session_id).strip() if session_id is not None else "") or None
        self.session_id = sid if sid else uuid.uuid4().hex
        self._seq = 0
        self._session_seqs: dict[str, int] = {}
        self._seq_lock = threading.Lock()

        self._q: queue.SimpleQueue = queue.SimpleQueue()
        self._stop_sentinel = object()

        if main_log_path is not None:
            self.main_path = Path(main_log_path)
        else:
            if base_dir is None:
                base_dir = self._default_base_dir()
            base_dir = Path(base_dir)
            self.main_path = base_dir / "logs" / file_name

        self.fallback_path = self._build_fallback_path()

        self._ensure_dir(self.main_path.parent)
        self._ensure_dir(self.fallback_path.parent)

        self._writer_thread = threading.Thread(
            target=self._writer_loop, name="AuditLoggerWriter", daemon=True
        )
        self._writer_thread.start()

    # -----------------------
    # Public API (универсальный)
    # -----------------------

    def log(
        self,
        *,
        event_name: str,
        event_category: str,
        event_action: str,
        operation_id: str | None = None,
        parent_operation_id: str | None = None,
        result_ok: bool | None = None,
        result_status: str | None = None,
        result_error_kind: str | None = None,
        duration_ms: int | float | None = None,
        counters: dict[str, int | float] | None = None,
        entity: dict[str, Any] | None = None,
        changes_fields: list[str] | None = None,
        data: dict[str, Any] | None = None,
        session_id: str | None = None,
        actor_user: str | None = None,
    ) -> None:
        """Пишет одно нормализованное событие.
        Не выбрасывает исключения наружу.

        session_id / actor_user — override для веб-сессий браузера
        (один writer на процесс, разные session.id / actor.user в JSONL).
        """
        try:
            payload = self._build_event(
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
            self._q.put(payload)
        except Exception:
            return

    def new_operation_id(self) -> str:
        return uuid.uuid4().hex

    def log_session_start(
        self,
        *,
        session_id: str | None = None,
        actor_user: str | None = None,
    ) -> None:
        self.log(
            event_name="Сессия: запуск",
            event_category="Сессия",
            event_action="Старт",
            session_id=session_id,
            actor_user=actor_user,
        )

    def log_session_end(
        self,
        *,
        duration_ms: int | float | None = None,
        ok: bool = True,
        session_id: str | None = None,
        actor_user: str | None = None,
    ) -> None:
        self.log(
            event_name="Сессия: завершение",
            event_category="Сессия",
            event_action="Финиш",
            result_ok=bool(ok),
            result_status="Успех" if ok else "Ошибка",
            duration_ms=duration_ms,
            session_id=session_id,
            actor_user=actor_user,
        )

    def shutdown(self, timeout_sec: float = 2.0) -> None:
        """Best-effort остановка writer thread."""
        try:
            self._q.put(self._stop_sentinel)
        except Exception:
            return
        try:
            self._writer_thread.join(timeout=timeout_sec)
        except Exception:
            pass

    # -----------------------
    # Internals
    # -----------------------

    def _next_seq(self, session_key: str) -> int:
        with self._seq_lock:
            if session_key == self.session_id:
                self._seq += 1
                self._session_seqs[session_key] = self._seq
                return self._seq
            nxt = self._session_seqs.get(session_key, 0) + 1
            self._session_seqs[session_key] = nxt
            return nxt

    def _build_event(
        self,
        *,
        event_name: str,
        event_category: str,
        event_action: str,
        operation_id: str | None,
        parent_operation_id: str | None,
        result_ok: bool | None,
        result_status: str | None,
        result_error_kind: str | None,
        duration_ms: int | float | None,
        counters: dict[str, int | float] | None,
        entity: dict[str, Any] | None,
        changes_fields: list[str] | None,
        data: dict[str, Any] | None,
        session_id: str | None = None,
        actor_user: str | None = None,
    ) -> dict[str, Any]:
        now = dt.datetime.now().astimezone().isoformat(timespec="seconds")

        sid = (str(session_id).strip() if session_id else "") or self.session_id
        seq = self._next_seq(sid)
        user = (str(actor_user).strip() if actor_user else "") or self.user

        ev = {
            "name": str(event_name or "").strip(),
            "category": str(event_category or "").strip(),
            "action": str(event_action or "").strip(),
        }

        payload: dict[str, Any] = {
            "ts": now,
            "event": ev,
            "actor": {
                "user": user,
            },
            "app": {
                "id": self.app_id,
                "version": self.app_version,
            },
            "device": {
                "host": self.host,
                "os": self.device_os,
                "os_version": self.device_os_version,
            },
            "session": {
                "id": sid,
                "seq": seq,
            },
        }

        if operation_id:
            payload["operation"] = {
                "id": str(operation_id),
                "parent_id": str(parent_operation_id) if parent_operation_id else None,
            }

        # result/metrics/counters — добавляем только если есть данные
        if result_ok is not None or result_status is not None or result_error_kind is not None:
            payload["result"] = {
                "ok": bool(result_ok) if result_ok is not None else None,
                "status": (str(result_status).strip() if result_status is not None else None),
                "error_kind": (str(result_error_kind).strip() if result_error_kind else None),
            }

        if duration_ms is not None:
            payload["metrics"] = {"duration_ms": duration_ms}

        if counters:
            payload["counters"] = counters

        if entity:
            payload["entity"] = entity

        if changes_fields:
            payload["changes"] = {"fields": [str(x) for x in changes_fields if str(x).strip()]}

        if data:
            payload["data"] = data

        return payload

    def _writer_loop(self) -> None:
        while True:
            item = self._q.get()
            if item is self._stop_sentinel:
                break

            try:
                line = json.dumps(item, ensure_ascii=False, separators=(",", ":"), default=str)
            except Exception:
                continue

            ok = self._try_append_line(self.main_path, line)
            if not ok:
                ok2 = self._try_append_line(self.fallback_path, line)
                if not ok2 and self.enable_console_fallback:
                    try:
                        # последний шанс: stderr
                        sys.stderr.write(line + "\n")
                    except Exception:
                        pass

    def _try_append_line(self, path: Path, line: str) -> bool:
        """Пишем строку в JSONL. На Windows по возможности — неблокирующая блокировка."""
        try:
            with open(path, "a", encoding="utf-8", newline="\n") as f:
                locked = False
                if os.name == "nt":
                    try:
                        import msvcrt

                        f.seek(0, os.SEEK_END)
                        if f.tell() > 0:
                            f.seek(0)
                            msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
                            locked = True
                    except Exception:
                        locked = False

                try:
                    f.seek(0, os.SEEK_END)
                    f.write(line + "\n")
                    f.flush()
                finally:
                    if locked:
                        try:
                            f.seek(0)
                            import msvcrt

                            msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
                        except Exception:
                            pass
            return True
        except Exception:
            return False

    def _safe_get_user(self) -> str:
        try:
            import getpass
            return getpass.getuser()
        except Exception:
            return os.environ.get("USERNAME", "Unknown")

    def _default_base_dir(self) -> Path:
        # Универсально для .py и для frozen .exe
        try:
            if getattr(sys, "frozen", False):
                return Path(sys.executable).resolve().parent
        except Exception:
            pass

        try:
            # sys.argv[0] обычно путь к main.py / exe-обертке
            p = Path(sys.argv[0]).resolve()
            if p.exists():
                return p.parent
        except Exception:
            pass

        return Path.cwd()

    def _build_fallback_path(self) -> Path:
        base = os.environ.get("LOCALAPPDATA")
        if not base:
            base = str(Path.home() / "AppData" / "Local")

        safe_user = re.sub(r"[^A-Za-z0-9_\-\.]+", "_", self.user or "Unknown")
        safe_host = re.sub(r"[^A-Za-z0-9_\-\.]+", "_", self.host or "UnknownHost")
        return Path(base) / "AuditLogs" / self.app_id / f"audit_fallback_{safe_user}_{safe_host}.jsonl"

    def _ensure_dir(self, p: Path) -> None:
        try:
            p.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass