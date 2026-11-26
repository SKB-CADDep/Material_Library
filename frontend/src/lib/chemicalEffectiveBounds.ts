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

/**
 * Эффективные границы для подбора.
 * ABS: нижняя/верхняя граница = значения ABS-допуска (если заданы и ≠ 0), иначе min/max.
 * REL: дельта в тех же единицах (п.39): lower = min − REL min, upper = max + REL max.
 */
export function chemicalEffectiveBounds(
  elemInfo: ChemElementValueEntry,
  toleranceType: ToleranceType = "absolute",
): [number, number, number | null, number | null] {
  const minV = safeFloat(elemInfo.min_value);
  const maxV = safeFloat(elemInfo.max_value);

  if (toleranceType === "relative") {
    const minRel = safeFloat(elemInfo.min_value_tolerance_relative);
    const maxRel = safeFloat(elemInfo.max_value_tolerance_relative);
    const hasMinRel = minRel !== null && minRel !== 0;
    const hasMaxRel = maxRel !== null && maxRel !== 0;

    let lower: number;
    if (minV !== null && hasMinRel) {
      lower = minV - minRel;
    } else if (minV !== null) {
      lower = minV;
    } else {
      lower = Number.NEGATIVE_INFINITY;
    }

    let upper: number;
    if (maxV !== null && hasMaxRel) {
      upper = maxV + maxRel;
    } else if (maxV !== null) {
      upper = maxV;
    } else {
      upper = Number.POSITIVE_INFINITY;
    }

    return [lower, upper, minRel, maxRel];
  }

  const minTol = safeFloat(elemInfo.min_value_tolerance);
  const maxTol = safeFloat(elemInfo.max_value_tolerance);
  // 0.0 хранится явно, но не подменяет номинальные min/max
  const hasMinTol = minTol !== null && minTol !== 0;
  const hasMaxTol = maxTol !== null && maxTol !== 0;

  let lower: number;
  if (minV !== null && hasMinTol) {
    lower = minTol;
  } else if (minV !== null) {
    lower = minV;
  } else if (hasMinTol) {
    lower = minTol as number;
  } else {
    lower = Number.NEGATIVE_INFINITY;
  }

  let upper: number;
  if (maxV !== null && hasMaxTol) {
    upper = maxTol;
  } else if (maxV !== null) {
    upper = maxV;
  } else if (hasMaxTol) {
    upper = maxTol as number;
  } else {
    upper = Number.POSITIVE_INFINITY;
  }

  return [lower, upper, minTol, maxTol];
}
