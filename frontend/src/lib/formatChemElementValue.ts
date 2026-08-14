export type ChemElementValue = {
  min_value?: number | null;
  max_value?: number | null;
  min_value_tolerance?: string | number | null;
  max_value_tolerance?: string | number | null;
  min_value_tolerance_relative?: string | number | null;
  max_value_tolerance_relative?: string | number | null;
};

function normalizeBound(value: number | null | undefined): number | null | undefined {
  if (value === 0) {
    return null;
  }
  return value;
}

function tolerancePrefix(tolerance: string | number | null | undefined): string {
  if (tolerance === null || tolerance === undefined || tolerance === "") {
    return "";
  }
  return `(${tolerance}) `;
}

function toleranceSuffix(tolerance: string | number | null | undefined): string {
  if (tolerance === null || tolerance === undefined || tolerance === "") {
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

  let minValue = normalizeBound(elemData.min_value ?? undefined);
  let maxValue = normalizeBound(elemData.max_value ?? undefined);
  const minTolerance = elemData.min_value_tolerance;
  const maxTolerance = elemData.max_value_tolerance;

  if (minValue != null && maxValue != null) {
    return `${tolerancePrefix(minTolerance)}${minValue} - ${maxValue}${toleranceSuffix(maxTolerance)}`;
  }

  if (maxValue != null) {
    return `≤ ${maxValue}${toleranceSuffix(maxTolerance)}`;
  }

  if (minValue != null) {
    return `≥ ${minValue}${toleranceSuffix(minTolerance)}`;
  }

  return "-";
}
