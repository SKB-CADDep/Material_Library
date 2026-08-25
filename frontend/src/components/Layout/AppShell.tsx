import { NavLink, Outlet } from "react-router-dom";
import { useWorkspace } from "../../context/WorkSpaceContext";
import { useState, useRef, useEffect } from 'react';
import { HelpMenu } from "../HelpMenu";

export function AppShell() {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);


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
    const path = window.prompt("Путь к папке с JSON:", workspace?.directory ?? "");
    if (path) await openDirectory(path);
  };

  
  return (
    <div className="app-shell">
      <div className="window-header">
        <span className="window-title">Material_Lib (2.1.20)</span>
        {isOpen && (
          <p className="workspace-info">
            {workspace!.directory} · {workspace!.count} материалов
          </p>
        )}
      </div>

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