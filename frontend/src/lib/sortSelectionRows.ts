import type { TemperatureSelectionRow } from "../types/api";

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
  if (raw === null || raw === undefined) {
    return [2, null];
  }

  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return [0, raw];
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "—") {
      return [2, null];
    }

    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      return [0, asNumber];
    }

    return [1, trimmed.toLowerCase()];
  }

  return [1, String(raw).toLowerCase()];
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

export function getSelectionRowSortValue(
  row: TemperatureSelectionRow,
  column: SelectionSortColumn,
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
    default:
      return row.values[column] ?? null;
  }
}

export function sortSelectionRows(
  rows: TemperatureSelectionRow[],
  column: SelectionSortColumn,
  direction: SortDirection,
): TemperatureSelectionRow[] {
  return sortRowsByValue(
    rows,
    (row) => getSelectionRowSortValue(row, column),
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
