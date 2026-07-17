import { api } from "./client";
import type { UnitResponse} from "../types/api";

export async function getUnits(unit_type: string): Promise<UnitResponse> {
  const { data } = await api.get<UnitResponse>(`/catalogs/units/${encodeURIComponent(unit_type)}`);
  return data ;
}