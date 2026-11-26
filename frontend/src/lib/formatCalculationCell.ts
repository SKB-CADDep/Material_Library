import type { CalculationCell, UnitResponse } from "../types/api";
import { EMPTY_CELL } from "./emptyCell";
import { formatDecimal } from "./formatDecimal";
import { usesHardnessTableConversion } from "./hardnessConversion";
import { convertBetweenUnits } from "./unitConversion";

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

/** Число ячейки в единице колонки. Твёрдость вне таблицы — пусто, не исходное HB. */
export function calculationCellInDisplayUnit(
  cell: CalculationCell | undefined,
  options: {
    baseUnit: string;
    displayUnit: string;
    unitConfig?: UnitResponse;
  },
): CalculationCell | undefined {
  const { baseUnit, displayUnit, unitConfig } = options;
  if (
    cell?.value == null ||
    !unitConfig ||
    !baseUnit ||
    !displayUnit ||
    baseUnit === displayUnit
  ) {
    return cell;
  }

  const numeric =
    typeof cell.value === "number" ? cell.value : Number(cell.value);
  if (!Number.isFinite(numeric)) {
    return cell;
  }

  try {
    const converted = convertBetweenUnits(
      numeric,
      baseUnit,
      displayUnit,
      unitConfig,
    );
    return { ...cell, value: converted };
  } catch {
    if (usesHardnessTableConversion(unitConfig.factors)) {
      return { ...cell, value: null };
    }
    return cell;
  }
}

export function formatCalculationCell(cell: CalculationCell | undefined): string {
  const numeric = toDisplayNumber(cell?.value ?? null);
  if (!cell || numeric === null) {
    return EMPTY_CELL;
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
