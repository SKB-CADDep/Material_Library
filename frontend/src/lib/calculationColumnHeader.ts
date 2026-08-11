import type { SingleCalculationColumn, UnitResponse } from "../types/api";
import { unitDisplayText } from "./columnUnits";

/** unit_type из units_registry.json для колонки температуры. */
export const TEMPERATURE_UNIT_TYPE = "Температура";

export type ColumnHeaderMeta = {
  key: string;
  label: string;
  display_symbol?: string;
  unit: string;
  unit_type?: string | null;
  temperature_dependent?: boolean
}

export function splitCalculationColumnHeader(col: Pick<ColumnHeaderMeta, "label" | "unit">): {
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

export function calculationColumnSymbol(
  col: ColumnHeaderMeta,
): string {
  const fromApi = col.display_symbol?.trim();
  if (fromApi) {
    return fromApi;
  }
  return splitCalculationColumnHeader(col).symbol;
}

export function calculationColumnUnitLabel(
  displayUnit: string,
  unitConfig?: UnitResponse,
): string {
  return unitDisplayText(displayUnit, unitConfig?.display_labels);
}

export function calculationColumnMenuLabel(
  col: SingleCalculationColumn,
  displayUnit: string,
  unitConfig?: UnitResponse,
): string {
  const symbol = calculationColumnSymbol(col);
  const unit = calculationColumnUnitLabel(displayUnit, unitConfig);
  return unit ? `${symbol}, ${unit}` : symbol;
}
