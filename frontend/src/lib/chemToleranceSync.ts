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

/** Допуски и производные ABS/REL не бывают отрицательными. */
export function nonNegativeTol(n: number): number {
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return n;
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
 * REL не может «выходить» за min (иначе ABS < 0) — обрезаем.
 */
export function syncAbsFromRel<T extends ChemToleranceFields>(el: T): T {
  const min = coerceChemNumber(el.min_value);
  const max = coerceChemNumber(el.max_value);
  let relMin = nonNegativeTol(
    coerceChemNumber(el.min_value_tolerance_relative),
  );
  let relMax = nonNegativeTol(
    coerceChemNumber(el.max_value_tolerance_relative),
  );

  // ABS min ≥ 0 ⇒ REL min ≤ max(min, 0)
  const maxRelMin = Math.max(min, 0);
  if (relMin > maxRelMin) {
    relMin = maxRelMin;
  }

  const absMin = relMin === 0 ? 0 : nonNegativeTol(min - relMin);
  const absMax = relMax === 0 ? 0 : nonNegativeTol(max + relMax);

  return {
    ...el,
    min_value_tolerance: formatChemTolNumber(absMin),
    max_value_tolerance: formatChemTolNumber(absMax),
    min_value_tolerance_relative: formatChemTolNumber(relMin),
    max_value_tolerance_relative: formatChemTolNumber(relMax),
  };
}

/**
 * REL из ABS (п.39):
 * REL min = min − ABS min
 * REL max = ABS max − max
 * ABS = 0.0 → REL = 0.0 (нет допуска, не получаем min − 0 = min).
 * ABS min не выше min и не ниже 0 — иначе REL отрицательный.
 */
export function syncRelFromAbs<T extends ChemToleranceFields>(el: T): T {
  const min = coerceChemNumber(el.min_value);
  const max = coerceChemNumber(el.max_value);
  let absMin = nonNegativeTol(coerceChemNumber(el.min_value_tolerance));
  let absMax = nonNegativeTol(coerceChemNumber(el.max_value_tolerance));

  // ABS min ≤ min (и ≥ 0), иначе REL min < 0
  if (absMin !== 0 && absMin > min) {
    absMin = nonNegativeTol(min);
  }
  // ABS max ≥ max, иначе REL max < 0; 0 = «нет допуска»
  if (absMax !== 0 && absMax < max) {
    absMax = nonNegativeTol(max);
  }

  const relMin = absMin === 0 ? 0 : nonNegativeTol(min - absMin);
  const relMax = absMax === 0 ? 0 : nonNegativeTol(absMax - max);

  return {
    ...el,
    min_value_tolerance: formatChemTolNumber(absMin),
    max_value_tolerance: formatChemTolNumber(absMax),
    min_value_tolerance_relative: formatChemTolNumber(relMin),
    max_value_tolerance_relative: formatChemTolNumber(relMax),
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

const TOLERANCE_FIELD_KEYS = [
  "min_value_tolerance",
  "max_value_tolerance",
  "min_value_tolerance_relative",
  "max_value_tolerance_relative",
] as const;

/**
 * Не даём отрицательным допускам остаться в форме/JSON.
 * Незавершённый ввод («-», «-.») не трогаем.
 */
export function clampNegativeChemTolerances<T extends ChemToleranceFields>(
  el: T,
): T {
  const next = { ...el };
  for (const key of TOLERANCE_FIELD_KEYS) {
    const raw = next[key];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (
        trimmed === "" ||
        trimmed === "-" ||
        trimmed === "-." ||
        !isChemInputReadyToSync(raw)
      ) {
        continue;
      }
    }
    const n = coerceChemNumber(raw);
    if (n < 0) {
      (next as ChemToleranceFields)[key] = formatChemTolNumber(0);
    }
  }
  return next;
}

/** Убрать отрицательные из patch до merge (готовые числа → 0.0). */
export function sanitizeChemTolerancePatch<
  T extends Partial<ChemToleranceFields>,
>(patch: T): T {
  const next = { ...patch };
  for (const key of TOLERANCE_FIELD_KEYS) {
    if (!(key in next)) continue;
    const raw = next[key];
    if (typeof raw !== "string") {
      if (typeof raw === "number" && raw < 0) {
        (next as ChemToleranceFields)[key] = 0 as never;
      }
      continue;
    }
    if (!isChemInputReadyToSync(raw)) continue;
    if (coerceChemNumber(raw) < 0) {
      (next as ChemToleranceFields)[key] = formatChemTolNumber(0);
    }
  }
  return next;
}

/**
 * Текст предупреждения, если ввод/синхронизация дали бы отрицательный допуск.
 * Возвращает null, если всё в допустимых пределах.
 * Логика веток совпадает с applyChemToleranceSync.
 */
export function chemToleranceNegativeWarning(
  el: ChemToleranceFields,
  source: ChemToleranceSyncSource,
): string | null {
  for (const key of TOLERANCE_FIELD_KEYS) {
    const raw = el[key];
    if (typeof raw === "string" && !isChemInputReadyToSync(raw)) {
      continue;
    }
    if (coerceChemNumber(raw) < 0) {
      return "Допуск не может быть отрицательным — значение скорректировано до 0.";
    }
  }

  const min = coerceChemNumber(el.min_value);
  const max = coerceChemNumber(el.max_value);
  const absMin = coerceChemNumber(el.min_value_tolerance);
  const absMax = coerceChemNumber(el.max_value_tolerance);
  const relMin = coerceChemNumber(el.min_value_tolerance_relative);

  let syncSide: "abs" | "rel" | null = null;
  if (source === "abs") {
    syncSide = "abs";
  } else if (source === "rel") {
    syncSide = "rel";
  } else if (source === "bounds") {
    if (hasChemRelTolerance(el)) {
      syncSide = "rel";
    } else if (hasChemAbsTolerance(el)) {
      syncSide = "abs";
    }
  }

  if (syncSide === "abs") {
    if (absMin !== 0 && absMin > min) {
      return `ABS Min (${formatChemTolNumber(absMin)}) выше Min (${formatChemTolNumber(min)}) — относительный допуск был бы отрицательным. Значение скорректировано.`;
    }
    if (absMax !== 0 && absMax < max) {
      return `ABS Max (${formatChemTolNumber(absMax)}) ниже Max (${formatChemTolNumber(max)}) — относительный допуск был бы отрицательным. Значение скорректировано.`;
    }
  }

  if (syncSide === "rel") {
    const maxRelMin = Math.max(min, 0);
    if (relMin > maxRelMin) {
      return `REL Min (${formatChemTolNumber(relMin)}) слишком большой при Min = ${formatChemTolNumber(min)} — абсолютный допуск был бы отрицательным. Значение скорректировано.`;
    }
  }

  return null;
}
