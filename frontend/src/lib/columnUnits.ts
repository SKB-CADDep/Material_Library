import type { UnitResponse } from "../types/api";

export type ColumnWithUnit = {
  key: string;
  unit: string;
  unit_type?: string | null;
};

export function resolveDefaultColumnUnit(
  col: ColumnWithUnit,
  unitConfig?: UnitResponse,
): string {
  const baseUnit = col.unit?.trim() ?? "";
  if (!col.unit_type || !unitConfig) {
    return baseUnit;
  }

  if (baseUnit && unitConfig.units.includes(baseUnit)) {
    return baseUnit;
  }

  return unitConfig.system_unit;
}

export function mergeColumnUnits(
  columns: ColumnWithUnit[],
  prev: Record<string, string>,
  unitConfigs: Record<string, UnitResponse | undefined>,
): Record<string, string> {
  const next = { ...prev };
  let changed = false;

  for (const col of columns) {
    const config = col.unit_type ? unitConfigs[col.unit_type] : undefined;

    if (!(col.key in next)) {
      next[col.key] = resolveDefaultColumnUnit(col, config);
      changed = true;
      continue;
    }

    if (config && !config.units.includes(next[col.key])) {
      next[col.key] = resolveDefaultColumnUnit(col, config);
      changed = true;
    }
  }

  return changed ? next : prev;
}

export function unitDisplayText(
  unit: string,
  displayLabels?: Record<string, string>,
): string {
  if (!unit) {
    return "";
  }

  return displayLabels?.[unit]?.trim() || unit;
}
