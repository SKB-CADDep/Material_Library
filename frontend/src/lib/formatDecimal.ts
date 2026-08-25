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
