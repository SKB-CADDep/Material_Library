import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHealth } from "../api/health";
import { getWorkspace, openWorkspace } from "../api/workspace";
import type {
  WorkspacePlaceholderMode,
  WorkspaceResponse,
} from "../types/api";

const WORKSPACE_POLL_MS = 3_000;

type WorkspaceContextValue = {
  workspace: WorkspaceResponse | null;
  isLoading: boolean;
  isOpen: boolean;
  placeholderMode: WorkspacePlaceholderMode;
  configuredMaterialsDir: string | null;
  error: Error | null;
  openDirectory: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    staleTime: 30_000,
    retry: 1,
  });

  const expectsAutoOpen = Boolean(healthQuery.data?.materials_dir);

  const workspaceQuery = useQuery({
    queryKey: ["workspace"],
    queryFn: getWorkspace,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: (query) => {
      if (query.state.data?.directory) return false;
      return expectsAutoOpen ? WORKSPACE_POLL_MS : false;
    },
  });

  const data = workspaceQuery.data;
  const isOpen = Boolean(data?.directory);
  const placeholderMode: WorkspacePlaceholderMode = expectsAutoOpen
    ? "waiting"
    : "manual";
  const isLoading = !healthQuery.isFetched || !workspaceQuery.isFetched;

  useEffect(() => {
    if (!data?.directory) return;
    void queryClient.invalidateQueries({ queryKey: ["materials"] });
    void queryClient.invalidateQueries({ queryKey: ["sources"] });
    void queryClient.invalidateQueries({ queryKey: ["selection"] });
  }, [data?.directory, queryClient]);

  const openDirectory = async (directory: string) => {
    const ws = await openWorkspace(directory);
    queryClient.setQueryData(["workspace"], ws);
    await queryClient.invalidateQueries({ queryKey: ["materials"] });
    await queryClient.invalidateQueries({ queryKey: ["sources"] });
    await queryClient.invalidateQueries({ queryKey: ["selection"] });
  };

  const refresh = async () => {
    await Promise.all([healthQuery.refetch(), workspaceQuery.refetch()]);
  };

  const error =
    (workspaceQuery.error as Error | null) ??
    (healthQuery.error as Error | null);

  const value: WorkspaceContextValue = {
    workspace: data ?? null,
    isLoading,
    isOpen,
    placeholderMode,
    configuredMaterialsDir: healthQuery.data?.materials_dir ?? null,
    error,
    openDirectory,
    refresh,
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
