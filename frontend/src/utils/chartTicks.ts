const NICE_MULTIPLIERS = [1, 2, 2.5, 5, 10] as const;

const DEFAULT_TARGET_TICK_COUNT = 9;
const MAX_TICK_COUNT = 12;

export type NiceAxisOptions = {
  targetTickCount?: number;
  paddingRatio?: number;
};

export type NiceAxisResult = {
  domain: [number, number];
  ticks: number[];
  step: number;
};

function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) {
    return value;
  }
  const inv = 1 / step;
  return Math.round(value * inv) / inv;
}

function expandDegenerateRange(min: number, max: number): [number, number] {
  if (min !== max) {
    return [min, max];
  }

  if (min === 0) {
    return [0, 1];
  }

  const delta = Math.abs(min) * 0.1 || 1;
  return [min - delta, max + delta];
}

function buildAxisForStep(
  dataMin: number,
  dataMax: number,
  step: number,
): NiceAxisResult {
  const axisMin = roundToStep(Math.floor(dataMin / step) * step, step);
  const axisMax = roundToStep(Math.ceil(dataMax / step) * step, step);

  const ticks: number[] = [];
  const tickCount = Math.round((axisMax - axisMin) / step);

  for (let i = 0; i <= tickCount; i += 1) {
    ticks.push(roundToStep(axisMin + i * step, step));
  }

  if (ticks.length < 2) {
    ticks.push(roundToStep(axisMin + step, step));
  }

  const lastTick = ticks[ticks.length - 1] ?? axisMax;

  return {
    domain: [axisMin, lastTick],
    ticks,
    step,
  };
}

function generateStepCandidates(): number[] {
  const seen = new Set<number>();

  for (let exp = -12; exp <= 12; exp += 1) {
    const base = 10 ** exp;
    for (const multiplier of NICE_MULTIPLIERS) {
      const step = multiplier * base;
      if (step > 0 && Number.isFinite(step)) {
        seen.add(step);
      }
    }
  }

  return Array.from(seen).sort((a, b) => a - b);
}

const STEP_CANDIDATES = generateStepCandidates();


function selectBestStep(
  dataMin: number,
  dataMax: number,
  targetTickCount: number,
): number {
  const range = dataMax - dataMin;
  if (range <= 0) {
    return 1;
  }

  const idealStep = range / Math.max(targetTickCount - 1, 1);

  let bestStep = STEP_CANDIDATES.find((step) => step >= idealStep * 0.999)
    ?? STEP_CANDIDATES[STEP_CANDIDATES.length - 1];
  let bestScore = Infinity;

  for (const step of STEP_CANDIDATES) {
    if (step < idealStep * 0.01) {
      continue;
    }

    const axis = buildAxisForStep(dataMin, dataMax, step);
    const tickCount = axis.ticks.length;

    if (tickCount < 2 || tickCount > MAX_TICK_COUNT) {
      continue;
    }

    const span = axis.domain[1] - axis.domain[0];
    const spanRatio = span / range;

    let score = Math.abs(tickCount - targetTickCount);


    if (spanRatio > 1.35) {
      score += (spanRatio - 1.35) * 4;
    }

    if (step < idealStep * 0.85) {
      score += 1.5;
    }

    score += step / idealStep * 0.05;

    if (score < bestScore) {
      bestScore = score;
      bestStep = step;
    }
  }

  return bestStep;
}

export function computeNiceAxis(
  min: number,
  max: number,
  options: NiceAxisOptions = {},
): NiceAxisResult {
  const targetTickCount = Math.max(
    2,
    options.targetTickCount ?? DEFAULT_TARGET_TICK_COUNT,
  );

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return computeNiceAxis(0, 1, options);
  }

  let lo = min;
  let hi = max;
  if (lo > hi) {
    [lo, hi] = [hi, lo];
  }

  [lo, hi] = expandDegenerateRange(lo, hi);

  const paddingRatio = options.paddingRatio ?? 0;
  if (paddingRatio > 0) {
    const span = hi - lo;
    const padHigh = span * paddingRatio;
    const padLow = span * Math.min(paddingRatio, 0.05);
    lo -= padLow;
    hi += padHigh;
  }

  const step = selectBestStep(lo, hi, targetTickCount);
  return buildAxisForStep(lo, hi, step);
}

/**
 * Тики для фиксированного view-диапазона (zoom/pan).
 * Domain не расширяется до «красивых» границ — иначе зум колесом дёргается.
 */
export function computeTicksForFixedDomain(
  min: number,
  max: number,
  options: NiceAxisOptions = {},
): NiceAxisResult {
  const targetTickCount = Math.max(
    2,
    options.targetTickCount ?? DEFAULT_TARGET_TICK_COUNT,
  );

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return computeTicksForFixedDomain(0, 1, options);
  }

  let lo = min;
  let hi = max;
  if (lo > hi) {
    [lo, hi] = [hi, lo];
  }

  [lo, hi] = expandDegenerateRange(lo, hi);

  const step = selectBestStep(lo, hi, targetTickCount);
  const first = roundToStep(Math.ceil(lo / step - 1e-12) * step, step);
  const last = roundToStep(Math.floor(hi / step + 1e-12) * step, step);

  const ticks: number[] = [];
  if (first <= last) {
    const count = Math.round((last - first) / step);
    for (let i = 0; i <= count; i += 1) {
      const tick = roundToStep(first + i * step, step);
      if (tick >= lo - step * 1e-9 && tick <= hi + step * 1e-9) {
        ticks.push(tick);
      }
    }
  }

  if (ticks.length === 0) {
    ticks.push(lo, hi);
  } else if (ticks.length === 1) {
    ticks.push(ticks[0] === lo ? hi : lo);
    ticks.sort((a, b) => a - b);
  }

  return {
    domain: [lo, hi],
    ticks,
    step,
  };
}


export function axisBoundsFromValues(values: number[]): { min: number; max: number } | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }

  return {
    min: Math.min(...finite),
    max: Math.max(...finite),
  };
}

export function computeNiceAxisFromValues(
  values: number[],
  options?: NiceAxisOptions,
): NiceAxisResult | null {
  const bounds = axisBoundsFromValues(values);
  if (!bounds) {
    return null;
  }
  return computeNiceAxis(bounds.min, bounds.max, options);
}

export function formatTickLabel(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (value === 0) {
    return "0";
  }

  const abs = Math.abs(value);
  if (abs >= 1_000_000 || (abs < 0.0001 && abs > 0)) {
    return value
      .toExponential(2)
      .replace(/e\+/, "e")
      .replace(/e(-?\d+)$/, (_, exp: string) => {
        const n = Number(exp);
        return n >= 0 ? `e+${n}` : `e${n}`;
      });
  }

  return String(Number(value.toPrecision(10)));
}
