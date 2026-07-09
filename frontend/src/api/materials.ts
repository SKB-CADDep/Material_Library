import { api } from "./client";
import type { MaterialSummary } from "../types/api";

export async function listMaterials(): Promise<MaterialSummary[]> {
  const { data } = await api.get<MaterialSummary[]>("/materials");
  return data;
}