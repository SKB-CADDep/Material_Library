import type { ChemElementValueEntry } from "./chemComparisonPivot";

export function safeFloat(
  value: unknown,
  defaultValue: number | null = null,
): number | null {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  try {
    const parsed = Number.parseFloat(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
}

export type ToleranceType = "absolute" | "relative";

export function chemicalEffectiveBounds(
  elemInfo: ChemElementValueEntry,
  toleranceType: ToleranceType = "absolute",
): [number, number, number | null, number | null] {
  const minV = safeFloat(elemInfo.min_value);
  const maxV = safeFloat(elemInfo.max_value);

  if (toleranceType === "relative") {
    const minRel = safeFloat(elemInfo.min_value_tolerance_relative);
    const maxRel = safeFloat(elemInfo.max_value_tolerance_relative);

    let lower: number;
    if (minV !== null && minRel !== null) {
      lower = minV * (1 - minRel / 100);
    } else if (minV !== null) {
      lower = minV;
    } else {
      lower = Number.NEGATIVE_INFINITY;
    }

    let upper: number;
    if (maxV !== null && maxRel !== null) {
      upper = maxV * (1 + maxRel / 100);
    } else if (maxV !== null) {
      upper = maxV;
    } else {
      upper = Number.POSITIVE_INFINITY;
    }

    return [lower, upper, minRel, maxRel];
  }

  const minTol = safeFloat(elemInfo.min_value_tolerance);
  const maxTol = safeFloat(elemInfo.max_value_tolerance);

  let lower: number;
  if (minV !== null && minTol !== null) {
    lower = minTol;
  } else if (minV !== null) {
    lower = minV;
  } else if (minTol !== null) {
    lower = minTol;
  } else {
    lower = Number.NEGATIVE_INFINITY;
  }

  let upper: number;
  if (maxV !== null && maxTol !== null) {
    upper = maxTol;
  } else if (maxV !== null) {
    upper = maxV;
  } else if (maxTol !== null) {
    upper = maxTol;
  } else {
    upper = Number.POSITIVE_INFINITY;
  }

  return [lower, upper, minTol, maxTol];
}
