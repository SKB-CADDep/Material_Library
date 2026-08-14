import type { CalculationCell
 } from "../types/api";


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

  const base = numeric.toFixed(1);
        if (cell.mode === "interp") {
            return `(${base})`
        }
        if (cell.mode === "approx"){
            return `[${base}]`
        }
        return base
}
