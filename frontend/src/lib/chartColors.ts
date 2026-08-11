import type { AshbyResponse } from "../types/api";

const GOLDEN_RATIO_CONJUGATE = 0.618033988749895;

function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 1) + 1) % 1;
  const i = Math.floor(hue * 6);
  const f = hue * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r: number;
  let g: number;
  let b: number;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    default:
      r = v;
      g = p;
      b = q;
      break;
  }

  const byte = (channel: number) =>
    Math.round(Math.max(0, Math.min(255, channel * 255)))
      .toString(16)
      .padStart(2, "0");

  return `#${byte(r)}${byte(g)}${byte(b)}`;
}


export function chartSeriesColor(index: number): string {
  const h = (index * GOLDEN_RATIO_CONJUGATE) % 1;
  return hsvToHex(h, 0.9, 0.9);
}

export function chartClassColor(index: number): string {
  const h = (index * GOLDEN_RATIO_CONJUGATE) % 1;
  return hsvToHex(h, 0.65, 0.88);
}

export function applyAshbyChartColors(data: AshbyResponse): AshbyResponse {
  const classColorByName = new Map<string, string>();
  for (const [index, item] of (data.class_legend ?? []).entries()) {
    classColorByName.set(item.class_name, chartClassColor(index));
  }

  const series = data.series.map((entry, index) => ({
    ...entry,
    color: chartSeriesColor(index),
  }));

  const hulls = data.hulls.map((hull) => ({
    ...hull,
    color: classColorByName.get(hull.class_name) ?? chartClassColor(0),
  }));

  const class_legend = (data.class_legend ?? []).map((item, index) => ({
    ...item,
    color: chartClassColor(index),
  }));

  return { ...data, series, hulls, class_legend };
}
