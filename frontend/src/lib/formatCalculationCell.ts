import type { CalculationCell } from "../types/api";
import { formatDecimal } from "./formatDecimal";

export const CALCULATION_CELL_TITLES = {
  exact: "Точное значение из базы данных",
  interp: "Рассчитано интерполяцией между точками",
  approx: "Рассчитано экстраполяцией за пределы диапазона",
} as const;

function toDisplayNumber(value: CalculationCell["value"]): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function formatCalculationCell(cell: CalculationCell | undefined): string {
  const numeric = toDisplayNumber(cell?.value ?? null);
  if (!cell || numeric === null) {
    return "—";
  }
  return formatDecimal(numeric, 1);
}

export function calculationCellModeClass(
  mode: CalculationCell["mode"] | undefined,
): string {
  if (mode === "interp") {
    return "calculation-cell--interp";
  }
  if (mode === "approx") {
    return "calculation-cell--approx";
  }
  if (mode === "scalar") {
    return "calculation-cell--scalar";
  }
  return "";
}

export function calculationCellModeTitle(
  mode: CalculationCell["mode"] | undefined,
): string {
  if (mode === "interp") {
    return CALCULATION_CELL_TITLES.interp;
  }
  if (mode === "approx") {
    return CALCULATION_CELL_TITLES.approx;
  }
  return CALCULATION_CELL_TITLES.exact;
}
