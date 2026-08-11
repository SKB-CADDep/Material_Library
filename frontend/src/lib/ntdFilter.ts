import type { TemperatureSelectionRow } from "../types/api";

export const ALL_NTD_FILTER = "";

export function normalizeNtdLabel(source: string | null | undefined): string {
  const trimmed = String(source ?? "").trim();
  return trimmed || "—";
}

export function collectNtdFilterOptions(
  rows: TemperatureSelectionRow[],
): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const row of rows) {
    const label = normalizeNtdLabel(row.source);
    if (seen.has(label)) {
      continue;
    }
    seen.add(label);
    options.push(label);
  }
  return options.sort((a, b) => a.localeCompare(b, "ru"));
}

export function rowMatchesNtdFilter(
  row: TemperatureSelectionRow,
  selectedNtd: string,
): boolean {
  if (!selectedNtd) {
    return true;
  }
  return normalizeNtdLabel(row.source) === selectedNtd;
}

export function filterRowsByNtd<T extends TemperatureSelectionRow>(
  rows: T[],
  selectedNtd: string,
): T[] {
  if (!selectedNtd) {
    return rows;
  }
  return rows.filter((row) => rowMatchesNtdFilter(row, selectedNtd));
}
