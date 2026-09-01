import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from "recharts";
import type { LarsonMillerResponse } from "../types/api";
import { formatChartTooltipLine } from "../pages/chartLabels";
import {
  computeNiceAxisFromValues,
  computeTicksForFixedDomain,
  formatTickLabel,
  type NiceAxisResult,
} from "../utils/chartTicks";

const CHART_MARGIN = { top: 48, right: 28, bottom: 64, left: 36 } as const;
/** Ширина полосы тиков Y. */
const Y_AXIS_WIDTH = 48;
/** Высота полосы тиков X (default Recharts). */
const X_AXIS_HEIGHT = 30;
/** Зазор между цифрами оси и наименованием. */
const AXIS_LABEL_GAP = 18;
/** Расстояние подписи X от линии оси. */
const X_AXIS_TITLE_GAP = X_AXIS_HEIGHT + AXIS_LABEL_GAP;
/** Отступ подписи Y слева от полосы тиков. */
const Y_LABEL_OUTSIDE_GAP = 14;
const CURVE_COLOR = "#1f77b4";
const CALC_COLOR = "#d62728";
const DEFAULT_X_DOMAIN: [number, number] = [14, 18];
const DEFAULT_Y_DOMAIN: [number, number] = [150, 300];
const AXIS_TICK_OPTIONS = { targetTickCount: 6 } as const;

const X_AXIS_LABEL = "P = (T + 273,15)(lg τ + C) / 1000";
const Y_AXIS_LABEL = "Напряжение, МПа";

type ScaleLike = ((value: number | string) => number | undefined) & {
  invert?: (value: number) => number;
};

/**
 * Подписи осей по центру поля (как в Эшби), с зазором от тиков.
 */
function LarsonMillerAxisLabels() {
  const plotArea = usePlotArea();
  if (!plotArea) {
    return null;
  }

  const xTextX = plotArea.x + plotArea.width / 2;
  const xTextY = plotArea.y + plotArea.height + X_AXIS_TITLE_GAP;
  const yTextX = plotArea.x - Y_AXIS_WIDTH - Y_LABEL_OUTSIDE_GAP;
  const yTextY = plotArea.y + plotArea.height / 2;

  return (
    <g className="larson-miller-axis-labels" pointerEvents="none">
      <text
        x={xTextX}
        y={xTextY}
        textAnchor="middle"
        dominantBaseline="text-after-edge"
        className="ashby-axis-label"
        fill="#6b7280"
        fontSize={14}
      >
        {X_AXIS_LABEL}
      </text>
      <text
        x={yTextX}
        y={yTextY}
        textAnchor="middle"
        dominantBaseline="middle"
        className="ashby-axis-label"
        fill="#6b7280"
        fontSize={14}
        transform={`rotate(-90, ${yTextX}, ${yTextY})`}
      >
        {Y_AXIS_LABEL}
      </text>
    </g>
  );
}

/**
 * Пунктирные мини-секции посередине между основными тиками
 * (как в Эшби и «Сравнение материалов (свойства)»).
 */
function LarsonMillerMinorGridlines({
  xTicks,
  yTicks,
}: {
  xTicks: number[];
  yTicks: number[];
}) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale() as ScaleLike | undefined;
  const yScale = useYAxisScale() as ScaleLike | undefined;

  if (!plotArea || !xScale || !yScale) {
    return null;
  }

  const xMids: number[] = [];
  for (let i = 0; i < xTicks.length - 1; i += 1) {
    xMids.push((xTicks[i] + xTicks[i + 1]) / 2);
  }
  const yMids: number[] = [];
  for (let i = 0; i < yTicks.length - 1; i += 1) {
    yMids.push((yTicks[i] + yTicks[i + 1]) / 2);
  }

  const { x, y, width, height } = plotArea;

  return (
    <g className="larson-miller-minor-grid" pointerEvents="none">
      {xMids.map((value) => {
        const px = xScale(value);
        if (typeof px !== "number" || !Number.isFinite(px)) {
          return null;
        }
        if (px < x || px > x + width) {
          return null;
        }
        return (
          <line
            key={`lm-x-mid-${value}`}
            x1={px}
            y1={y}
            x2={px}
            y2={y + height}
            stroke="grey"
            strokeWidth={0.5}
            strokeOpacity={0.7}
            strokeDasharray="4 3"
          />
        );
      })}
      {yMids.map((value) => {
        const py = yScale(value);
        if (typeof py !== "number" || !Number.isFinite(py)) {
          return null;
        }
        if (py < y || py > y + height) {
          return null;
        }
        return (
          <line
            key={`lm-y-mid-${value}`}
            x1={x}
            y1={py}
            x2={x + width}
            y2={py}
            stroke="grey"
            strokeWidth={0.5}
            strokeOpacity={0.7}
            strokeDasharray="4 3"
          />
        );
      })}
    </g>
  );
}

function LarsonMillerPointTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    color?: string;
    fill?: string;
    name?: string | number;
    payload?: { p?: number; stress?: number };
  }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const entry = payload[0];
  const point = entry?.payload;
  if (!point || point.p == null || point.stress == null) {
    return null;
  }

  const accent =
    entry.color ||
    entry.fill ||
    (String(entry.name) === "Расчетные данные" ? CALC_COLOR : CURVE_COLOR);

  return (
    <div
      className="ashby-point-tooltip larson-miller-point-tooltip"
      style={{
        margin: 0,
        padding: 10,
        backgroundColor: "#fff",
        border: "1px solid #ccc",
        borderRadius: 4,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 2px 8px rgba(36, 41, 48, 0.18)",
        fontSize: 13,
        lineHeight: 1.35,
        color: accent,
        boxSizing: "border-box",
      }}
    >
      <div>{formatChartTooltipLine("σдп", point.stress, "МПа")}</div>
      <div>{formatChartTooltipLine("P", point.p, "")}</div>
    </div>
  );
}

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

const LEGEND_OVERLAY_BG = "rgba(255, 255, 255, 0.5)";

const LEGEND_ITEM_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px auto",
  alignItems: "center",
  listStyle: "none",
  width: "max-content",
  maxWidth: "100%",
  margin: "0 0 6px",
  padding: 0,
  fontSize: 13,
  lineHeight: 1.4,
  color: "#242930",
  boxSizing: "border-box",
};

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
    () => {
      // Recharts 3: margin.left и YAxis.width складываются.
      const x = CHART_MARGIN.left + Y_AXIS_WIDTH;
      return {
        x,
        y: CHART_MARGIN.top,
        width: Math.max(1, chartSize.width - x - CHART_MARGIN.right),
        height: Math.max(
          1,
          chartSize.height - CHART_MARGIN.top - CHART_MARGIN.bottom,
        ),
      };
    },
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
          <LarsonMillerAxisLabels />
          {/* Основные секции — сплошная сетка по тикам (как в Эшби / сравнении свойств). */}
          <CartesianGrid stroke="#c5cad3" strokeWidth={1} />
          {/* Мини-секции — пунктир посередине между тиками. */}
          <LarsonMillerMinorGridlines
            xTicks={xAxis.ticks}
            yTicks={yAxis.ticks}
          />
          <XAxis
            type="number"
            dataKey="p"
            domain={xAxis.domain}
            ticks={xAxis.ticks}
            height={X_AXIS_HEIGHT}
            tick={{ fontSize: 13, fill: "#242930" }}
            tickFormatter={(value) => formatTickLabel(value)}
          />
          <YAxis
            type="number"
            dataKey="stress"
            width={Y_AXIS_WIDTH}
            domain={yAxis.domain}
            ticks={yAxis.ticks}
            tick={{ fontSize: 13, fill: "#242930" }}
            tickFormatter={(value) => formatTickLabel(value)}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => (
              <LarsonMillerPointTooltip active={active} payload={payload} />
            )}
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
        className="ashby-legend-overlay larson-miller-legend-panel"
        aria-label="Элементы на графике"
        style={{
          left: `${legendPlacement.left}px`,
          top: `${legendPlacement.top}px`,
          width: "max-content",
          maxWidth: "calc(100% - 24px)",
          display: "flex",
          flexDirection: "column",
          padding: "10px 10px 8px",
          border: "1px solid #d8dce3",
          borderRadius: 6,
          backgroundColor: LEGEND_OVERLAY_BG,
          boxShadow: "0 2px 10px rgba(36, 41, 48, 0.12)",
          boxSizing: "border-box",
          overflow: "hidden",
          zIndex: 3,
          pointerEvents: "none",
        }}
      >
        <div
          className="ashby-legend-overlay-title"
          style={{
            margin: 0,
            padding: "0 2px 6px",
            fontSize: 14,
            fontWeight: 500,
            color: "#242930",
            whiteSpace: "nowrap",
            flex: "0 0 auto",
          }}
        >
          Элементы на графике
        </div>
        <ul
          className="ashby-legend-overlay-list"
          aria-label="Элементы на графике"
          style={{
            margin: 0,
            padding: "4px 4px 8px",
            listStyle: "none",
            overflow: "visible",
            flex: "0 1 auto",
            minHeight: 0,
            width: "max-content",
            maxWidth: "100%",
          }}
        >
          {LEGEND_ITEMS.map((item, index) => (
            <li
              key={item.id}
              className="ashby-legend-item"
              style={{
                ...LEGEND_ITEM_STYLE,
                marginBottom: index === LEGEND_ITEMS.length - 1 ? 0 : 6,
              }}
            >
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
              <span
                className="ashby-legend-label"
                style={{
                  paddingLeft: "0.25cm",
                  boxSizing: "border-box",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
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
