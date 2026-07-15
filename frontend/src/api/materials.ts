import { api } from "./client";
import type { MaterialSummary, MaterialSaveResponse} from "../types/api";

export async function listMaterials(): Promise<MaterialSummary[]> {
  const { data } = await api.get<MaterialSummary[]>("/materials");
  return data;
}
export async function getMaterial(id:string): Promise<Record<string, unknown>>{
  const { data } = await api.get<Record<string, unknown>>(`/materials/${id}`)
  return data;
}

export async function saveMaterial(id:string, body: Record<string,unknown>):Promise<MaterialSaveResponse>{
  const { data } = await api.put<MaterialSaveResponse>(`/materials/${id}`, body)
  return data;
}