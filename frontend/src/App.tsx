import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "./context/WorkspaceContext";
import { AppShell } from "./components/Layout/AppShell";
import { OpenWorkspaceScreen } from "./components/Layout/OpenWorkspaceScreen";
import { SelectionPage } from "./pages/SelectionPage";
import { EditorPage } from "./pages/EditorPage";
import { SourcesPage } from "./pages/SourcesPage";

function AppRoutes() {
  const { isOpen, isLoading } = useWorkspace();

  if (isLoading) return <p>Загрузка…</p>;
  if (!isOpen) return <OpenWorkspaceScreen />;

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
        <AppRoutes />
      </WorkspaceProvider>
    </BrowserRouter>
  );
}