import { api } from "./client";
import type {
  TemperatureSelectionRequest,
  TemperatureSelectionResponse,
} from "../types/api";

export async function postTemperatureSelection(
  body: TemperatureSelectionRequest,
): Promise<TemperatureSelectionResponse> {
  const { data } = await api.post<TemperatureSelectionResponse>(
    "/selection/temperature",
    body,
  );
  return data;
}