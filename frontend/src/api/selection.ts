import { api } from "./client";
import type {
  AshbyOptionsResponse,
  AshbyRequest,
  AshbyResponse,
  ComparePropsPoolRequest,
  ComparePropsPoolResponse,
  ComparePropsRequest,
  ComparePropsResponse,
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

export async function postComparePropsPool(
  body: ComparePropsPoolRequest,
): Promise<ComparePropsPoolResponse> {
  const { data } = await api.post<ComparePropsPoolResponse>(
    "/selection/compare-props/pool",
    body,
  );
  return data;
}

export async function postCompareProps(
  body: ComparePropsRequest,
): Promise<ComparePropsResponse> {
  const { data } = await api.post<ComparePropsResponse>(
    "/selection/compare-props",
    body,
  );
  return data;
}

export async function getChemCompositionEntries(): Promise<ChemCompositionEntriesResponse> {
  const { data } = await api.get<ChemCompositionEntriesResponse>(
    "/selection/chem/composition-entries",
  );
  return data;
}
