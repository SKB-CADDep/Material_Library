import { api } from "./client";
import type { ElementItem, ElementsCatalogResponse } from "../types/api";

export type ElementWritePayload = {
  symbol: string;
  name: string;
  display_symbol?: string | null;
  color?: string | null;
  influence?: string | null;
  min?: number | null;
};

export async function getElementsCatalog(): Promise<ElementsCatalogResponse> {
  const { data } = await api.get<ElementsCatalogResponse>("/catalogs/elements");
  return data;
}

export async function createElement(
  payload: ElementWritePayload,
): Promise<ElementItem> {
  const { data } = await api.post<ElementItem>("/catalogs/elements", payload);
  return data;
}

export async function updateElement(
  symbol: string,
  payload: Partial<ElementWritePayload>,
): Promise<ElementItem> {
  const { data } = await api.put<ElementItem>(
    `/catalogs/elements/${encodeURIComponent(symbol)}`,
    payload,
  );
  return data;
}

export async function deleteElement(symbol: string): Promise<void> {
  await api.delete(`/catalogs/elements/${encodeURIComponent(symbol)}`);
}
