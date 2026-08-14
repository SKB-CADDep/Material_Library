import { api } from "./client";
import type {
  SourceItem,
  SourcesResponse,
  SourceUsageResponse,
  TabType,
} from "../types/api";

export async function getSources(): Promise<SourcesResponse> {
  const { data } = await api.get<SourcesResponse>("/sources");
  return data;
}

export async function createSource(data: {
  name: string;
  description: string;
  hyperlink: string;
  group: TabType;
}): Promise<SourceItem> {
  const { data: response } = await api.post<SourceItem>("/sources", data);
  return response;
}

export async function updateSource(
  id: string,
  data: {
    name?: string;
    description?: string;
    hyperlink?: string;
  }
): Promise<SourceItem> {
  const { data: response } = await api.put<SourceItem>(`/sources/${id}`, data);
  return response;
}

export async function getSourceUsage(id: string): Promise<SourceUsageResponse> {
  const { data } = await api.get<SourceUsageResponse>(`/sources/${id}/usage`);
  return data;
}

export async function deleteSource(id: string): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(`/sources/${id}`);
  return data;
}