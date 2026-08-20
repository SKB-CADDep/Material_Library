import type { SingleCalculationRow } from "../types/api";
import { sortRowsByValue, type SortDirection } from "./sortSelectionRows";

export type CalculationSortColumn = "temperature" | string;

export type CalculationSortState = {
  column: CalculationSortColumn;
  direction: SortDirection;
} | null;

export function getCalculationRowSortValue(
  row: SingleCalculationRow,
  column: CalculationSortColumn,
): unknown {
  if (column === "temperature") {
    return row.temperature;
  }
  return row.values[column]?.value ?? null;
}

export function sortCalculationRows(
  rows: SingleCalculationRow[],
  column: CalculationSortColumn,
  direction: SortDirection,
): SingleCalculationRow[] {
  return sortRowsByValue(
    rows,
    (row) => getCalculationRowSortValue(row, column),
    direction,
  );
}
