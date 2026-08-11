import { useEffect } from "react";
import Markdown from "react-markdown";
import type { HelpDocumentId } from "../api/help";

type HelpDialogProps = {
  open: boolean;
  title: string;
  content: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

export function HelpDialog({
  open,
  title,
  content,
  loading = false,
  error = null,
  onClose,
}: HelpDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="help-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="help-dialog__header">
          <h2 id="help-dialog-title">{title}</h2>
          <button type="button" className="help-dialog__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <div className="help-dialog__body">
          {loading && <p className="tab-placeholder">Загрузка…</p>}
          {!loading && error && <p className="error-message">{error}</p>}
          {!loading && !error && (
            <article className="help-markdown">
              <Markdown>{content}</Markdown>
            </article>
          )}
        </div>
        <footer className="help-dialog__footer">
          <button type="button" className="retry-button" onClick={onClose}>
            OK
          </button>
        </footer>
      </div>
    </div>
  );
}

export const HELP_MENU: { id: HelpDocumentId; label: string }[] = [
  { id: "about", label: "О приложении" },
  { id: "instruction", label: "Инструкция" },
  { id: "changelog", label: "Список изменений" },
];
