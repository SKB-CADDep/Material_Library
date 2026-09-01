import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparePropsResponse, ComparePropsSeries } from "../types/api";
import {
  computeNiceAxisFromValues,
  computeTicksForFixedDomain,
  formatTickLabel,
  type NiceAxisResult,
} from "../utils/chartTicks";
import {
  exportChartWithLegendPng,
  exportChartWithLegendSvg,
  type ChartSaveFormat,
} from "../lib/chartLegendExport";
import {
  formatScientificPlain,
  ScientificText,
} from "../lib/scientificNotation";
import { propertyUnitForDisplay } from "../lib/columnUnits";
import { computePointTooltipPosition } from "../lib/chartTooltipPosition";
import { useKeepAlivePaneActive } from "../context/KeepAlivePaneContext";

/** Как у подписи оси X (`label.offset`) — зазор от текста до цифр. */
const AXIS_LABEL_GAP = 18;
/** Горизонтальная толщина вертикальной подписи оси Y. */
const Y_LABEL_WIDTH = 18;
/** Минимальная ширина полосы тиков Y. */
const Y_AXIS_WIDTH_MIN = 36;
/** Небольшой запас под padding тиков Recharts (зазор до цифр — в margin.left). */
const Y_AXIS_TICK_PAD = 10;
/** Не сужаем полосу Y, пока оценка не меньше на столько px. */
const Y_AXIS_WIDTH_SHRINK_HYSTERESIS = 16;

const CHART_MARGIN_BASE = {
  top: 48,
  right: 28,
  bottom: 48,
} as const;
const TOOLBAR_ACCENT = "#3D5A80";
const TOOLBAR_ACCENT_HOVER = "#2f4766";
const TOOLBAR_ACCENT_SOFT = "rgba(61, 90, 128, 0.14)";
const LEGEND_PADDING = 12;
const LEGEND_OVERLAY_BG = "rgba(255, 255, 255, 0.5)";
const LEGEND_MAX_CHART_RATIO = 0.72;
const LEGEND_CHROME_PX = 48;
const LEGEND_GRID_COLS = 9;
const LEGEND_GRID_ROWS = 9;
const LEGEND_PLACE_DEBOUNCE_MS = 120;
/** Зазор вокруг плашки при оценке пересечений (линия/маркеры). */
const LEGEND_COLLISION_PAD = 8;
/** Отступ плашки у точки (как у Эшби / Recharts Tooltip offset). */
const TOOLTIP_OFFSET = 10;
/** Отступ текстовых координат курсора от указателя. */
const CURSOR_COORDS_OFFSET = 12;
/**
 * Радиус захвата точки для плашки (px в системе SVG).
 * Крупнее маркера — плашка срабатывает стабильнее.
 */
const POINT_HIT_PX = 20;

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

type LegendPlacement = { top: number; left: number };
type PlotPoint = { x: number; y: number };
type LegendRect = { left: number; top: number; width: number; height: number };
type LegendGeometry = {
  points: PlotPoint[];
  segments: Array<[PlotPoint, PlotPoint]>;
};
type PlotArea = { x: number; y: number; width: number; height: number };

type AxisDomain = {
  x: NiceAxisResult;
  y: NiceAxisResult;
};

type ChartToolMode = "none" | "pan" | "zoom";

type ChartRow = {
  temperature: number;
  [seriesId: string]: number | null | undefined;
};

function zoomDomain(axis: NiceAxisResult, factor: number): NiceAxisResult {
  const [min, max] = axis.domain;
  const mid = (min + max) / 2;
  const half = ((max - min) / 2) * factor;
  return computeTicksForFixedDomain(mid - half, mid + half);
}

function zoomDomainAt(
  axis: NiceAxisResult,
  factor: number,
  pivot: number,
): NiceAxisResult {
  const [min, max] = axis.domain;
  return computeTicksForFixedDomain(
    pivot + (min - pivot) * factor,
    pivot + (max - pivot) * factor,
  );
}

function shiftDomain(axis: NiceAxisResult, delta: number): NiceAxisResult {
  const [min, max] = axis.domain;
  return computeTicksForFixedDomain(min + delta, max + delta);
}

function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  let dy = deltaY;
  if (deltaMode === 1) dy *= 16;
  else if (deltaMode === 2) dy *= 400;
  const clamped = Math.max(-160, Math.min(160, dy));
  return Math.exp(clamped * 0.0016);
}

/** Домен-заглушка, пока нет точек (оси видны всегда). */
function emptyDomain(): AxisDomain {
  const axis = computeNiceAxisFromValues([0, 1]);
  const fallback: NiceAxisResult = {
    domain: [0, 1],
    ticks: [0, 0.5, 1],
    step: 0.5,
  };
  return { x: axis ?? fallback, y: axis ?? fallback };
}

/** Внутренний отступ от границ поля графика (примерно 0.5 см), как у Эшби. */
const EDGE_PADDING_RATIO = 0.07;

function buildBaseDomain(series: ComparePropsSeries[]): AxisDomain | null {
  const temps = series.flatMap((entry) =>
    entry.points.map((point) => point.temperature),
  );
  const values = series.flatMap((entry) =>
    entry.points.map((point) => point.value),
  );
  if (temps.length === 0 || values.length === 0) {
    return null;
  }

  const xMin = Math.min(...temps);
  const xMax = Math.max(...temps);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const xSpan = Math.max(xMax - xMin, Math.abs(xMin) * 0.1 || 1);
  const ySpan = Math.max(yMax - yMin, Math.abs(yMin) * 0.1 || 1);
  const xPad = xSpan * EDGE_PADDING_RATIO;
  const yPad = ySpan * EDGE_PADDING_RATIO;

  const x = computeTicksForFixedDomain(xMin - xPad, xMax + xPad, {
    targetTickCount: 8,
  });
  const y = computeTicksForFixedDomain(yMin - yPad, yMax + yPad, {
    targetTickCount: 8,
  });
  if (!x || !y) {
    return null;
  }
  return { x, y };
}

function buildChartRows(series: ComparePropsSeries[]): ChartRow[] {
  const temps = new Set<number>();
  for (const entry of series) {
    for (const point of entry.points) {
      temps.add(point.temperature);
    }
  }
  const sortedTemps = Array.from(temps).sort((a, b) => a - b);
  return sortedTemps.map((temperature) => {
    const row: ChartRow = { temperature };
    for (const entry of series) {
      const point = entry.points.find((p) => p.temperature === temperature);
      row[entry.id] = point ? point.value : null;
    }
    return row;
  });
}

function formatPointLabel(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  return value === Math.trunc(value) ? String(value) : value.toFixed(1);
}

function estimateYAxisWidth(ticks: number[]): number {
  const labels = ticks.map((tick) => formatTickLabel(tick));
  let maxPx = 0;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = '13px system-ui, -apple-system, "Segoe UI", sans-serif';
      for (const label of labels) {
        maxPx = Math.max(maxPx, ctx.measureText(label).width);
      }
    }
  }
  if (maxPx <= 0) {
    const maxLen = Math.max(1, ...labels.map((label) => label.length), 1);
    maxPx = maxLen * 7.5;
  }
  return Math.max(Y_AXIS_WIDTH_MIN, Math.ceil(maxPx + Y_AXIS_TICK_PAD));
}

/**
 * Recharts 3: margin.left и YAxis.width складываются.
 * left — только подпись + зазор до цифр; width — только полоса тиков.
 */
function buildChartMargin() {
  return {
    ...CHART_MARGIN_BASE,
    left: Y_LABEL_WIDTH + AXIS_LABEL_GAP,
  };
}

function getPlotArea(
  chartWidth: number,
  chartHeight: number,
  marginLeft: number,
  yAxisWidth: number,
): PlotArea {
  const x = marginLeft + yAxisWidth;
  return {
    x,
    y: CHART_MARGIN_BASE.top,
    width: Math.max(1, chartWidth - x - CHART_MARGIN_BASE.right),
    height: Math.max(
      1,
      chartHeight - CHART_MARGIN_BASE.top - CHART_MARGIN_BASE.bottom,
    ),
  };
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

function segmentsIntersect(
  a: PlotPoint,
  b: PlotPoint,
  c: PlotPoint,
  d: PlotPoint,
): boolean {
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
): { points: PlotPoint[]; segments: Array<[PlotPoint, PlotPoint]> } {
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
      for (let s = 1; s < count; s += 1) {
        const t = s / count;
        sampled.push({ x: prev.x + dx * t, y: prev.y + dy * t });
      }
    }
    sampled.push(next);
  }
  return { points: sampled, segments };
}

function countLegendOverlapBadness(
  rect: LegendRect,
  geometry: LegendGeometry,
): number {
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
  plotArea: PlotArea,
  legendSize: { width: number; height: number },
  pad: number,
): LegendPlacement[] {
  const minLeft = plotArea.x + pad;
  const maxLeft = plotArea.x + plotArea.width - legendSize.width - pad;
  const minTop = plotArea.y + pad;
  const maxTop = plotArea.y + plotArea.height - legendSize.height - pad;

  if (!Number.isFinite(minLeft) || !Number.isFinite(maxLeft) || maxLeft < minLeft) {
    return [{ left: minLeft, top: minTop }];
  }
  if (!Number.isFinite(minTop) || !Number.isFinite(maxTop) || maxTop < minTop) {
    return [{ left: minLeft, top: minTop }];
  }

  const candidates: LegendPlacement[] = [];
  const gridCols: number = LEGEND_GRID_COLS;
  const gridRows: number = LEGEND_GRID_ROWS;
  for (let row = 0; row < gridRows; row += 1) {
    for (let col = 0; col < gridCols; col += 1) {
      const left =
        gridCols === 1
          ? minLeft
          : minLeft + ((maxLeft - minLeft) * col) / (gridCols - 1);
      const top =
        gridRows === 1
          ? minTop
          : minTop + ((maxTop - minTop) * row) / (gridRows - 1);
      candidates.push({ left, top });
    }
  }
  return candidates;
}

function findBestLegendPlacement(
  plotArea: PlotArea,
  legendSize: { width: number; height: number },
  geometry: LegendGeometry,
  pad = LEGEND_PADDING,
): LegendPlacement {
  if (plotArea.width <= 0 || plotArea.height <= 0 || legendSize.width <= 0) {
    return { top: plotArea.y + pad, left: plotArea.x + pad };
  }

  const candidates = buildLegendCandidateGrid(plotArea, legendSize, pad);
  const preferLeft = plotArea.x + plotArea.width - legendSize.width - pad;
  const preferTop = plotArea.y + pad;

  let bestPlacement: LegendPlacement = {
    top: preferTop,
    left: preferLeft,
  };
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
      pad,
    );
    const badness = countLegendOverlapBadness(rect, geometry);
    const tie = Math.hypot(rect.left - preferLeft, rect.top - preferTop);
    if (badness < bestBadness || (badness === bestBadness && tie < bestTie)) {
      bestBadness = badness;
      bestTie = tie;
      bestPlacement = { top: rect.top, left: rect.left };
      if (badness === 0 && tie < 1) {
        break;
      }
    }
  }

  return bestPlacement;
}

function clampLegendRectToPlotArea(
  rect: LegendRect,
  plotArea: PlotArea,
  pad: number,
): LegendRect {
  const minLeft = plotArea.x + pad;
  const maxLeft = Math.max(
    minLeft,
    plotArea.x + plotArea.width - rect.width - pad,
  );
  const minTop = plotArea.y + pad;
  const maxTop = Math.max(
    minTop,
    plotArea.y + plotArea.height - rect.height - pad,
  );
  return {
    ...rect,
    left: Math.max(minLeft, Math.min(rect.left, maxLeft)),
    top: Math.max(minTop, Math.min(rect.top, maxTop)),
  };
}

function buildCompareLegendGeometry(
  series: ComparePropsSeries[],
  xScale: ((value: number | string) => number | undefined) | undefined,
  yScale: ((value: number | string) => number | undefined) | undefined,
  plotArea: PlotArea,
  domain: AxisDomain,
): LegendGeometry {
  const [xMin, xMax] = domain.x.domain;
  const [yMin, yMax] = domain.y.domain;
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const toPx = (temperature: number, value: number): PlotPoint | null => {
    if (!Number.isFinite(temperature) || !Number.isFinite(value)) {
      return null;
    }
    if (xScale && yScale) {
      const px = xScale(temperature);
      const py = yScale(value);
      if (px == null || py == null) {
        return null;
      }
      return { x: px, y: py };
    }
    return {
      x: plotArea.x + ((temperature - xMin) / xSpan) * plotArea.width,
      y: plotArea.y + ((yMax - value) / ySpan) * plotArea.height,
    };
  };

  const points: PlotPoint[] = [];
  const segments: Array<[PlotPoint, PlotPoint]> = [];

  for (const entry of series) {
    if (!entry.has_data || entry.points.length === 0) {
      continue;
    }
    const sorted = [...entry.points].sort(
      (a, b) => a.temperature - b.temperature,
    );
    const seriesPx: PlotPoint[] = [];
    for (const point of sorted) {
      const px = toPx(point.temperature, point.value);
      if (px) {
        seriesPx.push(px);
      }
    }
    const sampled = samplePolylinePoints(seriesPx);
    points.push(...sampled.points);
    segments.push(...sampled.segments);
  }

  return { points, segments };
}

type ScaleLike = ((value: number | string) => number | undefined) & {
  invert?: (value: number) => number;
};

type AxisReadoutMeta = {
  symbol?: string;
  key?: string;
  unit?: string;
  label?: string;
};

type ComparePointTip = {
  temperature: number;
  value: number;
  materials: Array<{ label: string; color: string }>;
  chartX: number;
  chartY: number;
};

type CursorScaleBridge = {
  plotArea: PlotArea;
  xScale: ScaleLike | undefined;
  yScale: ScaleLike | undefined;
  domain: AxisDomain;
};

type CursorGeomCache = {
  svg: SVGSVGElement;
  canvasLeft: number;
  canvasTop: number;
};

type PlottedCompareSeries = {
  id: string;
  label: string;
  color: string;
  points: Array<{ temperature: number; value: number }>;
};

/** Строка оси в подсказке: «T = 550 °С» (значение — целое, как на Эшби). */
function formatAxisReadout(
  axis: AxisReadoutMeta | null | undefined,
  value: number,
): string {
  const symbol =
    (axis?.symbol || "").trim() ||
    (axis?.key || "").trim() ||
    (axis?.label || "").trim() ||
    "?";
  const safeSymbol =
    symbol.toLowerCase() === "x" || symbol.toLowerCase() === "y" ? "?" : symbol;
  const valueLabel = Number.isFinite(value) ? String(Math.round(value)) : "";
  const unit = propertyUnitForDisplay((axis?.unit || "").trim());
  const line = unit
    ? `${safeSymbol} = ${valueLabel} ${unit}`
    : `${safeSymbol} = ${valueLabel}`;
  return formatScientificPlain(line);
}

function collectMaterialsAtPoint(
  seriesList: ReadonlyArray<PlottedCompareSeries>,
  temperature: number,
  value: number,
): Array<{ label: string; color: string }> {
  const found: Array<{ label: string; color: string }> = [];
  const seen = new Set<string>();
  for (const series of seriesList) {
    const hit = series.points.some(
      (point) => point.temperature === temperature && point.value === value,
    );
    if (!hit) {
      continue;
    }
    const label = series.label.trim();
    if (!label || seen.has(label)) {
      continue;
    }
    seen.add(label);
    found.push({ label, color: series.color || "#242930" });
  }
  return found;
}

function invertScale(
  scale: ScaleLike | undefined,
  pixel: number,
  fallbackDomain: [number, number],
  plotStart: number,
  plotSize: number,
  inverted = false,
): number {
  if (scale && typeof scale.invert === "function") {
    return scale.invert(pixel);
  }
  const t = plotSize === 0 ? 0 : (pixel - plotStart) / plotSize;
  if (inverted) {
    return fallbackDomain[1] - t * (fallbackDomain[1] - fallbackDomain[0]);
  }
  return fallbackDomain[0] + t * (fallbackDomain[1] - fallbackDomain[0]);
}

function comparePointTipKey(tip: ComparePointTip): string {
  const materialsKey = tip.materials
    .map((item) => `${item.label}:${item.color}`)
    .join(";");
  return [
    materialsKey,
    tip.temperature,
    tip.value,
    Math.round(tip.chartX),
    Math.round(tip.chartY),
  ].join("|");
}

/** Белая плашка у точки (материал + значение / температура). */
function ComparePointTipPlaque({
  tip,
  xAxis,
  yAxis,
  plotArea,
  containerWidth,
  containerHeight,
}: {
  tip: ComparePointTip;
  xAxis: AxisReadoutMeta;
  yAxis: AxisReadoutMeta;
  plotArea: PlotArea;
  containerWidth: number;
  containerHeight: number;
}) {
  const tipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) {
      return;
    }
    const { x, y } = computePointTooltipPosition({
      anchorX: tip.chartX,
      anchorY: tip.chartY,
      tipWidth: el.offsetWidth,
      tipHeight: el.offsetHeight,
      containerWidth,
      containerHeight,
      plotArea: {
        left: plotArea.x,
        top: plotArea.y,
        width: plotArea.width,
        height: plotArea.height,
      },
      offset: TOOLTIP_OFFSET,
    });
    el.style.transform = `translate(${x}px, ${y}px)`;
  }, [tip, plotArea, containerWidth, containerHeight]);

  return (
    <div
      ref={tipRef}
      className="ashby-point-tooltip compare-props-point-tooltip"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transform: `translate(${tip.chartX + TOOLTIP_OFFSET}px, ${
          tip.chartY + TOOLTIP_OFFSET
        }px)`,
        margin: 0,
        padding: 10,
        backgroundColor: "#fff",
        border: "1px solid #ccc",
        borderRadius: 4,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 2px 8px rgba(36, 41, 48, 0.18)",
        zIndex: 30,
        fontSize: 13,
        lineHeight: 1.35,
        color: "#242930",
        boxSizing: "border-box",
      }}
    >
      {tip.materials.length > 0 ? (
        <div style={{ marginBottom: 4 }}>
          {tip.materials.map((material, index) => (
            <div
              key={`${material.label}:${material.color}`}
              style={{
                fontWeight: 500,
                color: material.color,
                marginBottom: index === tip.materials.length - 1 ? 0 : 2,
              }}
            >
              {material.label}
            </div>
          ))}
        </div>
      ) : null}
      <div>
        <ScientificText>{formatAxisReadout(yAxis, tip.value)}</ScientificText>
      </div>
      <div>
        <ScientificText>{formatAxisReadout(xAxis, tip.temperature)}</ScientificText>
      </div>
    </div>
  );
}

/**
 * Координаты у курсора без плашки (Y сверху, X снизу).
 * Обновляется через ref/DOM — без setState на каждый mousemove.
 */
function CompareCursorCoordsLabel({
  labelRef,
  yLineRef,
  xLineRef,
}: {
  labelRef: RefObject<HTMLDivElement | null>;
  yLineRef: RefObject<HTMLDivElement | null>;
  xLineRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={labelRef}
      className="ashby-cursor-coords compare-props-cursor-coords"
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        visibility: "hidden",
        margin: 0,
        padding: 0,
        border: "none",
        background: "transparent",
        boxShadow: "none",
        pointerEvents: "none",
        zIndex: 25,
        fontSize: 12,
        lineHeight: 1.25,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        color: "#242930",
        whiteSpace: "nowrap",
        textShadow:
          "0 0 3px #fff, 0 0 4px #fff, 1px 0 2px #fff, -1px 0 2px #fff, 0 1px 2px #fff, 0 -1px 2px #fff",
        willChange: "transform",
      }}
    >
      <div ref={yLineRef} />
      <div ref={xLineRef} />
    </div>
  );
}

/** Держит актуальные plotArea/scale для перевода экранных координат в данные. */
function CompareCursorScaleReporter({
  domain,
  bridgeRef,
}: {
  domain: AxisDomain;
  bridgeRef: RefObject<CursorScaleBridge | null>;
}) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale() as ScaleLike | undefined;
  const yScale = useYAxisScale() as ScaleLike | undefined;

  if (plotArea && plotArea.width > 0 && plotArea.height > 0) {
    bridgeRef.current = { plotArea, xScale, yScale, domain };
  } else {
    bridgeRef.current = null;
  }

  return null;
}

/**
 * Обрезает линии, точки и подписи значений по полю осей —
 * при pan/zoom цифры не «вылезают» за границы графика.
 */
function ComparePlotClip({
  domain,
  seriesCount,
}: {
  domain: AxisDomain;
  seriesCount: number;
}) {
  const plotArea = usePlotArea();
  const reactId = useId().replace(/:/g, "");
  const clipId = `compare-props-plot-clip-${reactId}`;

  useLayoutEffect(() => {
    if (!plotArea || plotArea.width <= 0 || plotArea.height <= 0) {
      return;
    }

    const applyClip = () => {
      const clipEl = document.getElementById(clipId);
      const svg = clipEl?.closest("svg");
      if (!svg) {
        return;
      }
      const clipUrl = `url(#${clipId})`;
      svg
        .querySelectorAll(
          [
            ".recharts-line",
            ".recharts-line-curve",
            ".recharts-line-dots",
            ".recharts-label-list",
            ".recharts-layer.recharts-line-dots",
            ".recharts-active-dot",
          ].join(", "),
        )
        .forEach((layer: Element) => {
          layer.setAttribute("clip-path", clipUrl);
        });
    };

    applyClip();
    const raf = window.requestAnimationFrame(applyClip);
    return () => window.cancelAnimationFrame(raf);
  }, [
    clipId,
    plotArea?.x,
    plotArea?.y,
    plotArea?.width,
    plotArea?.height,
    domain.x.domain[0],
    domain.x.domain[1],
    domain.y.domain[0],
    domain.y.domain[1],
    seriesCount,
  ]);

  if (!plotArea || plotArea.width <= 0 || plotArea.height <= 0) {
    return null;
  }

  return (
    <defs>
      <clipPath id={clipId}>
        <rect
          x={plotArea.x}
          y={plotArea.y}
          width={plotArea.width}
          height={plotArea.height}
        />
      </clipPath>
    </defs>
  );
}

/** Заголовок по центру поля между осями X и Y. */
function CompareChartTitle({ title }: { title: string }) {
  const plotArea = usePlotArea();
  if (!plotArea || !title) {
    return null;
  }
  const x = plotArea.x + plotArea.width / 2;
  const y = Math.max(16, plotArea.y / 2);
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      className="compare-props-chart-svg-title"
      fill="#242930"
      fontSize={15}
      fontWeight={600}
    >
      {title}
    </text>
  );
}

/**
 * Вертикальная подпись свойства слева от оси Y (SVG — попадает в PNG/SVG при сохранении).
 */
function CompareYAxisLabel({
  label,
  yAxisWidth,
}: {
  label: string;
  yAxisWidth: number;
}) {
  const plotArea = usePlotArea();
  if (!plotArea || !label) {
    return null;
  }
  // Центр колонки подписи: сразу слева от полосы тиков с зазором AXIS_LABEL_GAP.
  const x =
    plotArea.x - yAxisWidth - AXIS_LABEL_GAP - Y_LABEL_WIDTH / 2;
  const y = plotArea.y + plotArea.height / 2;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      className="compare-props-y-axis-svg-label"
      fill="#242930"
      fontSize={14}
      fontWeight={400}
      transform={`rotate(-90, ${x}, ${y})`}
    >
      {formatScientificPlain(label)}
    </text>
  );
}

/**
 * Пунктирные мини-секции посередине между основными тиками
 * (как PropertyComparisonTab._add_minor_gridlines на десктопе).
 */
function CompareMinorGridlines({
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
    <g className="compare-props-minor-grid" pointerEvents="none">
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
            key={`x-mid-${value}`}
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
            key={`y-mid-${value}`}
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

function CompareLegendPlacementReporter({
  series,
  domain,
  legendSize,
  toolMode,
  onPlacementChange,
  onPlotAreaChange,
}: {
  series: ComparePropsSeries[];
  domain: AxisDomain;
  legendSize: { width: number; height: number };
  toolMode: ChartToolMode;
  onPlacementChange: (placement: LegendPlacement) => void;
  onPlotAreaChange: (plotArea: PlotArea) => void;
}) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale() as ScaleLike | undefined;
  const yScale = useYAxisScale() as ScaleLike | undefined;

  useEffect(() => {
    if (!plotArea || plotArea.width <= 0 || plotArea.height <= 0) {
      return;
    }
    onPlotAreaChange({
      x: plotArea.x,
      y: plotArea.y,
      width: plotArea.width,
      height: plotArea.height,
    });
  }, [
    plotArea?.x,
    plotArea?.y,
    plotArea?.width,
    plotArea?.height,
    onPlotAreaChange,
  ]);

  useEffect(() => {
    if (
      !plotArea ||
      plotArea.width <= 0 ||
      plotArea.height <= 0 ||
      legendSize.width <= 0 ||
      legendSize.height <= 0
    ) {
      return;
    }
    const delay =
      toolMode === "none"
        ? LEGEND_PLACE_DEBOUNCE_MS
        : LEGEND_PLACE_DEBOUNCE_MS * 2;
    const timer = window.setTimeout(() => {
      const area: PlotArea = {
        x: plotArea.x,
        y: plotArea.y,
        width: plotArea.width,
        height: plotArea.height,
      };
      const geometry = buildCompareLegendGeometry(
        series,
        xScale,
        yScale,
        area,
        domain,
      );
      onPlacementChange(findBestLegendPlacement(area, legendSize, geometry));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    plotArea?.x,
    plotArea?.y,
    plotArea?.width,
    plotArea?.height,
    xScale,
    yScale,
    series,
    domain.x.domain[0],
    domain.x.domain[1],
    domain.y.domain[0],
    domain.y.domain[1],
    legendSize.width,
    legendSize.height,
    toolMode,
    onPlacementChange,
  ]);

  return null;
}

function LegendSeriesMarker({ color }: { color: string }) {
  const stroke = color || "#3D5A80";
  const w = 28;
  const h = 14;
  return (
    <svg
      className="ashby-legend-marker"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      style={{
        width: w,
        minWidth: w,
        height: h,
        flexShrink: 0,
        display: "block",
      }}
    >
      <line
        x1={1}
        y1={7}
        x2={w - 1}
        y2={7}
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={w / 2} cy={7} r={4} fill={stroke} stroke={stroke} strokeWidth={1} />
    </svg>
  );
}

function ComparePropsLegendOverlay({
  items,
  plotArea,
  placement,
  overlayRef,
  emptyMessage,
}: {
  items: Array<{ id: string; label: string; color: string }>;
  plotArea: PlotArea;
  placement: LegendPlacement | null;
  overlayRef: RefObject<HTMLDivElement | null>;
  emptyMessage?: string;
}) {
  const availableBelow = Math.max(
    120,
    plotArea.height - LEGEND_PADDING * 2,
  );
  const maxBoxHeight = Math.max(
    120,
    Math.min(availableBelow, Math.floor(plotArea.height * LEGEND_MAX_CHART_RATIO)),
  );
  const listMaxHeight = Math.max(72, maxBoxHeight - LEGEND_CHROME_PX);
  const maxBoxWidth = Math.max(120, plotArea.width - LEGEND_PADDING * 2);
  const fallbackTop = plotArea.y + LEGEND_PADDING;
  const fallbackLeft = Math.max(
    plotArea.x + LEGEND_PADDING,
    plotArea.x + plotArea.width - maxBoxWidth - LEGEND_PADDING,
  );

  return (
    <div
      ref={overlayRef}
      className="ashby-legend-overlay"
      aria-label="Элементы на графике"
      onWheel={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      style={{
        position: "absolute",
        ...(placement
          ? { top: placement.top, left: placement.left, right: "auto" }
          : {
              top: fallbackTop,
              left: fallbackLeft,
              right: "auto",
            }),
        width: "max-content",
        maxWidth: maxBoxWidth,
        maxHeight: maxBoxHeight,
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
        pointerEvents: "auto",
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
      {items.length === 0 ? (
        <p
          className="ashby-legend-panel-empty"
          style={{
            margin: 0,
            padding: "4px 2px 6px",
            fontSize: 13,
            color: "#5C6570",
            maxWidth: Math.min(280, maxBoxWidth),
            whiteSpace: "normal",
          }}
        >
          {emptyMessage ??
            "Выберите материалы и нажмите «Построить график»"}
        </p>
      ) : (
        <ul
          className="ashby-legend-overlay-list"
          aria-label="Элементы на графике"
          style={{
            margin: 0,
            padding: "4px 4px 8px",
            listStyle: "none",
            maxHeight: listMaxHeight,
            height: "auto",
            overflowX: "hidden",
            overflowY: "auto",
            flex: "0 1 auto",
            minHeight: 0,
            width: "max-content",
            maxWidth: "100%",
            overscrollBehavior: "contain",
          }}
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              className="ashby-legend-item"
              style={{
                ...LEGEND_ITEM_STYLE,
                marginBottom: index === items.length - 1 ? 0 : 6,
              }}
            >
              <LegendSeriesMarker color={item.color} />
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
      )}
    </div>
  );
}

function ToolbarButton({
  active = false,
  disabled = false,
  title,
  ariaLabel,
  ariaPressed,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  ariaLabel: string;
  ariaPressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  let backgroundColor = "transparent";
  let color = "#242930";
  let borderColor = "transparent";

  if (disabled) {
    color = "#5C6570";
  } else if (hovered) {
    const fill = pressed ? TOOLBAR_ACCENT_HOVER : TOOLBAR_ACCENT;
    backgroundColor = fill;
    color = "#ffffff";
    borderColor = fill;
  } else if (active) {
    backgroundColor = TOOLBAR_ACCENT_SOFT;
    color = TOOLBAR_ACCENT;
    borderColor = "rgba(61, 90, 128, 0.45)";
  }

  return (
    <button
      type="button"
      className={
        active
          ? "ashby-toolbar-btn ashby-toolbar-btn--active"
          : "ashby-toolbar-btn"
      }
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        minWidth: 34,
        flex: "0 0 34px",
        padding: 0,
        margin: 0,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        backgroundColor,
        color,
        cursor: disabled ? "not-allowed" : "pointer",
        boxSizing: "border-box",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SaveMenuItem({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      className={
        hovered
          ? "ashby-save-menu-item ashby-save-menu-item--hover"
          : "ashby-save-menu-item"
      }
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        border: "none",
        borderRadius: 6,
        backgroundColor: hovered ? "rgba(61, 90, 128, 0.12)" : "transparent",
        color: hovered ? TOOLBAR_ACCENT : "#242930",
        fontSize: 13,
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      {label}
    </button>
  );
}

function CompareChartToolbar({
  enabled,
  mode,
  onHome,
  onModeChange,
  onZoomIn,
  onZoomOut,
  onSave,
}: {
  enabled: boolean;
  mode: ChartToolMode;
  onHome: () => void;
  onModeChange: (mode: ChartToolMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSave: (format: ChartSaveFormat) => void;
}) {
  const buttonGap = "0.3cm";
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saveMenuPos, setSaveMenuPos] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const saveButtonWrapRef = useRef<HTMLDivElement>(null);

  function updateSaveMenuPos() {
    const wrap = saveButtonWrapRef.current;
    if (!wrap) {
      return;
    }
    const rect = wrap.getBoundingClientRect();
    setSaveMenuPos({
      left: rect.left - 8,
      top: rect.top + rect.height / 2,
    });
  }

  useLayoutEffect(() => {
    if (!saveMenuOpen) {
      setSaveMenuPos(null);
      return;
    }
    updateSaveMenuPos();
  }, [saveMenuOpen]);

  useEffect(() => {
    if (!saveMenuOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (
        saveMenuRef.current &&
        target &&
        !saveMenuRef.current.contains(target) &&
        saveButtonWrapRef.current &&
        !saveButtonWrapRef.current.contains(target)
      ) {
        setSaveMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSaveMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateSaveMenuPos);
    window.addEventListener("scroll", updateSaveMenuPos, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateSaveMenuPos);
      window.removeEventListener("scroll", updateSaveMenuPos, true);
    };
  }, [saveMenuOpen]);

  function renderSpacer(key: string) {
    return (
      <span
        key={key}
        className="ashby-toolbar-spacer"
        aria-hidden
        style={{
          display: "block",
          width: 1,
          height: buttonGap,
          minHeight: buttonGap,
          flex: `0 0 ${buttonGap}`,
        }}
      />
    );
  }

  function handleSaveFormat(format: ChartSaveFormat) {
    setSaveMenuOpen(false);
    onSave(format);
  }

  const saveMenu =
    saveMenuOpen && saveMenuPos
      ? createPortal(
          <div
            ref={saveMenuRef}
            className="ashby-save-menu-dropdown"
            role="menu"
            aria-label="Формат сохранения"
            style={{
              position: "fixed",
              left: saveMenuPos.left,
              top: saveMenuPos.top,
              transform: "translate(-100%, -50%)",
              minWidth: 120,
              padding: 4,
              border: "1px solid #d8dce3",
              borderRadius: 8,
              backgroundColor: "#fff",
              boxShadow: "0 4px 16px rgba(36, 41, 48, 0.16)",
              zIndex: 10000,
              boxSizing: "border-box",
            }}
          >
            <SaveMenuItem label="PNG" onClick={() => handleSaveFormat("png")} />
            <SaveMenuItem label="SVG" onClick={() => handleSaveFormat("svg")} />
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className="ashby-toolbar"
      data-tour="compare-props-toolbar"
      role="toolbar"
      aria-label="Инструменты графика"
      style={{
        position: "relative",
        zIndex: 100,
        display: "inline-flex",
        flexDirection: "column",
        flexWrap: "nowrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
      }}
    >
      <ToolbarButton
        disabled={!enabled}
        title="Исходный масштаб"
        ariaLabel="Исходный масштаб"
        onClick={onHome}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>
      {renderSpacer("gap-1")}
      <ToolbarButton
        active={mode === "pan"}
        disabled={!enabled}
        title="Перемещение"
        ariaLabel="Перемещение"
        ariaPressed={mode === "pan"}
        onClick={() => onModeChange(mode === "pan" ? "none" : "pan")}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 11V6a2 2 0 0 0-4 0v1" />
          <path d="M14 10V4a2 2 0 0 0-4 0v2" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      </ToolbarButton>
      {renderSpacer("gap-2")}
      <ToolbarButton
        active={mode === "zoom"}
        disabled={!enabled}
        title="Масштаб рамкой"
        ariaLabel="Масштаб рамкой"
        ariaPressed={mode === "zoom"}
        onClick={() => onModeChange(mode === "zoom" ? "none" : "zoom")}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M7 4H4v3" />
          <path d="M17 4h3v3" />
          <path d="M7 20H4v-3" />
          <path d="M17 20h3v-3" />
          <rect x="8" y="8" width="8" height="8" rx="1" />
        </svg>
      </ToolbarButton>
      {renderSpacer("gap-3")}
      <ToolbarButton
        disabled={!enabled}
        title="Приблизить"
        ariaLabel="Приблизить"
        onClick={onZoomIn}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
      {renderSpacer("gap-4")}
      <ToolbarButton
        disabled={!enabled}
        title="Отдалить"
        ariaLabel="Отдалить"
        onClick={onZoomOut}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
      {renderSpacer("gap-5")}
      <div ref={saveButtonWrapRef} className="ashby-save-menu">
        <ToolbarButton
          disabled={!enabled}
          title="Сохранить"
          ariaLabel="Сохранить"
          ariaPressed={saveMenuOpen}
          active={saveMenuOpen}
          onClick={() => setSaveMenuOpen((open) => !open)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 3h11l3 3v15H5V3Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M8 3v6h8V3" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </ToolbarButton>
      </div>
      {saveMenu}
    </div>
  );
}

type PropertyComparisonChartProps = {
  data: ComparePropsResponse | null;
  emptyMessage?: string;
  unitLabels?: Record<string, string>;
};

export function PropertyComparisonChart({
  data,
  emptyMessage = "Выберите материалы и нажмите «Построить график»",
  unitLabels = {},
}: PropertyComparisonChartProps) {
  const layoutActive = useKeepAlivePaneActive();
  const plotRef = useRef<HTMLDivElement>(null);
  const legendOverlayRef = useRef<HTMLDivElement>(null);
  const cursorScaleBridgeRef = useRef<CursorScaleBridge | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const cursorLabelRef = useRef<HTMLDivElement | null>(null);
  const cursorYLineRef = useRef<HTMLDivElement | null>(null);
  const cursorXLineRef = useRef<HTMLDivElement | null>(null);
  const cursorGeomCacheRef = useRef<CursorGeomCache | null>(null);
  const cursorPendingRef = useRef<{ clientX: number; clientY: number } | null>(
    null,
  );
  const cursorLastTextRef = useRef({ y: "", x: "" });
  const toolModeRef = useRef<ChartToolMode>("none");
  const pointTipRef = useRef<ComparePointTip | null>(null);
  const dismissedTipKeyRef = useRef<string | null>(null);
  const plottedSeriesRef = useRef<PlottedCompareSeries[]>([]);
  const xAxisRef = useRef<AxisReadoutMeta>({
    symbol: "T",
    key: "temperature",
    unit: "°С",
    label: "Температура",
  });
  const yAxisRef = useRef<AxisReadoutMeta>({
    symbol: "?",
    key: "value",
    unit: "",
    label: "Значение",
  });

  const [baseDomain, setBaseDomain] = useState<AxisDomain | null>(null);
  const [viewDomain, setViewDomain] = useState<AxisDomain | null>(null);
  const [toolMode, setToolMode] = useState<ChartToolMode>("none");
  const [pointTip, setPointTip] = useState<ComparePointTip | null>(null);
  const [zoomBox, setZoomBox] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const [legendSize, setLegendSize] = useState({ width: 0, height: 0 });
  const [legendPlacement, setLegendPlacement] = useState<LegendPlacement | null>(
    null,
  );
  const [livePlotArea, setLivePlotArea] = useState<PlotArea | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    domain: AxisDomain;
    /** true — жест от зажатого колёсика (не от кнопки «рука»). */
    fromMiddle: boolean;
  } | null>(null);
  /** Временная «рука» по зажатию колёсика (не меняет toolMode на панели). */
  const middlePanHoldRef = useRef(false);
  const [middlePanHold, setMiddlePanHold] = useState(false);

  const series = useMemo(() => data?.series ?? [], [data]);
  const activeSeries = useMemo(
    () => series.filter((entry) => entry.has_data && entry.points.length > 0),
    [series],
  );
  const chartRows = useMemo(() => buildChartRows(activeSeries), [activeSeries]);
  const legendItems = useMemo(
    () =>
      series.map((entry) => ({
        id: entry.id,
        label: entry.label,
        color: entry.color,
      })),
    [series],
  );
  const [chartSize, setChartSize] = useState({ width: 800, height: 480 });
  const yAxisWidthRef = useRef(Y_AXIS_WIDTH_MIN);
  const [yAxisWidth, setYAxisWidth] = useState(Y_AXIS_WIDTH_MIN);

  const xAxisMeta = useMemo<AxisReadoutMeta>(
    () => ({
      symbol: "T",
      key: "temperature",
      unit: "°С",
      label: "Температура",
    }),
    [],
  );
  const yAxisMeta = useMemo<AxisReadoutMeta>(() => {
    if (!data?.property) {
      return { symbol: "?", key: "value", unit: "", label: "Значение" };
    }
    return {
      symbol: formatScientificPlain(data.property.symbol || data.property.name),
      key: data.property.key,
      unit: propertyUnitForDisplay(data.property.unit, unitLabels),
      label: data.property.name,
    };
  }, [data?.property, unitLabels]);

  const yLabel = data
    ? `${data.property.name} [${propertyUnitForDisplay(data.property.unit, unitLabels)}]`
    : "Значение";
  const title = data
    ? `Зависимость свойства «${data.property.name}» от температуры`
    : "Сравнение свойств материалов";

  const chartEmptyHint =
    series.length > 0 && activeSeries.length === 0
      ? "Нет точек для построения графика по выбранным материалам"
      : emptyMessage;

  toolModeRef.current = toolMode;
  pointTipRef.current = pointTip;
  xAxisRef.current = xAxisMeta;
  yAxisRef.current = yAxisMeta;
  plottedSeriesRef.current = activeSeries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    color: entry.color,
    points: entry.points,
  }));

  const clearPointTip = useCallback((dismissKey: string | null = null) => {
    if (dismissKey) {
      dismissedTipKeyRef.current = dismissKey;
    }
    pointTipRef.current = null;
    setPointTip((prev) => (prev === null ? prev : null));
  }, []);

  const handlePointTipReport = useCallback((tip: ComparePointTip | null) => {
    if (!tip) {
      if (pointTipRef.current !== null) {
        pointTipRef.current = null;
        setPointTip(null);
      }
      return;
    }
    const key = comparePointTipKey(tip);
    if (dismissedTipKeyRef.current === key) {
      return;
    }
    dismissedTipKeyRef.current = null;
    const prev = pointTipRef.current;
    if (prev && comparePointTipKey(prev) === key) {
      return;
    }
    pointTipRef.current = tip;
    setPointTip(tip);
  }, []);

  const hideCursorReadout = useCallback(() => {
    cursorPendingRef.current = null;
    if (cursorRafRef.current !== null) {
      cancelAnimationFrame(cursorRafRef.current);
      cursorRafRef.current = null;
    }
    const labelEl = cursorLabelRef.current;
    if (labelEl) {
      labelEl.style.visibility = "hidden";
    }
  }, []);

  const refreshCursorGeomCache = useCallback(() => {
    const canvas = plotRef.current;
    if (!canvas) {
      cursorGeomCacheRef.current = null;
      return null;
    }
    const svg =
      (canvas.querySelector(
        "svg.recharts-surface",
      ) as SVGSVGElement | null) ||
      (canvas.querySelector("svg") as SVGSVGElement | null);
    if (!svg) {
      cursorGeomCacheRef.current = null;
      return null;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const cache: CursorGeomCache = {
      svg,
      canvasLeft: canvasRect.left,
      canvasTop: canvasRect.top,
    };
    cursorGeomCacheRef.current = cache;
    return cache;
  }, []);

  const clientToSvgLocal = useCallback(
    (
      svg: SVGSVGElement,
      clientX: number,
      clientY: number,
    ): { x: number; y: number } | null => {
      try {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const point = svg.createSVGPoint();
          point.x = clientX;
          point.y = clientY;
          const local = point.matrixTransform(ctm.inverse());
          if (Number.isFinite(local.x) && Number.isFinite(local.y)) {
            return { x: local.x, y: local.y };
          }
        }
      } catch {
        // fallback ниже
      }
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      const vb = svg.viewBox.baseVal;
      const vbX = vb && Number.isFinite(vb.x) ? vb.x : 0;
      const vbY = vb && Number.isFinite(vb.y) ? vb.y : 0;
      const vbW = vb && vb.width > 0 ? vb.width : rect.width;
      const vbH = vb && vb.height > 0 ? vb.height : rect.height;
      return {
        x: vbX + ((clientX - rect.left) / rect.width) * vbW,
        y: vbY + ((clientY - rect.top) / rect.height) * vbH,
      };
    },
    [],
  );

  const paintCursorReadout = useCallback(() => {
    cursorRafRef.current = null;
    const pending = cursorPendingRef.current;
    cursorPendingRef.current = null;
    if (!pending) {
      return;
    }
    if (toolModeRef.current !== "none" || middlePanHoldRef.current) {
      hideCursorReadout();
      return;
    }

    try {
      // Всегда обновляем geom: left/top холста съезжают при скролле страницы.
      const geom = refreshCursorGeomCache();
      const labelEl = cursorLabelRef.current;
      const yLineEl = cursorYLineRef.current;
      const xLineEl = cursorXLineRef.current;

      const bridge = cursorScaleBridgeRef.current;
      if (!bridge || !geom) {
        if (labelEl) {
          labelEl.style.visibility = "hidden";
        }
        return;
      }

      const local = clientToSvgLocal(
        geom.svg,
        pending.clientX,
        pending.clientY,
      );
      if (!local) {
        if (labelEl) {
          labelEl.style.visibility = "hidden";
        }
        return;
      }
      const { plotArea, xScale, yScale, domain: bridgeDomain } = bridge;

      // Hit-test до проверки границ поля: точки у края ловятся и с небольшим выносом курсора.
      const hitR2 = POINT_HIT_PX * POINT_HIT_PX;
      let bestDist2 = hitR2;
      let best: {
        temperature: number;
        value: number;
        chartX: number;
        chartY: number;
      } | null = null;
      for (const seriesEntry of plottedSeriesRef.current) {
        for (const point of seriesEntry.points) {
          const cx = xScale?.(point.temperature);
          const cy = yScale?.(point.value);
          if (
            typeof cx !== "number" ||
            typeof cy !== "number" ||
            !Number.isFinite(cx) ||
            !Number.isFinite(cy)
          ) {
            continue;
          }
          const dx = local.x - cx;
          const dy = local.y - cy;
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= bestDist2) {
            bestDist2 = dist2;
            best = {
              temperature: point.temperature,
              value: point.value,
              chartX: Math.round(cx),
              chartY: Math.round(cy),
            };
          }
        }
      }

      if (best) {
        const materials = collectMaterialsAtPoint(
          plottedSeriesRef.current,
          best.temperature,
          best.value,
        );
        handlePointTipReport({
          temperature: best.temperature,
          value: best.value,
          materials:
            materials.length > 0
              ? materials
              : [{ label: "", color: "#242930" }],
          chartX: best.chartX,
          chartY: best.chartY,
        });
        hideCursorReadout();
        return;
      }

      if (pointTipRef.current) {
        // Без dismiss-ключа: иначе повторное наведение на ту же точку молчит.
        clearPointTip();
      }

      const inPlot =
        local.x >= plotArea.x &&
        local.x <= plotArea.x + plotArea.width &&
        local.y >= plotArea.y &&
        local.y <= plotArea.y + plotArea.height;
      if (!inPlot) {
        if (labelEl) {
          labelEl.style.visibility = "hidden";
        }
        return;
      }

      if (!labelEl || !yLineEl || !xLineEl) {
        return;
      }

      const dataX = invertScale(
        xScale,
        local.x,
        bridgeDomain.x.domain,
        plotArea.x,
        plotArea.width,
      );
      const dataY = invertScale(
        yScale,
        local.y,
        bridgeDomain.y.domain,
        plotArea.y,
        plotArea.height,
        true,
      );
      if (!Number.isFinite(dataX) || !Number.isFinite(dataY)) {
        labelEl.style.visibility = "hidden";
        return;
      }

      const left =
        pending.clientX - geom.canvasLeft + CURSOR_COORDS_OFFSET;
      const top =
        pending.clientY - geom.canvasTop + CURSOR_COORDS_OFFSET;
      labelEl.style.transform = `translate(${left}px, ${top}px)`;
      labelEl.style.visibility = "visible";

      const yText = formatScientificPlain(
        formatAxisReadout(yAxisRef.current, dataY),
      );
      const xText = formatScientificPlain(
        formatAxisReadout(xAxisRef.current, dataX),
      );
      if (cursorLastTextRef.current.y !== yText) {
        cursorLastTextRef.current.y = yText;
        yLineEl.textContent = yText;
      }
      if (cursorLastTextRef.current.x !== xText) {
        cursorLastTextRef.current.x = xText;
        xLineEl.textContent = xText;
      }
    } catch {
      hideCursorReadout();
    }
  }, [
    hideCursorReadout,
    refreshCursorGeomCache,
    clearPointTip,
    clientToSvgLocal,
    handlePointTipReport,
  ]);

  const scheduleCursorReadout = useCallback(
    (clientX: number, clientY: number) => {
      if (toolModeRef.current !== "none" || middlePanHoldRef.current) {
        hideCursorReadout();
        return;
      }
      cursorPendingRef.current = { clientX, clientY };
      if (cursorRafRef.current === null) {
        cursorRafRef.current = requestAnimationFrame(paintCursorReadout);
      }
    },
    [hideCursorReadout, paintCursorReadout],
  );

  useEffect(() => {
    return () => {
      if (cursorRafRef.current !== null) {
        cancelAnimationFrame(cursorRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (toolMode !== "none" || middlePanHold) {
      hideCursorReadout();
      clearPointTip();
      dismissedTipKeyRef.current = null;
    }
  }, [toolMode, middlePanHold, hideCursorReadout, clearPointTip]);

  useEffect(() => {
    if (pointTip) {
      hideCursorReadout();
    }
  }, [pointTip, hideCursorReadout]);

  useEffect(() => {
    const next = buildBaseDomain(activeSeries) ?? emptyDomain();
    setBaseDomain(next);
    setViewDomain(next);
    setToolMode("none");
    hideCursorReadout();
    clearPointTip();
    dismissedTipKeyRef.current = null;
    middlePanHoldRef.current = false;
    setMiddlePanHold(false);
    panRef.current = null;
    setZoomBox(null);
    setLegendPlacement(null);
    setLivePlotArea(null);
    const width = estimateYAxisWidth(next.y.ticks);
    yAxisWidthRef.current = width;
    setYAxisWidth(width);
  }, [activeSeries, hideCursorReadout, clearPointTip]);

  const domain = viewDomain ?? baseDomain ?? emptyDomain();
  const hasPlotData = activeSeries.length > 0;

  useEffect(() => {
    cursorGeomCacheRef.current = null;
  }, [chartSize.width, chartSize.height, domain.x.domain, domain.y.domain]);

  useEffect(() => {
    const onScrollOrResize = () => {
      cursorGeomCacheRef.current = null;
    };
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, []);

  const estimatedYAxisWidth = useMemo(
    () => (domain ? estimateYAxisWidth(domain.y.ticks) : Y_AXIS_WIDTH_MIN),
    [domain],
  );

  useEffect(() => {
    const prev = yAxisWidthRef.current;
    if (
      estimatedYAxisWidth > prev ||
      estimatedYAxisWidth < prev - Y_AXIS_WIDTH_SHRINK_HYSTERESIS
    ) {
      yAxisWidthRef.current = estimatedYAxisWidth;
      setYAxisWidth(estimatedYAxisWidth);
    }
  }, [estimatedYAxisWidth]);

  const chartMargin = useMemo(() => buildChartMargin(), []);

  useEffect(() => {
    if (!layoutActive) {
      return;
    }
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const update = () =>
      setChartSize({
        width: el.clientWidth || 800,
        height: el.clientHeight || 480,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layoutActive]);

  useLayoutEffect(() => {
    if (!layoutActive) {
      return;
    }
    const el = legendOverlayRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const updateLegendSize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setLegendSize((prev) =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height },
        );
      }
    };
    updateLegendSize();
    const observer = new ResizeObserver(updateLegendSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layoutActive, legendItems, chartSize.height, legendPlacement?.top]);

  const handleLegendPlacementChange = useCallback((next: LegendPlacement) => {
    setLegendPlacement((prev) =>
      prev && prev.top === next.top && prev.left === next.left ? prev : next,
    );
  }, []);

  const handlePlotAreaChange = useCallback((next: PlotArea) => {
    setLivePlotArea((prev) =>
      prev &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height
        ? prev
        : next,
    );
  }, []);

  const plotAreaForOverlay =
    livePlotArea ??
    getPlotArea(
      chartSize.width,
      chartSize.height,
      chartMargin.left,
      yAxisWidth,
    );

  const clientToData = useCallback(
    (clientX: number, clientY: number) => {
      const el = plotRef.current;
      if (!el || !domain) return null;
      const rect = el.getBoundingClientRect();
      const area =
        livePlotArea ??
        getPlotArea(rect.width, rect.height, chartMargin.left, yAxisWidth);
      const plotLeft = rect.left + area.x;
      const plotTop = rect.top + area.y;
      const plotWidth = Math.max(1, area.width);
      const plotHeight = Math.max(1, area.height);
      const px = clientX - plotLeft;
      const py = clientY - plotTop;
      if (px < 0 || py < 0 || px > plotWidth || py > plotHeight) {
        return null;
      }
      const [xMin, xMax] = domain.x.domain;
      const [yMin, yMax] = domain.y.domain;
      return {
        x: xMin + (px / plotWidth) * (xMax - xMin),
        y: yMax - (py / plotHeight) * (yMax - yMin),
        px,
        py,
        plotWidth,
        plotHeight,
      };
    },
    [domain, livePlotArea, chartMargin.left, yAxisWidth],
  );

  const handleHome = () => {
    setViewDomain(baseDomain);
    setToolMode("none");
  };

  const handleZoomFactor = (factor: number) => {
    setViewDomain((prev) => {
      const current = prev ?? baseDomain;
      if (!current) return prev;
      return {
        x: zoomDomain(current.x, factor),
        y: zoomDomain(current.y, factor),
      };
    });
  };

  const endMiddlePanHold = useCallback(() => {
    if (!middlePanHoldRef.current) {
      return;
    }
    middlePanHoldRef.current = false;
    setMiddlePanHold(false);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hasPlotData) return;

    // Средняя кнопка (колёсико): временная «рука» на время зажатия.
    if (event.button === 1) {
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      const mapped = clientToData(event.clientX, event.clientY);
      if (!mapped) return;
      middlePanHoldRef.current = true;
      setMiddlePanHold(true);
      hideCursorReadout();
      clearPointTip();
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        domain,
        fromMiddle: true,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    // Инструменты панели — только ЛКМ.
    if (event.button !== 0) return;

    if (toolMode === "pan" || toolMode === "zoom") {
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
    }

    const mapped = clientToData(event.clientX, event.clientY);
    if (!mapped) return;

    if (toolMode === "pan") {
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        domain,
        fromMiddle: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (toolMode === "zoom") {
      setZoomBox({
        x0: mapped.px,
        y0: mapped.py,
        x1: mapped.px,
        y1: mapped.py,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      hasPlotData &&
      toolMode === "none" &&
      !middlePanHoldRef.current &&
      !panRef.current
    ) {
      scheduleCursorReadout(event.clientX, event.clientY);
    }

    const mapped = clientToData(event.clientX, event.clientY);

    // Pan: и от кнопки «рука», и от зажатого колёсика.
    if (panRef.current?.pointerId === event.pointerId) {
      const el = plotRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const area =
        livePlotArea ??
        getPlotArea(rect.width, rect.height, chartMargin.left, yAxisWidth);
      const plotWidth = Math.max(1, area.width);
      const plotHeight = Math.max(1, area.height);
      const start = panRef.current.domain;
      const dxPx = event.clientX - panRef.current.startX;
      const dyPx = event.clientY - panRef.current.startY;
      const [xMin, xMax] = start.x.domain;
      const [yMin, yMax] = start.y.domain;
      const dx = (-dxPx / plotWidth) * (xMax - xMin);
      const dy = (dyPx / plotHeight) * (yMax - yMin);
      setViewDomain({
        x: shiftDomain(start.x, dx),
        y: shiftDomain(start.y, dy),
      });
      return;
    }

    if (toolMode === "zoom" && zoomBox && mapped) {
      setZoomBox((prev) =>
        prev ? { ...prev, x1: mapped.px, y1: mapped.py } : prev,
      );
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      const fromMiddle = panRef.current.fromMiddle;
      panRef.current = null;
      if (fromMiddle) {
        endMiddlePanHold();
      }
      return;
    }

    if (toolMode === "zoom" && zoomBox && domain) {
      const el = plotRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const area =
          livePlotArea ??
          getPlotArea(rect.width, rect.height, chartMargin.left, yAxisWidth);
        const plotWidth = Math.max(1, area.width);
        const plotHeight = Math.max(1, area.height);
        const left = Math.min(zoomBox.x0, zoomBox.x1);
        const right = Math.max(zoomBox.x0, zoomBox.x1);
        const top = Math.min(zoomBox.y0, zoomBox.y1);
        const bottom = Math.max(zoomBox.y0, zoomBox.y1);
        if (right - left > 8 && bottom - top > 8) {
          const [xMin, xMax] = domain.x.domain;
          const [yMin, yMax] = domain.y.domain;
          const nextX: [number, number] = [
            xMin + (left / plotWidth) * (xMax - xMin),
            xMin + (right / plotWidth) * (xMax - xMin),
          ];
          const nextY: [number, number] = [
            yMax - (bottom / plotHeight) * (yMax - yMin),
            yMax - (top / plotHeight) * (yMax - yMin),
          ];
          setViewDomain({
            x: computeTicksForFixedDomain(nextX[0], nextX[1]),
            y: computeTicksForFixedDomain(nextY[0], nextY[1]),
          });
        }
      }
      setZoomBox(null);
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
    }
    endMiddlePanHold();
    setZoomBox(null);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!hasPlotData) return;
    event.preventDefault();
    const mapped = clientToData(event.clientX, event.clientY);
    const factor = wheelZoomFactor(event.deltaY, event.deltaMode);
    setViewDomain({
      x: mapped
        ? zoomDomainAt(domain.x, factor, mapped.x)
        : zoomDomain(domain.x, factor),
      y: mapped
        ? zoomDomainAt(domain.y, factor, mapped.y)
        : zoomDomain(domain.y, factor),
    });
  };

  const handleSave = async (format: ChartSaveFormat) => {
    const root = plotRef.current;
    if (!root || !hasPlotData) {
      return;
    }
    try {
      if (format === "svg") {
        exportChartWithLegendSvg(root, "property-comparison.svg");
        return;
      }
      await exportChartWithLegendPng(root, "property-comparison.png");
    } catch (error) {
      console.error(error);
    }
  };

  const axisSeedRows: ChartRow[] = [{ temperature: domain.x.domain[0] }];
  const lineChartData = chartRows.length > 0 ? chartRows : axisSeedRows;

  const canvasClass =
    toolMode === "pan" || middlePanHold
      ? "ashby-chart-canvas ashby-chart-canvas--pan"
      : toolMode === "zoom"
        ? "ashby-chart-canvas ashby-chart-canvas--zoom"
        : "ashby-chart-canvas";

  return (
    <div className="compare-props-chart">
      <div
        ref={plotRef}
        className={canvasClass}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onAuxClick={(event) => {
          // Блокируем автоскролл/меню браузера по средней кнопке.
          if (event.button === 1) {
            event.preventDefault();
          }
        }}
        onPointerLeave={() => {
          hideCursorReadout();
          clearPointTip();
          dismissedTipKeyRef.current = null;
        }}
        onPointerEnter={() => {
          cursorGeomCacheRef.current = null;
        }}
        onWheel={handleWheel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineChartData} margin={chartMargin}>
            <CompareChartTitle title={title} />
            <CompareYAxisLabel label={yLabel} yAxisWidth={yAxisWidth} />
            {/* Основные секции — сплошная сетка по тикам (как ax.grid(True)). */}
            <CartesianGrid stroke="#c5cad3" strokeWidth={1} />
            {/* Мини-секции — пунктир посередине между тиками. */}
            <CompareMinorGridlines
              xTicks={domain.x.ticks}
              yTicks={domain.y.ticks}
            />
            <XAxis
              type="number"
              dataKey="temperature"
              domain={domain.x.domain}
              ticks={domain.x.ticks}
              tick={{ fontSize: 13, fill: "var(--text)" }}
              tickFormatter={formatTickLabel}
              label={{
                value: "Температура [°С]",
                position: "bottom",
                offset: AXIS_LABEL_GAP,
                style: { fontSize: 14, fill: "var(--text)" },
              }}
              allowDataOverflow
            />
            <YAxis
              type="number"
              width={yAxisWidth}
              domain={domain.y.domain}
              ticks={domain.y.ticks}
              tick={{ fontSize: 13, fill: "var(--text)" }}
              tickFormatter={formatTickLabel}
              allowDataOverflow
            />
            {activeSeries.map((entry) => (
              <Line
                key={entry.id}
                type="linear"
                dataKey={entry.id}
                name={entry.label}
                stroke={entry.color}
                strokeWidth={2}
                connectNulls
                legendType="none"
                dot={{ r: 4, fill: entry.color, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey={entry.id}
                  position="top"
                  offset={6}
                  formatter={formatPointLabel}
                  style={{ fontSize: 11, fill: "dimgray" }}
                />
              </Line>
            ))}
            <ComparePlotClip domain={domain} seriesCount={activeSeries.length} />
            <CompareCursorScaleReporter
              domain={domain}
              bridgeRef={cursorScaleBridgeRef}
            />
            <CompareLegendPlacementReporter
              series={activeSeries}
              domain={domain}
              legendSize={legendSize}
              toolMode={toolMode}
              onPlacementChange={handleLegendPlacementChange}
              onPlotAreaChange={handlePlotAreaChange}
            />
          </LineChart>
        </ResponsiveContainer>

        <ComparePropsLegendOverlay
          items={legendItems}
          plotArea={plotAreaForOverlay}
          placement={legendPlacement}
          overlayRef={legendOverlayRef}
          emptyMessage={chartEmptyHint}
        />

        {zoomBox && (
          <div
            className="ashby-zoom-box"
            style={{
              left: plotAreaForOverlay.x + Math.min(zoomBox.x0, zoomBox.x1),
              top: plotAreaForOverlay.y + Math.min(zoomBox.y0, zoomBox.y1),
              width: Math.abs(zoomBox.x1 - zoomBox.x0),
              height: Math.abs(zoomBox.y1 - zoomBox.y0),
            }}
          />
        )}

        <div
          className="ashby-tooltip-portal"
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 30,
            pointerEvents: "none",
          }}
        >
          {pointTip && hasPlotData ? (
            <ComparePointTipPlaque
              tip={pointTip}
              xAxis={xAxisMeta}
              yAxis={yAxisMeta}
              plotArea={plotAreaForOverlay}
              containerWidth={chartSize.width}
              containerHeight={chartSize.height}
            />
          ) : null}
          <CompareCursorCoordsLabel
            labelRef={cursorLabelRef}
            yLineRef={cursorYLineRef}
            xLineRef={cursorXLineRef}
          />
        </div>
      </div>

      <CompareChartToolbar
        enabled={hasPlotData}
        mode={toolMode}
        onHome={handleHome}
        onModeChange={setToolMode}
        onZoomIn={() => handleZoomFactor(0.8)}
        onZoomOut={() => handleZoomFactor(1.25)}
        onSave={(format) => {
          void handleSave(format);
        }}
      />
    </div>
  );
}
