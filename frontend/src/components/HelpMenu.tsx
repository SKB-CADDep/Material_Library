import { useCallback, useRef, useState } from "react";
import { getHelpDocument, type HelpDocumentId } from "../api/help";
import { HelpDialog, HELP_MENU } from "./HelpDialog";

export function HelpMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const openDocument = async (id: HelpDocumentId, docTitle: string) => {
    closeMenu();
    setDialogOpen(true);
    setTitle(docTitle);
    setContent("");
    setError(null);
    setLoading(true);
    try {
      const markdown = await getHelpDocument(id);
      setContent(markdown);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось загрузить справку";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="menu-button-wrapper" ref={menuRef}>
        <button
          type="button"
          className="menu-button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((prev) => !prev)}
          onBlur={(event) => {
            if (!menuRef.current?.contains(event.relatedTarget as Node)) {
              closeMenu();
            }
          }}
        >
          Справка ▾
        </button>
        {menuOpen && (
          <div className="dropdown" role="menu">
            {HELP_MENU.map((item) => (
              <button
                key={item.id}
                type="button"
                className="dropdown-item"
                role="menuitem"
                onClick={() => void openDocument(item.id, item.label)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <HelpDialog
        open={dialogOpen}
        title={title}
        content={content}
        loading={loading}
        error={error}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
