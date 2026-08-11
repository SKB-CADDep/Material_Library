import type { TemperatureSelectionRow, UnitResponse } from "../types/api";
import type { SelectionSortColumn } from "./sortSelectionRows";
import { convertBetweenUnits } from "./unitConversion";


export const SELECTION_EMPTY = "-";

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

export function formatSelectionFrozenValue(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return SELECTION_EMPTY;
  }
  return String(value);
}

function formatSelectionNumericValue(value: number): string {
  return value.toFixed(2);
}

export function formatSelectionCellValue(
  raw: number | string | null | undefined,
  options: {
    columnKey: string;
    baseUnit: string;
    displayUnit: string;
    unitConfig?: UnitResponse;
    rowSourceUnit?: number | string | null;
  },
): string {
  const { columnKey, baseUnit, displayUnit, unitConfig, rowSourceUnit } =
    options;

  if (columnKey === "unit_value") {
    if (displayUnit) {
      return displayUnit;
    }
    if (raw === null || raw === undefined || raw === "") {
      return SELECTION_EMPTY;
    }
    return String(raw);
  }

  if (raw === null || raw === undefined || raw === "") {
    return SELECTION_EMPTY;
  }

  const numeric = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(numeric)) {
    return String(raw);
  }

  let sourceUnit = baseUnit;
  if (columnKey === "min_value" || columnKey === "max_value") {
    const rowUnit = rowSourceUnit;
    if (
      rowUnit !== null &&
      rowUnit !== undefined &&
      String(rowUnit).trim() !== "" &&
      String(rowUnit).trim() !== SELECTION_EMPTY
    ) {
      sourceUnit = String(rowUnit).trim();
    }
  }

  if (
    unitConfig &&
    sourceUnit &&
    displayUnit &&
    sourceUnit !== displayUnit
  ) {
    try {
      const converted = convertBetweenUnits(
        numeric,
        sourceUnit,
        displayUnit,
        unitConfig,
      );
      return formatSelectionNumericValue(converted);
    } catch {
      return formatSelectionNumericValue(numeric);
    }
  }

  return formatSelectionNumericValue(numeric);
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
        rowSourceUnit: row.values.unit_value,
      });
    }
  }
}
