import { NavLink, Outlet } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useState, useRef, useEffect } from 'react';

export function AppShell() {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрыть меню при клике вне его
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsFileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { workspace ,isOpen, openDirectory } = useWorkspace();

  const handleOpenFolder = async () => {
    // Вариант A: prompt с путём (dev, пока backend не готов)
    const path = window.prompt("Путь к папке с JSON:", workspace?.directory ?? "");
    if (path) await openDirectory(path);
  };

  
  return (
    <div className="app-shell">
      <div className="window-header">
        <span className="window-title">Material_Lib (2.1.20)</span>
      </div>

      <header className="app-header">
      <div className="menu-button-wrapper" ref={menuRef}>
        <button 
          className="menu-button"
          onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
        >
          Файл ▾
        </button>

        {/* Выпадающее меню */}
        {isFileMenuOpen && (
          <div className="dropdown">
            <button 
              className="dropdown-item"
              onClick={handleOpenFolder}
            >
              Открыть директорию...
            </button>
          </div>
        )}
      </div>
      <button className="menu-button">Справка</button>

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