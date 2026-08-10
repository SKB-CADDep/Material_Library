import { api } from "./client";
import type { ClassificationResponse } from "../types/api";
import fallbackCatalog from "../../../config/material_classification.json";

export async function getClassificationCatalog(): Promise<ClassificationResponse> {
  try {
    const { data } = await api.get<ClassificationResponse>("/catalogs/classification");
    return data;
  } catch {
    return fallbackCatalog as ClassificationResponse;
  }
}
