import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkspace, openWorkspace } from "../api/workspace";
import type { WorkspaceResponse } from "../types/api";

type WorkspaceContextValue = {
  workspace: WorkspaceResponse | null;
  isLoading: boolean;
  isOpen: boolean;
  error: Error | null;
  openDirectory: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["workspace"],
    queryFn: getWorkspace,
    retry: false, // 404 = workspace не открыт, это норма
  });

  const openDirectory = async (directory: string) => {
    const ws = await openWorkspace(directory);
    queryClient.setQueryData(["workspace"], ws);
    // материалы перезагрузятся — инвалидируем список
    await queryClient.invalidateQueries({ queryKey: ["materials"] });
  };

  const value: WorkspaceContextValue = {
    workspace: data ?? null,
    isLoading,
    isOpen: Boolean(data?.directory),
    error: error as Error | null,
    openDirectory,
    refresh: async () => { await refetch(); },
  };

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace вне WorkspaceProvider");
  return ctx;
}