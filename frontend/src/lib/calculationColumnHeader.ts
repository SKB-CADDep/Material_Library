import type { SingleCalculationColumn } from "../types/api";

export function splitCalculationColumnHeader(col: SingleCalculationColumn): {
  symbol: string;
  unit: string;
} {
  const unit = col.unit?.trim() ?? "";
  if (unit && col.label.endsWith(`, ${unit}`)) {
    return {
      symbol: col.label.slice(0, -(unit.length + 2)),
      unit,
    };
  }

  const commaIndex = col.label.lastIndexOf(", ");
  if (commaIndex > 0) {
    return {
      symbol: col.label.slice(0, commaIndex),
      unit: col.label.slice(commaIndex + 2),
    };
  }

  return { symbol: col.label, unit };
}

export function calculationColumnMenuLabel(
  col: SingleCalculationColumn,
): string {
  const { symbol, unit } = splitCalculationColumnHeader(col);
  return unit ? `${symbol}, ${unit}` : symbol;
}
