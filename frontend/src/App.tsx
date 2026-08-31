import { useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "./context/WorkSpaceContext";
import { AppShell } from "./components/Layout/AppShell";
import { OpenWorkspaceScreen } from "./components/Layout/OpenWorkSpaceScreen";
import { WaitingWorkspaceScreen } from "./components/Layout/WaitingWorkspaceScreen";
import { SelectionPage } from "./pages/SelectionPage";
import { EditorPage } from "./pages/EditorPage";
import { SourcesPage } from "./pages/SourcesPage";
import { EditorProvider } from "./context/EditorContext";
import { StickyRouteProvider } from "./context/StickyRouteContext";
import { KeepAlivePanes } from "./components/KeepAlivePanes";
import { mainPageKeyFromPath } from "./lib/keepAliveRoutes";

const MAIN_KEEP_ALIVE_PANES = [
  { key: "selection", node: <SelectionPage /> },
  { key: "editor", node: <EditorPage /> },
  { key: "sources", node: <SourcesPage /> },
];

function KeepAliveMainPages() {
  const { pathname } = useLocation();
  const activeKey = mainPageKeyFromPath(pathname);

  return <KeepAlivePanes activeKey={activeKey} panes={MAIN_KEEP_ALIVE_PANES} />;
}

function AppRoutes() {
  const { isOpen, isLoading, error, placeholderMode, configuredMaterialsDir } =
    useWorkspace();

  if (isLoading) {
    return (
      <div className="workspace-bootstrap">
        <p className="status-message">Загрузка…</p>
      </div>
    );
  }

  if (!isOpen) {
    if (error) {
      return (
        <div className="workspace-bootstrap">
          <p className="status-message error">
            Не удалось проверить workspace: {error.message}
          </p>
        </div>
      );
    }
    if (placeholderMode === "waiting" && configuredMaterialsDir) {
      return <WaitingWorkspaceScreen materialsDir={configuredMaterialsDir} />;
    }
    return <OpenWorkspaceScreen />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/selection" replace />} />
        <Route path="*" element={<KeepAliveMainPages />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <EditorProvider>
        <StickyRouteProvider>
        <AppRoutes />
        </StickyRouteProvider>
        </EditorProvider>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}