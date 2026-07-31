import type { CalculationCell
 } from "../types/api";


export function formatCalculationCell(cell:CalculationCell | undefined,): string{
        if (!cell || cell.value === null) {
            return "—"
        }

        const base = cell.value.toFixed(1)
        if (cell.mode === "interp") {
            return `(${base})`
        }
        if (cell.mode === "approx"){
            return `[${base}]`
        }
        return base
}
