import { api } from "./client";
import type { PropertiesResponse } from "../types/api";
import physical from "../../../config/physical_properties.json";
import mechanical from "../../../config/mechanical_properties.json";

export async function getPropertiesCatalog(): Promise<PropertiesResponse> {
  try {
    const { data } = await api.get<PropertiesResponse>("/catalogs/properties");
    return data;
  } catch {
    return {physical, mechanical} as PropertiesResponse;
  }
}