import { parseDecimalInput } from "./formatDecimal";

/** Пустое / null / NaN / отсутствует → 0; иначе введённое число. */
export function coerceChemNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = parseDecimalInput(String(value));
  return parsed === null ? 0 : parsed;
}

/**
 * Нормализация допуска после ввода (blur) / из JSON:
 * пустое или 0 → "0.0", иначе сохраняем введённую запись.
 */
export function coerceChemToleranceInput(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim().replace(",", ".");
    if (trimmed === "") {
      return "0.0";
    }
    const parsed = parseDecimalInput(trimmed);
    if (parsed === null || parsed === 0) {
      return "0.0";
    }
    return trimmed;
  }
  const n = coerceChemNumber(value);
  return n === 0 ? "0.0" : String(n);
}

/**
 * Отображение в инпуте: null/пустое/числовой 0 → "0.0",
 * строку при редактировании не трогаем.
 */
export function chemToleranceDisplay(value: unknown): string {
  if (value === null || value === undefined) {
    return "0.0";
  }
  if (typeof value === "number") {
    return value === 0 ? "0.0" : String(value);
  }
  const text = String(value);
  return text.trim() === "" ? "0.0" : text;
}
