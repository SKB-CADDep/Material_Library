import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useWorkspace } from "../../context/WorkSpaceContext";
import { useStickyRoutes } from "../../context/StickyRouteContext";
import { HelpMenu } from "../HelpMenu";
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
  const lastNavKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void startAuditSession();
    const onHide = () => endAuditSession(true);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      endAuditSession(true);
    };
  }, []);

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
        <HelpMenu />
      </div>

      <nav className="main-tabs">
        <NavLink to={selectionMainPath}>Подбор материала</NavLink>
        <NavLink to={editorMainPath}>Добавление / Редактирование</NavLink>
        <NavLink to="/sources">Работа с источниками</NavLink>
        <NavLink to="/elements">Справочник элементов</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
