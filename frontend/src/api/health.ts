import { api } from "./client";
import type { HealthResponse } from "../types/api";

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>("/health");
  return data;
}
