import type { TemperatureSelectionColumn, TemperatureSelectionRow, UnitResponse } from "../types/api";
import { isEmptyCellMarker } from "./emptyCell";
import {
  selectionCellComparableValue,
  unwrapSelectionCellValue,
} from "./formatSelectionCellValue";

export type SelectionSortColumn =
  | "material_name"
  | "strength_category"
  | "source"
  | "max_temp"
  | string;

export type SortDirection = "asc" | "desc";

export type SelectionSortState = {
  column: SelectionSortColumn;
  direction: SortDirection;
} | null;

type SortKey = [group: number, value: string | number | null];

function buildSortKey(raw: unknown): SortKey {
  const unwrapped = unwrapSelectionCellValue(
    raw as Parameters<typeof unwrapSelectionCellValue>[0],
  );
  if (unwrapped === null || unwrapped === undefined) {
    return [2, null];
  }

  if (typeof unwrapped === "number" && !Number.isNaN(unwrapped)) {
    return [0, unwrapped];
  }

  if (typeof unwrapped === "string") {
    const trimmed = unwrapped.trim();
    if (isEmptyCellMarker(trimmed)) {
      return [2, null];
    }

    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      return [0, asNumber];
    }

    return [1, trimmed.toLowerCase()];
  }

  return [1, String(unwrapped).toLowerCase()];
}

function compareSortKeys(a: SortKey, b: SortKey): number {
  if (a[0] !== b[0]) {
    return a[0] - b[0];
  }

  if (a[1] === null && b[1] === null) {
    return 0;
  }
  if (a[1] === null) {
    return 1;
  }
  if (b[1] === null) {
    return -1;
  }

  if (a[1] < b[1]) {
    return -1;
  }
  if (a[1] > b[1]) {
    return 1;
  }
  return 0;
}

export type SelectionSortUnits = {
  columns: Array<Pick<TemperatureSelectionColumn, "key" | "unit" | "unit_type">>;
  columnUnits?: Record<string, string>;
  unitConfigs?: Record<string, UnitResponse>;
};

export function getSelectionRowSortValue(
  row: TemperatureSelectionRow,
  column: SelectionSortColumn,
  units?: SelectionSortUnits,
): unknown {
  switch (column) {
    case "material_name":
      return row.material_name;
    case "strength_category":
      return row.strength_category;
    case "source":
      return row.source;
    case "max_temp":
      return row.max_temp;
    default: {
      const raw = row.values[column] ?? null;
      const col = units?.columns.find((item) => item.key === column);
      if (!col) {
        return raw;
      }
      const unitConfig = col.unit_type
        ? units?.unitConfigs?.[col.unit_type]
        : undefined;
      return selectionCellComparableValue(raw, {
        columnKey: col.key,
        baseUnit: col.unit ?? "",
        displayUnit: units?.columnUnits?.[col.key] ?? col.unit ?? "",
        unitConfig,
        rowSourceUnit: unwrapSelectionCellValue(row.values.unit_value),
      });
    }
  }
}

export function sortSelectionRows(
  rows: TemperatureSelectionRow[],
  column: SelectionSortColumn,
  direction: SortDirection,
  units?: SelectionSortUnits,
): TemperatureSelectionRow[] {
  return sortRowsByValue(
    rows,
    (row) => getSelectionRowSortValue(row, column, units),
    direction,
  );
}

export function sortRowsByValue<T>(
  rows: T[],
  getValue: (row: T) => unknown,
  direction: SortDirection,
): T[] {
  if (rows.length <= 1) {
    return rows;
  }

  const sign = direction === "asc" ? 1 : -1;

  return [...rows].sort((rowA, rowB) => {
    const keyA = buildSortKey(getValue(rowA));
    const keyB = buildSortKey(getValue(rowB));
    return sign * compareSortKeys(keyA, keyB);
  });
}

export function toggleSortDirection(
  current: SortDirection | undefined,
): SortDirection {
  return current === "asc" ? "desc" : "asc";
}
