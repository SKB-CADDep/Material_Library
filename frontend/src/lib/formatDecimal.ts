export function formatDecimal(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  const rounded = value.toFixed(fractionDigits);
  if (value !== 0 && Number(rounded) === 0) {
    return value.toExponential(2);
  }
  return rounded;
}


export function parseDecimalInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Черновик числового поля: пусто, «-», «2.», «2,5». Буквы не допускаются. */
export function isDecimalDraft(raw: string): boolean {
  return raw === "" || /^-?\d*(?:[.,]\d*)?$/.test(raw);
}

/**
 * Для controlled-инпутов: не съедает промежуточный ввод («2.», «2,», «-»).
 * - "" → undefined
 * - незавершённое валидное → string
 * - готовое число → number
 * - мусор → null (не обновлять поле)
 */
export function parseDecimalFieldInput(
  raw: string,
): number | string | undefined | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!/^-?\d*(?:[.,]\d*)?$/.test(trimmed)) {
    return null;
  }
  const normalized = trimmed.replace(",", ".");
  if (
    normalized === "-" ||
    normalized === "." ||
    normalized === "-." ||
    normalized.endsWith(".")
  ) {
    return normalized;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
