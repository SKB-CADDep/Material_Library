export type ChemElementValue = {
  min_value?: number | null;
  max_value?: number | null;
  min_value_tolerance?: string | number | null;
  max_value_tolerance?: string | number | null;
  min_value_tolerance_relative?: string | number | null;
  max_value_tolerance_relative?: string | number | null;
};

function asFiniteNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}

function toleranceNumeric(tolerance: string | number | null | undefined): number | null {
  if (tolerance === null || tolerance === undefined || tolerance === "") {
    return null;
  }
  const n = typeof tolerance === "number" ? tolerance : Number(String(tolerance).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function tolerancePrefix(tolerance: string | number | null | undefined): string {
  const n = toleranceNumeric(tolerance);
  // 0.0 = «нет отдельного допуска» для компактного сравнения
  if (n === null || n === 0) {
    return "";
  }
  return `(${tolerance}) `;
}

function toleranceSuffix(tolerance: string | number | null | undefined): string {
  const n = toleranceNumeric(tolerance);
  if (n === null || n === 0) {
    return "";
  }
  return ` (${tolerance})`;
}

export function formatChemElementValue(
  elemData: ChemElementValue | null | undefined,
): string {
  if (!elemData) {
    return "-";
  }

  const minValue = asFiniteNumber(elemData.min_value ?? undefined);
  const maxValue = asFiniteNumber(elemData.max_value ?? undefined);
  const minTolerance = elemData.min_value_tolerance;
  const maxTolerance = elemData.max_value_tolerance;

  const hasMin = minValue !== null;
  const hasMax = maxValue !== null;

  if (!hasMin && !hasMax) {
    return "-";
  }

  if (hasMin && hasMax) {
    return `${tolerancePrefix(minTolerance)}${minValue} - ${maxValue}${toleranceSuffix(maxTolerance)}`;
  }

  if (hasMax) {
    return `≤ ${maxValue}${toleranceSuffix(maxTolerance)}`;
  }

  return `≥ ${minValue}${toleranceSuffix(minTolerance)}`;
}
