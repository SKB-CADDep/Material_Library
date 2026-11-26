import { EMPTY_CELL, isEmptyCellMarker } from "./emptyCell";
import { formatDecimal } from "./formatDecimal";
import type {
  CalculationCell,
  TemperatureSelectionRow,
  UnitResponse,
} from "../types/api";
import type { SelectionSortColumn } from "./sortSelectionRows";
import { usesHardnessTableConversion } from "./hardnessConversion";
import { convertBetweenUnits } from "./unitConversion";


export const SELECTION_EMPTY = EMPTY_CELL;

export const HARDNESS_COLUMN_KEYS = [
  "min_value",
  "max_value",
  "unit_value",
] as const;

type ScrollColumnMeta = {
  key: string;
  unit: string;
  unit_type?: string | null;
};

export type SelectionCellRaw =
  | number
  | string
  | null
  | undefined
  | CalculationCell;

/** Достаёт число/строку из ячейки подбора (plain или {value, mode}). */
export function unwrapSelectionCellValue(
  raw: SelectionCellRaw,
): number | string | null | undefined {
  if (raw === null || raw === undefined) {
    return raw;
  }
  if (typeof raw === "object" && "value" in raw) {
    return raw.value;
  }
  return raw;
}

/** Режим расчёта ячейки (как на вкладке «Расчёт отдельно»), иначе null. */
export function getSelectionCellMode(
  raw: SelectionCellRaw,
): CalculationCell["mode"] | null {
  if (raw && typeof raw === "object" && "mode" in raw) {
    return raw.mode;
  }
  return null;
}

export function formatSelectionFrozenValue(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return SELECTION_EMPTY;
  }
  const text = String(value);
  return isEmptyCellMarker(text) ? SELECTION_EMPTY : text;
}

function formatSelectionNumericValue(value: number): string {
  if (!Number.isFinite(value)) {
    return SELECTION_EMPTY;
  }
  return formatDecimal(value, 2);
}

type SelectionCellFormatOptions = {
  columnKey: string;
  baseUnit: string;
  displayUnit: string;
  unitConfig?: UnitResponse;
  rowSourceUnit?: number | string | null;
};

function selectionSourceUnit(
  columnKey: string,
  baseUnit: string,
  rowSourceUnit: number | string | null | undefined,
): string {
  if (columnKey !== "min_value" && columnKey !== "max_value") {
    return baseUnit;
  }
  if (
    rowSourceUnit === null ||
    rowSourceUnit === undefined ||
    isEmptyCellMarker(String(rowSourceUnit))
  ) {
    return baseUnit;
  }
  return String(rowSourceUnit).trim();
}

/** Число в единице колонки, подпись или null, если ячейка пустая. */
export function selectionCellComparableValue(
  raw: SelectionCellRaw,
  options: SelectionCellFormatOptions,
): number | string | null {
  const { columnKey, baseUnit, displayUnit, unitConfig, rowSourceUnit } =
    options;
  const value = unwrapSelectionCellValue(raw);

  if (columnKey === "unit_value") {
    if (displayUnit) {
      return displayUnit;
    }
    if (value === null || value === undefined || value === "") {
      return null;
    }
    return String(value);
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const sourceUnit = selectionSourceUnit(columnKey, baseUnit, rowSourceUnit);
  if (
    !unitConfig ||
    !sourceUnit ||
    !displayUnit ||
    sourceUnit === displayUnit
  ) {
    return numeric;
  }

  try {
    const converted = convertBetweenUnits(
      numeric,
      sourceUnit,
      displayUnit,
      unitConfig,
    );
    return Number.isFinite(converted) ? converted : null;
  } catch {
    if (usesHardnessTableConversion(unitConfig.factors)) {
      return null;
    }
    return numeric;
  }
}

export function formatSelectionCellValue(
  raw: SelectionCellRaw,
  options: SelectionCellFormatOptions,
): string {
  const comparable = selectionCellComparableValue(raw, options);
  if (comparable === null) {
    return SELECTION_EMPTY;
  }
  if (typeof comparable === "number") {
    return formatSelectionNumericValue(comparable);
  }
  return isEmptyCellMarker(comparable) ? SELECTION_EMPTY : comparable;
}

export function syncHardnessColumnUnits(
  columnKey: string,
  unit: string,
  prev: Record<string, string>,
): Record<string, string> {
  if (
    !HARDNESS_COLUMN_KEYS.includes(
      columnKey as (typeof HARDNESS_COLUMN_KEYS)[number],
    )
  ) {
    return { ...prev, [columnKey]: unit };
  }

  const next = { ...prev };
  for (const key of HARDNESS_COLUMN_KEYS) {
    next[key] = unit;
  }
  return next;
}

export function getSelectionCellDisplayText(
  row: TemperatureSelectionRow,
  column: SelectionSortColumn,
  scrollColumns: ScrollColumnMeta[],
  columnUnits: Record<string, string>,
  unitConfigs: Record<string, UnitResponse>,
): string {
  switch (column) {
    case "material_name":
      return formatSelectionFrozenValue(row.material_name);
    case "strength_category":
      return formatSelectionFrozenValue(row.strength_category);
    case "source":
      return formatSelectionFrozenValue(row.source);
    case "max_temp":
      return formatSelectionFrozenValue(row.max_temp);
    default: {
      const col = scrollColumns.find((item) => item.key === column);
      if (!col) {
        return "";
      }

      const unitConfig = col.unit_type
        ? unitConfigs[col.unit_type]
        : undefined;
      const displayUnit = columnUnits[col.key] ?? col.unit ?? "";

      return formatSelectionCellValue(row.values[col.key], {
        columnKey: col.key,
        baseUnit: col.unit ?? "",
        displayUnit,
        unitConfig,
        rowSourceUnit: unwrapSelectionCellValue(row.values.unit_value),

     });
    }
  }
}
