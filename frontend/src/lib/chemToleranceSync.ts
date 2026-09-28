import { parseDecimalInput } from "./formatDecimal";
import { coerceChemNumber } from "./chemElementNormalize";

/** Компактная запись числа допуска для инпута / JSON. */
export function formatChemTolNumber(n: number): string {
  if (!Number.isFinite(n)) {
    return "0.0";
  }
  if (n === 0) {
    return "0.0";
  }
  const rounded = Number(n.toPrecision(12));
  if (rounded === 0) {
    return "0.0";
  }
  return String(rounded);
}

export type ChemToleranceFields = {
  min_value: number | string;
  max_value: number | string;
  min_value_tolerance: number | string;
  max_value_tolerance: number | string;
  min_value_tolerance_relative: number | string;
  max_value_tolerance_relative: number | string;
};

export function hasChemAbsTolerance(el: ChemToleranceFields): boolean {
  return (
    coerceChemNumber(el.min_value_tolerance) !== 0 ||
    coerceChemNumber(el.max_value_tolerance) !== 0
  );
}

export function hasChemRelTolerance(el: ChemToleranceFields): boolean {
  return (
    coerceChemNumber(el.min_value_tolerance_relative) !== 0 ||
    coerceChemNumber(el.max_value_tolerance_relative) !== 0
  );
}

/**
 * ABS из REL (п.39):
 * ABS min = min − REL min
 * ABS max = max + REL max
 * REL = 0.0 → ABS = 0.0 (нет допуска, не подставляем min/max).
 */
export function syncAbsFromRel<T extends ChemToleranceFields>(el: T): T {
  const min = coerceChemNumber(el.min_value);
  const max = coerceChemNumber(el.max_value);
  const relMin = coerceChemNumber(el.min_value_tolerance_relative);
  const relMax = coerceChemNumber(el.max_value_tolerance_relative);
  return {
    ...el,
    min_value_tolerance: formatChemTolNumber(relMin === 0 ? 0 : min - relMin),
    max_value_tolerance: formatChemTolNumber(relMax === 0 ? 0 : max + relMax),
  };
}

/**
 * REL из ABS (п.39):
 * REL min = min − ABS min
 * REL max = ABS max − max
 * ABS = 0.0 → REL = 0.0 (нет допуска, не получаем min − 0 = min).
 */
export function syncRelFromAbs<T extends ChemToleranceFields>(el: T): T {
  const min = coerceChemNumber(el.min_value);
  const max = coerceChemNumber(el.max_value);
  const absMin = coerceChemNumber(el.min_value_tolerance);
  const absMax = coerceChemNumber(el.max_value_tolerance);
  return {
    ...el,
    min_value_tolerance_relative: formatChemTolNumber(
      absMin === 0 ? 0 : min - absMin,
    ),
    max_value_tolerance_relative: formatChemTolNumber(
      absMax === 0 ? 0 : absMax - max,
    ),
  };
}

/**

 */
export function fillMissingChemTolerances<T extends ChemToleranceFields>(
  el: T,
): T {
  const hasAbs = hasChemAbsTolerance(el);
  const hasRel = hasChemRelTolerance(el);
  if (hasAbs && !hasRel) {
    return syncRelFromAbs(el);
  }
  if (hasRel && !hasAbs) {
    return syncAbsFromRel(el);
  }
  return el;
}

export type ChemToleranceSyncSource = "abs" | "rel" | "bounds" | "other";

/** Какая сторона допуска — источник при патче полей. */
export function chemToleranceSyncSource(
  patch: Partial<ChemToleranceFields>,
): ChemToleranceSyncSource {
  if (
    "min_value_tolerance_relative" in patch ||
    "max_value_tolerance_relative" in patch
  ) {
    return "rel";
  }
  if ("min_value_tolerance" in patch || "max_value_tolerance" in patch) {
    return "abs";
  }
  if ("min_value" in patch || "max_value" in patch) {
    return "bounds";
  }
  return "other";
}

/**
 * После правки REL → ABS; после ABS → REL.
 * После min/max: если есть REL — пересчёт ABS; иначе если есть ABS — пересчёт REL
 * (типичный случай старых строк только с ABS).
 */
export function applyChemToleranceSync<T extends ChemToleranceFields>(
  el: T,
  source: ChemToleranceSyncSource,
): T {
  if (source === "rel") {
    return syncAbsFromRel(el);
  }
  if (source === "abs") {
    return syncRelFromAbs(el);
  }
  if (source === "bounds") {
    if (hasChemRelTolerance(el)) {
      return syncAbsFromRel(el);
    }
    if (hasChemAbsTolerance(el)) {
      return syncRelFromAbs(el);
    }
    return el;
  }
  return el;
}

/** Можно ли синхронизировать пару прямо сейчас (нет «0.» / пустого / мусора). */
export function isChemInputReadyToSync(raw: string): boolean {
  const trimmed = raw.trim().replace(",", ".");
  // Пустое оставляем при вводе — 0.0 ставим только на blur (commit).
  if (trimmed === "") {
    return false;
  }
  if (
    trimmed === "." ||
    trimmed === "-" ||
    trimmed === "-." ||
    /[.,]$/.test(trimmed)
  ) {
    return false;
  }
  return parseDecimalInput(trimmed) !== null;
}

export function isChemPatchReadyToSync(
  patch: Partial<ChemToleranceFields>,
): boolean {
  for (const value of Object.values(patch)) {
    if (typeof value === "string" && !isChemInputReadyToSync(value)) {
      return false;
    }
  }
  return true;
}
