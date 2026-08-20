import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LarsonMillerResponse } from "../types/api";
import {
  computeNiceAxisFromValues,
  computeTicksForFixedDomain,
  formatTickLabel,
  type NiceAxisResult,
} from "../utils/chartTicks";

const CHART_MARGIN = { top: 48, right: 28, bottom: 56, left: 64 } as const;
const CURVE_COLOR = "#1f77b4";
const CALC_COLOR = "#d62728";
const DEFAULT_X_DOMAIN: [number, number] = [14, 18];
const DEFAULT_Y_DOMAIN: [number, number] = [150, 300];
const AXIS_TICK_OPTIONS = { targetTickCount: 6 } as const;
const LEGEND_PADDING = 12;
const LEGEND_COLLISION_PAD = 10;
const LEGEND_ITEMS = [
  {
    id: "curve",
    label: "Кривая длительной прочности",
    kind: "line" as const,
    color: CURVE_COLOR,
  },
  {
    id: "calc",
    label: "Расчетная точка",
    kind: "point" as const,
    color: CALC_COLOR,
  },
] as const;

type LarsonMillerChartProps = {
  data: LarsonMillerResponse | null;
};

type PlotPoint = { x: number; y: number };
type LegendRect = { left: number; top: number; width: number; height: number };
type LegendGeometry = {
  points: PlotPoint[];
  segments: Array<[PlotPoint, PlotPoint]>;
};
type LegendPlacement = { left: number; top: number };

function resolveAxis(
  values: number[],
  fallbackDomain: [number, number],
): NiceAxisResult {
  const fromValues = computeNiceAxisFromValues(values, AXIS_TICK_OPTIONS);
  if (fromValues) {
    return fromValues;
  }
  return computeTicksForFixedDomain(
    fallbackDomain[0],
    fallbackDomain[1],
    AXIS_TICK_OPTIONS,
  );
}

function legendRectContainsPoint(rect: LegendRect, point: PlotPoint): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

function orientation(a: PlotPoint, b: PlotPoint, c: PlotPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: PlotPoint, b: PlotPoint, c: PlotPoint): boolean {
  return (
    Math.min(a.x, b.x) <= c.x &&
    c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y &&
    c.y <= Math.max(a.y, b.y)
  );
}

function segmentsIntersect(a: PlotPoint, b: PlotPoint, c: PlotPoint, d: PlotPoint): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function segmentIntersectsLegendRect(
  a: PlotPoint,
  b: PlotPoint,
  rect: LegendRect,
): boolean {
  if (legendRectContainsPoint(rect, a) || legendRectContainsPoint(rect, b)) {
    return true;
  }
  const left = rect.left;
  const right = rect.left + rect.width;
  const top = rect.top;
  const bottom = rect.top + rect.height;
  const corners: PlotPoint[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  const edges: Array<[PlotPoint, PlotPoint]> = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  return edges.some(([c, d]) => segmentsIntersect(a, b, c, d));
}

function samplePolylinePoints(
  points: PlotPoint[],
  stepPx = 16,
): LegendGeometry {
  const sampled: PlotPoint[] = [];
  const segments: Array<[PlotPoint, PlotPoint]> = [];
  if (points.length === 0) {
    return { points: sampled, segments };
  }
  sampled.push(points[0]);
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    segments.push([prev, next]);
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const dist = Math.hypot(dx, dy);
    if (dist > stepPx) {
      const count = Math.min(24, Math.ceil(dist / stepPx));
      for (let step = 1; step < count; step += 1) {
        const t = step / count;
        sampled.push({ x: prev.x + dx * t, y: prev.y + dy * t });
      }
    }
    sampled.push(next);
  }
  return { points: sampled, segments };
}

function clampLegendRectToPlotArea(
  rect: LegendRect,
  plotArea: { x: number; y: number; width: number; height: number },
  pad: number,
): LegendRect {
  const minLeft = plotArea.x + pad;
  const maxLeft = Math.max(minLeft, plotArea.x + plotArea.width - rect.width - pad);
  const minTop = plotArea.y + pad;
  const maxTop = Math.max(minTop, plotArea.y + plotArea.height - rect.height - pad);
  return {
    ...rect,
    left: Math.max(minLeft, Math.min(rect.left, maxLeft)),
    top: Math.max(minTop, Math.min(rect.top, maxTop)),
  };
}

function countLegendOverlapBadness(rect: LegendRect, geometry: LegendGeometry): number {
  const padded: LegendRect = {
    left: rect.left - LEGEND_COLLISION_PAD,
    top: rect.top - LEGEND_COLLISION_PAD,
    width: rect.width + LEGEND_COLLISION_PAD * 2,
    height: rect.height + LEGEND_COLLISION_PAD * 2,
  };
  let badness = 0;
  for (const point of geometry.points) {
    if (legendRectContainsPoint(padded, point)) {
      badness += 1;
    }
  }
  for (const [a, b] of geometry.segments) {
    if (segmentIntersectsLegendRect(a, b, padded)) {
      badness += 8;
    }
  }
  return badness;
}

function buildLegendCandidateGrid(
  plotArea: { x: number; y: number; width: number; height: number },
  legendSize: { width: number; height: number },
  pad: number,
): LegendPlacement[] {
  const minLeft = plotArea.x + pad;
  const maxLeft = plotArea.x + plotArea.width - legendSize.width - pad;
  const minTop = plotArea.y + pad;
  if (!Number.isFinite(minLeft) || !Number.isFinite(maxLeft) || maxLeft < minLeft) {
    return [{ left: minLeft, top: minTop }];
  }
  return [{ left: maxLeft, top: minTop }];
}

function findBestLegendPlacement(
  plotArea: { x: number; y: number; width: number; height: number },
  legendSize: { width: number; height: number },
  geometry: LegendGeometry,
): LegendPlacement {
  const fallback = {
    left: plotArea.x + plotArea.width - legendSize.width - LEGEND_PADDING,
    top: plotArea.y + LEGEND_PADDING,
  };
  if (plotArea.width <= 0 || plotArea.height <= 0 || legendSize.width <= 0) {
    return fallback;
  }

  const candidates = buildLegendCandidateGrid(plotArea, legendSize, LEGEND_PADDING);
  let bestPlacement = fallback;
  let bestBadness = Infinity;
  let bestTie = Infinity;

  for (const candidate of candidates) {
    const rect = clampLegendRectToPlotArea(
      {
        left: candidate.left,
        top: candidate.top,
        width: legendSize.width,
        height: legendSize.height,
      },
      plotArea,
      LEGEND_PADDING,
    );
    const badness = countLegendOverlapBadness(rect, geometry);
    const tie = Math.hypot(rect.left - fallback.left, rect.top - fallback.top);
    if (badness < bestBadness || (badness === bestBadness && tie < bestTie)) {
      bestBadness = badness;
      bestTie = tie;
      bestPlacement = { left: rect.left, top: rect.top };
      if (badness === 0 && tie < 1) {
        break;
      }
    }
  }

  return bestPlacement;
}

export function LarsonMillerChart({ data }: LarsonMillerChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [legendSize, setLegendSize] = useState({ width: 0, height: 0 });

  const curvePoints = useMemo(
    () =>
      (data?.chart_curve ?? []).map((point) => ({
        p: point.p,
        stress: point.stress,
      })),
    [data?.chart_curve],
  );

  const calcPoint = useMemo(() => {
    const point = data?.chart_calc_point;
    if (!point || point.stress == null) return [];
    return [{ p: point.p, stress: point.stress }];
  }, [data?.chart_calc_point]);

  const xValues = useMemo(
    () => [
      ...curvePoints.map((point) => point.p),
      ...calcPoint.map((point) => point.p),
    ],
    [curvePoints, calcPoint],
  );

  const yValues = useMemo(
    () => [
      ...curvePoints.map((point) => point.stress),
      ...calcPoint.map((point) => point.stress),
    ],
    [curvePoints, calcPoint],
  );

  const xAxis = useMemo(
    () => resolveAxis(xValues, DEFAULT_X_DOMAIN),
    [xValues],
  );
  const yAxis = useMemo(
    () => resolveAxis(yValues, DEFAULT_Y_DOMAIN),
    [yValues],
  );
  const plotArea = useMemo(
    () => ({
      x: CHART_MARGIN.left,
      y: CHART_MARGIN.top,
      width: Math.max(1, chartSize.width - CHART_MARGIN.left - CHART_MARGIN.right),
      height: Math.max(1, chartSize.height - CHART_MARGIN.top - CHART_MARGIN.bottom),
    }),
    [chartSize.height, chartSize.width],
  );
  const legendGeometry = useMemo((): LegendGeometry => {
    const [xMin, xMax] = xAxis.domain;
    const [yMin, yMax] = yAxis.domain;
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;
    const toPx = (p: number, stress: number): PlotPoint => ({
      x: plotArea.x + ((p - xMin) / xSpan) * plotArea.width,
      y: plotArea.y + (1 - (stress - yMin) / ySpan) * plotArea.height,
    });

    const curvePixelPoints = curvePoints.map((point) => toPx(point.p, point.stress));
    const curveGeometry = samplePolylinePoints(curvePixelPoints);
    const calcPixelPoints = calcPoint.map((point) => toPx(point.p, point.stress));
    return {
      points: [...curveGeometry.points, ...calcPixelPoints],
      segments: curveGeometry.segments,
    };
  }, [calcPoint, curvePoints, plotArea.height, plotArea.width, plotArea.x, plotArea.y, xAxis.domain, yAxis.domain]);
  const legendPlacement = useMemo(
    () => findBestLegendPlacement(plotArea, legendSize, legendGeometry),
    [legendGeometry, legendSize, plotArea],
  );

  const hasSeries = curvePoints.length > 0 || calcPoint.length > 0;

  useEffect(() => {
    const wrapEl = wrapRef.current;
    const legendEl = legendRef.current;
    if (!wrapEl || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateWrapSize = () => {
      setChartSize({
        width: wrapEl.clientWidth,
        height: wrapEl.clientHeight,
      });
    };
    updateWrapSize();
    const wrapObserver = new ResizeObserver(updateWrapSize);
    wrapObserver.observe(wrapEl);

    let legendObserver: ResizeObserver | null = null;
    if (legendEl) {
      const updateLegendSize = () => {
        setLegendSize({
          width: legendEl.offsetWidth,
          height: legendEl.offsetHeight,
        });
      };
      updateLegendSize();
      legendObserver = new ResizeObserver(updateLegendSize);
      legendObserver.observe(legendEl);
    }

    return () => {
      wrapObserver.disconnect();
      legendObserver?.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="larson-miller-chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d8dee6" />
          <XAxis
            type="number"
            dataKey="p"
            domain={xAxis.domain}
            ticks={xAxis.ticks}
            tickFormatter={(value) => formatTickLabel(value)}
            label={{
              value: "P = (T + 273,15)(lg τ + C) / 1000",
              position: "insideBottom",
              offset: -8,
            }}
          />
          <YAxis
            type="number"
            dataKey="stress"
            domain={yAxis.domain}
            ticks={yAxis.ticks}
            tickFormatter={(value) => formatTickLabel(value)}
            label={{
              value: "Напряжение, МПа",
              angle: -90,
              position: "insideLeft",
              offset: 12,
            }}
          />
          <Tooltip
            formatter={(value, name) => [
              Number(value ?? 0).toFixed(2),
              name === "stress" ? "σдп, МПа" : "P",
            ]}
            labelFormatter={() => ""}
          />
          {curvePoints.length > 0 && (
            <Scatter
              name="Кривая длит.прочности"
              data={curvePoints}
              fill={CURVE_COLOR}
              line
            />
          )}
          {calcPoint.length > 0 && (
            <Scatter
              name="Расчетные данные"
              data={calcPoint}
              fill={CALC_COLOR}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
      <div
        ref={legendRef}
        className="ashby-legend-panel larson-miller-legend-panel"
        style={{
          left: `${legendPlacement.left}px`,
          top: `${legendPlacement.top}px`,
        }}
      >
        <ul className="ashby-legend">
          {LEGEND_ITEMS.map((item) => (
            <li key={item.id} className="ashby-legend-item">
              {item.kind === "line" ? (
                <svg
                  className="ashby-legend-marker larson-miller-legend-marker"
                  viewBox="0 0 28 12"
                  aria-hidden="true"
                >
                  <line
                    x1="1"
                    y1="6"
                    x2="27"
                    y2="6"
                    stroke={item.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="14" cy="6" r="3.5" fill={item.color} />
                </svg>
              ) : (
                <svg
                  className="ashby-legend-marker larson-miller-legend-marker"
                  viewBox="0 0 28 12"
                  aria-hidden="true"
                >
                  <circle cx="14" cy="6" r="4" fill={item.color} />
                </svg>
              )}
              <span className="ashby-legend-label">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
      {!hasSeries && (
        <p className="larson-miller-chart-hint">
          Укажите константу C в «Общих данных» материала и заполните табличные
          данные для построения кривой
        </p>
      )}
    </div>
  );
}
