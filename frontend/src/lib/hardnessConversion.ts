import hardnessTable from "../config/hardness_table.json";

type HardnessTableJson = {
  columns: string[];
  rows: Array<Array<number | null>>;
};

const TABLE = hardnessTable as HardnessTableJson;
const COLUMN_INDEX = Object.fromEntries(
  TABLE.columns.map((name, index) => [name, index]),
) as Record<string, number>;

function linearInterpolate(
  pairs: Array<[number, number]>,
  targetX: number,
): number | null {
  if (pairs.length === 0) {
    return null;
  }

  const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
  if (targetX < sorted[0][0] || targetX > sorted[sorted.length - 1][0]) {
    return null;
  }

  for (const [x, y] of sorted) {
    if (x === targetX) {
      return y;
    }
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const [x1, y1] = sorted[i];
    const [x2, y2] = sorted[i + 1];
    if (x1 < targetX && targetX < x2) {
      if (x2 === x1) {
        return y1;
      }
      return y1 + ((targetX - x1) * (y2 - y1)) / (x2 - x1);
    }
  }

  return null;
}

/** Пересчёт твёрдости по таблице (как backend HardnessTable). */
export function convertHardness(
  value: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (fromUnit === toUnit) {
    return value;
  }

  const srcIdx = COLUMN_INDEX[fromUnit];
  const tgtIdx = COLUMN_INDEX[toUnit];
  if (srcIdx === undefined || tgtIdx === undefined) {
    return null;
  }

  const points: Array<[number, number]> = [];
  for (const row of TABLE.rows) {
    const x = row[srcIdx];
    const y = row[tgtIdx];
    if (typeof x === "number" && typeof y === "number") {
      points.push([x, y]);
    }
  }

  return linearInterpolate(points, value);
}

export function isHardnessTableUnit(unit: string): boolean {
  return unit in COLUMN_INDEX;
}

export function usesHardnessTableConversion(
  factors: Record<string, number | string> | undefined,
): boolean {
  if (!factors) {
    return false;
  }
  return Object.values(factors).some((factor) => factor === "table");
}
