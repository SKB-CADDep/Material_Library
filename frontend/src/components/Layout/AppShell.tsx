import { NavLink, Outlet } from "react-router-dom";
import { useWorkspace } from "../../context/WorkSpaceContext";
import { useStickyRoutes } from "../../context/StickyRouteContext";

export function AppShell() {
  const { workspace, isOpen } = useWorkspace();
  const { selectionMainPath, editorMainPath } = useStickyRoutes();

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
        <NavLink to="/sources">Работа с источниками</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
