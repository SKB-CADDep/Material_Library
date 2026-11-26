import type { SingleCalculationColumn, SingleCalculationRow, UnitResponse } from "../types/api";
import { calculationCellInDisplayUnit } from "./formatCalculationCell";
import { sortRowsByValue, type SortDirection } from "./sortSelectionRows";

export type CalculationSortColumn = "temperature" | string;

export type CalculationSortState = {
  column: CalculationSortColumn;
  direction: SortDirection;
} | null;

export type CalculationSortUnits = {
  columns: Array<Pick<SingleCalculationColumn, "key" | "unit" | "unit_type">>;
  columnUnits?: Record<string, string>;
  unitConfigs?: Record<string, UnitResponse>;
};

export function getCalculationRowSortValue(
  row: SingleCalculationRow,
  column: CalculationSortColumn,
  units?: CalculationSortUnits,
): unknown {
  if (column === "temperature") {
    return row.temperature;
  }
  const cell = row.values[column];
  const col = units?.columns.find((item) => item.key === column);
  if (!col) {
    return cell?.value ?? null;
  }
  const unitConfig = col.unit_type
    ? units?.unitConfigs?.[col.unit_type]
    : undefined;
  const displayCell = calculationCellInDisplayUnit(cell, {
    baseUnit: col.unit ?? "",
    displayUnit: units?.columnUnits?.[col.key] ?? col.unit ?? "",
    unitConfig,
  });
  return displayCell?.value ?? null;
}

export function sortCalculationRows(
  rows: SingleCalculationRow[],
  column: CalculationSortColumn,
  direction: SortDirection,
  units?: CalculationSortUnits,
): SingleCalculationRow[] {
  return sortRowsByValue(
    rows,
    (row) => getCalculationRowSortValue(row, column, units),
    direction,
  );
}
