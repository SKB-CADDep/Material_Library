import { api } from "./client";
import type { WorkspaceResponse } from "../types/api";

export async function openWorkspace(directory: string): Promise<WorkspaceResponse> {
  const { data } = await api.post<WorkspaceResponse>("/workspace/open", { directory });
  return data;
}

export async function getWorkspace(): Promise<WorkspaceResponse | null> {
  const { status, data } = await api.get<WorkspaceResponse>("/workspace", {
    validateStatus: (code) => code === 200 || code === 404,
  });
  return status === 200 ? data : null;
}