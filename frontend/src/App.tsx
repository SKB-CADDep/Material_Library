import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "./context/WorkSpaceContext";
import { AppShell } from "./components/Layout/AppShell";
import { OpenWorkspaceScreen } from "./components/Layout/OpenWorkSpaceScreen";
import { WaitingWorkspaceScreen } from "./components/Layout/WaitingWorkspaceScreen";
import { SelectionPage } from "./pages/SelectionPage";
import { EditorPage } from "./pages/EditorPage";
import { SourcesPage } from "./pages/SourcesPage";
import { EditorProvider } from "./context/EditorContext";

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
        <Route path="selection/*" element={<SelectionPage />} />
        <Route path="editor/*" element={<EditorPage />} />
        <Route path="sources" element={<SourcesPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <EditorProvider>
        <AppRoutes />
        </EditorProvider>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}