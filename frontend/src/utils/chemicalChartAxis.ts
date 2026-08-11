const DEFAULT_LOG_DOMAIN: [number, number] = [0.001, 100];


const CHEM_LOG_AXIS_FLOOR = 0.01;

function decadeFloor(value: number): number {
  return 10 ** Math.floor(Math.log10(Math.max(value, 1e-12)));
}

function decadeCeil(value: number): number {
  return 10 ** Math.ceil(Math.log10(Math.max(value, 1e-12)));
}

export function formatChemicalBarLabel(value: number): string {
  if (value > 0.0001) {
    if (value < 0.1) {
      return value.toFixed(4).replace(/\.?0+$/, "");
    }
    return value.toFixed(2);
  }
  return "";
}

export function computeChemicalLogDomain(values: number[]): [number, number] {
  const positive = values.filter((v) => v > 0);
  const maxVal = values.length ? Math.max(...values) : 100;
  const minVal = positive.length ? Math.min(...positive) : 0.001;

  const rawLo = minVal * 0.5;
  const rawHi = maxVal * 5;

  const lo = Math.min(decadeFloor(rawLo), CHEM_LOG_AXIS_FLOOR);
  const hi = decadeCeil(rawHi);

  return [lo, hi];
}

export type LogAxisTicks = {
  majorTicks: number[];
  minorTicks: number[];
};

function normalizeLogDomain(domain: [number, number]): [number, number] {
  let [lo, hi] = domain;

  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi <= 0) {
    return DEFAULT_LOG_DOMAIN;
  }

  if (lo > hi) {
    [lo, hi] = [hi, lo];
  }

  if (lo === hi) {
    return [lo * 0.1, hi * 10];
  }

  return [lo, hi];
}


export function buildLogAxisTicks(domain: [number, number]): LogAxisTicks {
  const [lo, hi] = normalizeLogDomain(domain);
  const startExp = Math.floor(Math.log10(lo));
  const endExp = Math.ceil(Math.log10(hi));

  const majorTicks: number[] = [];
  const minorTicks: number[] = [];

  for (let exp = startExp; exp <= endExp; exp += 1) {
    const base = 10 ** exp;

    if (base >= lo * 0.999 && base <= hi * 1.001) {
      majorTicks.push(base);
    }

    for (let multiplier = 2; multiplier <= 9; multiplier += 1) {
      const tick = multiplier * base;
      if (tick >= lo && tick <= hi) {
        minorTicks.push(tick);
      }
    }
  }

  return { majorTicks, minorTicks };
}

export function formatLogAxisTickLabel(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (value === 0) {
    return "0";
  }

  const abs = Math.abs(value);
  if (abs >= 1_000_000 || (abs < 0.001 && abs > 0)) {
    return value.toExponential(0).replace(/e\+/, "e");
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(Number(value.toPrecision(10)));
}

const SUPERSCRIPT_CHARS: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

export function formatChemicalLogAxisExponentSuperscript(exponent: number): string {
  return String(exponent)
    .split("")
    .map((char) => SUPERSCRIPT_CHARS[char] ?? char)
    .join("");
}

export function isChemicalLogPowerOfTen(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) {
    return false;
  }
  const exponent = Math.log10(value);
  return Math.abs(exponent - Math.round(exponent)) <= 1e-6;
}

export function chemicalLogAxisExponent(value: number): number | null {
  if (!isChemicalLogPowerOfTen(value)) {
    return null;
  }
  return Math.round(Math.log10(value));
}

/** @deprecated Prefer ChemicalLogAxisTick — plain string fallback. */
export function formatChemicalLogAxisTickLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  const exponent = chemicalLogAxisExponent(value);
  if (exponent === null) {
    return formatLogAxisTickLabel(value);
  }

  return `10${formatChemicalLogAxisExponentSuperscript(exponent)}`;
}
