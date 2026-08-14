import { api } from "./client";
import type {
  AshbyOptionsResponse,
  AshbyRequest,
  AshbyResponse,
  ChemCompositionEntriesResponse,
  TemperatureSelectionRequest,
  TemperatureSelectionResponse,
  SingleCalculationRequest,
  SingleCalculationResponse,
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

export async function postSingleCalculation(
  body: SingleCalculationRequest,
): Promise<SingleCalculationResponse> {
  const { data } = await api.post<SingleCalculationResponse>(
    "/selection/calculate",
    body,
  );
  return data;
}

export async function getAshbyOptions(
  areas?: string[],
): Promise<AshbyOptionsResponse> {
  const { data } = await api.get<AshbyOptionsResponse>(
    "/selection/ashby/options",
    {
      params: areas && areas.length > 0 ? { areas } : undefined,
      paramsSerializer: {
        indexes: null,
      },
    },
  );
  return data;
}

export async function postAshby(body: AshbyRequest): Promise<AshbyResponse> {
  const { data } = await api.post<AshbyResponse>("/selection/ashby", body);
  return data;
}

export async function getChemCompositionEntries(): Promise<ChemCompositionEntriesResponse> {
  const { data } = await api.get<ChemCompositionEntriesResponse>(
    "/selection/chem/composition-entries",
  );
  return data;
}
