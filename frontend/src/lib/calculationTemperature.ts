import type { SingleCalculationRow } from "../types/api";

const TEMPERATURE_EPSILON = 1e-6;

export function parseCalculationTemperature(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRowTemperature(value: number | string): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  return parseCalculationTemperature(String(value));
}

export function temperaturesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TEMPERATURE_EPSILON;
}

export function isDuplicateCalculationTemperature(
  temp: number,
  customTemps: number[],
  dbRows: SingleCalculationRow[],
): boolean {
  if (customTemps.some((existing) => temperaturesEqual(existing, temp))) {
    return true;
  }

  return dbRows.some((row) => {
    const rowTemp = normalizeRowTemperature(row.temperature);
    return rowTemp !== null && temperaturesEqual(rowTemp, temp);
  });
}

export function formatCalculationTemperature(temp: number): string {
  return Number.isInteger(temp) ? String(temp) : String(temp);
}
