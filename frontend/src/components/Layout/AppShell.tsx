import { NavLink, Outlet } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";

export function AppShell() {
  const { workspace ,isOpen, openDirectory } = useWorkspace();

  const handleOpenFolder = async () => {
    // Вариант A: prompt с путём (dev, пока backend не готов)
    const path = window.prompt("Путь к папке с JSON:", workspace?.directory ?? "");
    if (path) await openDirectory(path);
  };

  return (
    <div className="app-shell">
      <header>
        <nav className="menu-bar">
          <div className="menu">
            <button type="button">Файл ▾</button>
            <div className="menu-dropdown">
              <button type="button" onClick={handleOpenFolder}>
                Открыть директорию…
              </button>
            </div>
          </div>
        </nav>

        {isOpen && (
          <p className="workspace-info">
            {workspace!.directory} · {workspace!.count} материалов
          </p>
        )}
      </header>

      {/* Три «вкладки» Notebook → NavLink */}
      <nav className="main-tabs">
        <NavLink to="/selection">Подбор материала</NavLink>
        <NavLink to="/editor">Добавление / Редактирование</NavLink>
        <NavLink to="/sources">Работа с источниками</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}