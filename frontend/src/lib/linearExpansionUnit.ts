export const LINEAR_EXPANSION_SYSTEM_UNIT = "10^-6/C";

const LEGACY_PER_C = new Set(["1/С", "1/C"]);
const SCALED_ALIASES = new Set(["10e-6/C", "10e-6/С"]);

export function resolveLinearExpansionUnit(
  unit: string | undefined,
  values: Array<number | null | undefined>,
): string {
  const key = (unit ?? "").trim();
  if (!key || SCALED_ALIASES.has(key)) {
    return LINEAR_EXPANSION_SYSTEM_UNIT;
  }
  if (LEGACY_PER_C.has(key)) {
    const maxAbs = values.reduce<number>((max, value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return max;
      }
      return Math.max(max, Math.abs(value));
    }, 0);
    if (maxAbs >= 0.01) {
      return LINEAR_EXPANSION_SYSTEM_UNIT;
    }
  }
  return key;
}
