import { EMPTY_CELL, isEmptyCellMarker } from "./emptyCell";

export function formatCellValue(value: number | string | null | undefined): string {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && isEmptyCellMarker(value))
    ) {
      return EMPTY_CELL;
    }
    if (typeof value === "number") {
      return Number.isInteger(value) ? String(value) : value.toPrecision(4);
    }
    return String(value);
  }