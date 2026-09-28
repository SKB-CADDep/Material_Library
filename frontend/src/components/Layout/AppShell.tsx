import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useWorkspace } from "../../context/WorkSpaceContext";
import { useStickyRoutes } from "../../context/StickyRouteContext";
import { useEditor } from "../../context/EditorContext";
import { auditNavFromPath } from "../../lib/auditNavLabels";
import {
  auditNavTabSelected,
  endAuditSession,
  startAuditSession,
} from "../../lib/auditSession";

export function AppShell() {
  const { workspace, isOpen } = useWorkspace();
  const { selectionMainPath, editorMainPath } = useStickyRoutes();
  const { pathname } = useLocation();
  const { hasUnsavedChanges } = useEditor();
  const lastNavKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void startAuditSession();
    const onPageHide = () => endAuditSession(true);
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      endAuditSession(true);
      // Предупреждение только при закрытии/обновлении окна — черновик на других вкладках сохраняем.
      if (!hasUnsavedChanges) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      endAuditSession(true);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const { container, tab } = auditNavFromPath(pathname);
    const key = `${container}::${tab}`;
    if (lastNavKeyRef.current === key) {
      return;
    }
    lastNavKeyRef.current = key;
    auditNavTabSelected(container, tab);
  }, [pathname]);

  return (
    <div className="app-shell">
      <div className="window-header">
        <span className="window-title">Material_Lib (2.1.20)</span>
        {isOpen && (
          <p className="workspace-info">
            {workspace!.directory} · {workspace!.count} материалов
          </p>
        )}
        <p className="session-reset-hint">
          Чтобы сбросить фильтры, выбранные материалы и черновики, нажмите F5
        </p>
      </div>

      <nav className="main-tabs">
        <NavLink to={selectionMainPath}>Подбор материала</NavLink>
        <NavLink to={editorMainPath}>Добавление / Редактирование</NavLink>
        <NavLink to="/sources">Список литературы</NavLink>
        <NavLink to="/elements">Справочник элементов</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
