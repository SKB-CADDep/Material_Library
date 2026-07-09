import { api } from "./client";
import type { WorkspaceResponse } from "../types/api";

export async function openWorkspace(directory: string): Promise<WorkspaceResponse> {
  const { data } = await api.post<WorkspaceResponse>("/workspace/open", { directory });
  return data;
}

export async function getWorkspace(): Promise<WorkspaceResponse> {
  const { data } = await api.get<WorkspaceResponse>("/workspace");
  return data;
}