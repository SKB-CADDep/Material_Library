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
} from "react";
import { createPortal } from "react-dom";
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
import { ScientificText } from "../lib/scientificNotation";
import {
  larsonMillerChartEmptyMessage,
  type LarsonMillerChartEmptyReason,
} from "../lib/larsonMillerStatus";
import {
  exportChartWithLegendPng,
  exportChartWithLegendSvg,
  type ChartSaveFormat,
} from "../lib/chartLegendExport";
import { useKeepAlivePaneActive } from "../context/KeepAlivePaneContext";
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
const TOOLBAR_ACCENT = "#3D5A80";
const TOOLBAR_ACCENT_HOVER = "#2f4766";
const TOOLBAR_ACCENT_SOFT = "rgba(61, 90, 128, 0.14)";

const X_AXIS_LABEL = "P = (T + 273.15)(lg τ + C) / 1000";
const Y_AXIS_LABEL = "Напряжение, МПа";

type ScaleLike = ((value: number | string) => number | undefined) & {
  invert?: (value: number) => number;
};

type AxisDomain = {
  x: NiceAxisResult;
  y: NiceAxisResult;
};

type ChartToolMode = "none" | "pan" | "zoom";

type PlotArea = { x: number; y: number; width: number; height: number };

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

function getPlotArea(chartWidth: number, chartHeight: number): PlotArea {
  const x = CHART_MARGIN.left + Y_AXIS_WIDTH;
  return {
    x,
    y: CHART_MARGIN.top,
    width: Math.max(1, chartWidth - x - CHART_MARGIN.right),
    height: Math.max(
      1,
      chartHeight - CHART_MARGIN.top - CHART_MARGIN.bottom,
    ),
  };
}

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

/**
 * Обрезает маркеры и линию по полю осей — при pan/zoom ничего не «вылезает».
 */
function LarsonMillerPlotClip({
  domain,
  seriesKey,
}: {
  domain: AxisDomain;
  seriesKey: string;
}) {
  const plotArea = usePlotArea();
  const reactId = useId().replace(/:/g, "");
  const clipId = `larson-miller-plot-clip-${reactId}`;

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
            ".recharts-scatter",
            ".recharts-scatter-symbols",
            ".recharts-layer.recharts-scatter-line",
            ".recharts-curve",
            "path.recharts-curve",
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
    seriesKey,
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

function LarsonMillerPlotAreaReporter({
  onPlotAreaChange,
}: {
  onPlotAreaChange: (plotArea: PlotArea) => void;
}) {
  const plotArea = usePlotArea();

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

  return null;
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
      <div>
        <ScientificText>
          {formatChartTooltipLine("σ_дп", point.stress, "МПа")}
        </ScientificText>
      </div>
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
  gridTemplateColumns: "28px max-content",
  alignItems: "center",
  listStyle: "none",
  width: "max-content",
  maxWidth: "none",
  margin: "0 0 6px",
  padding: 0,
  fontSize: 13,
  lineHeight: 1.4,
  color: "#242930",
  boxSizing: "border-box",
};

type LarsonMillerChartProps = {
  data: LarsonMillerResponse | null;
  emptyReason?: LarsonMillerChartEmptyReason | null;
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
  plotArea: PlotArea,
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
  plotArea: PlotArea,
  legendSize: { width: number; height: number },
  pad: number,
): LegendPlacement[] {
  const width = Math.max(legendSize.width, 1);
  const minLeft = plotArea.x + pad;
  const maxLeft = plotArea.x + plotArea.width - width - pad;
  const minTop = plotArea.y + pad;
  if (!Number.isFinite(minLeft) || !Number.isFinite(maxLeft) || maxLeft < minLeft) {
    return [{ left: minLeft, top: minTop }];
  }
  // Слева сверху — приоритет (справа тулбар, легенда не должна сжиматься).
  return [
    { left: minLeft, top: minTop },
    { left: maxLeft, top: minTop },
  ];
}

function findBestLegendPlacement(
  plotArea: PlotArea,
  legendSize: { width: number; height: number },
  geometry: LegendGeometry,
): LegendPlacement {
  const pad = LEGEND_PADDING;
  // Оценка до измерения: «Элементы на графике» + «Кривая длительной прочности».
  const width = legendSize.width > 0 ? legendSize.width : 280;
  const height = legendSize.height > 0 ? legendSize.height : 88;

  if (plotArea.width <= 0 || plotArea.height <= 0) {
    return { left: Math.max(0, plotArea.x + pad), top: Math.max(0, plotArea.y + pad) };
  }

  const size = { width, height };
  const fallbackRect = clampLegendRectToPlotArea(
    {
      left: plotArea.x + pad,
      top: plotArea.y + pad,
      width,
      height,
    },
    plotArea,
    pad,
  );
  const fallback = { left: fallbackRect.left, top: fallbackRect.top };

  const candidates = buildLegendCandidateGrid(plotArea, size, pad);
  let bestPlacement = fallback;
  let bestBadness = Infinity;
  let bestTie = Infinity;

  for (const candidate of candidates) {
    const rect = clampLegendRectToPlotArea(
      {
        left: candidate.left,
        top: candidate.top,
        width,
        height,
      },
      plotArea,
      pad,
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

function LarsonMillerChartToolbar({
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
      data-tour="lm-chart-toolbar"
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

export function LarsonMillerChart({
  data,
  emptyReason = null,
}: LarsonMillerChartProps) {
  const layoutActive = useKeepAlivePaneActive();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [legendSize, setLegendSize] = useState({ width: 0, height: 0 });
  const [baseDomain, setBaseDomain] = useState<AxisDomain | null>(null);
  const [viewDomain, setViewDomain] = useState<AxisDomain | null>(null);
  const [toolMode, setToolMode] = useState<ChartToolMode>("none");
  const [zoomBox, setZoomBox] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const [livePlotArea, setLivePlotArea] = useState<PlotArea | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    domain: AxisDomain;
    fromMiddle: boolean;
  } | null>(null);
  const middlePanHoldRef = useRef(false);
  const [middlePanHold, setMiddlePanHold] = useState(false);

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

  const hasSeries = curvePoints.length > 0 || calcPoint.length > 0;
  const seriesKey = `${curvePoints.length}:${calcPoint.length}:${xValues.join(",")}:${yValues.join(",")}`;

  useEffect(() => {
    if (!hasSeries) {
      setBaseDomain(null);
      setViewDomain(null);
      setToolMode("none");
      setZoomBox(null);
      middlePanHoldRef.current = false;
      setMiddlePanHold(false);
      panRef.current = null;
      setLivePlotArea(null);
      return;
    }
    const next: AxisDomain = {
      x: resolveAxis(xValues, DEFAULT_X_DOMAIN),
      y: resolveAxis(yValues, DEFAULT_Y_DOMAIN),
    };
    setBaseDomain(next);
    setViewDomain(next);
    setToolMode("none");
    setZoomBox(null);
    middlePanHoldRef.current = false;
    setMiddlePanHold(false);
    panRef.current = null;
    setLivePlotArea(null);
  }, [hasSeries, seriesKey, xValues, yValues]);

  const domain = viewDomain ?? baseDomain;
  const plotAreaForOverlay =
    livePlotArea ?? getPlotArea(chartSize.width, chartSize.height);

  const legendGeometry = useMemo((): LegendGeometry => {
    if (!domain) {
      return { points: [], segments: [] };
    }
    const [xMin, xMax] = domain.x.domain;
    const [yMin, yMax] = domain.y.domain;
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;
    const toPx = (p: number, stress: number): PlotPoint => ({
      x: plotAreaForOverlay.x + ((p - xMin) / xSpan) * plotAreaForOverlay.width,
      y:
        plotAreaForOverlay.y +
        (1 - (stress - yMin) / ySpan) * plotAreaForOverlay.height,
    });

    const curvePixelPoints = curvePoints.map((point) => toPx(point.p, point.stress));
    const curveGeometry = samplePolylinePoints(curvePixelPoints);
    const calcPixelPoints = calcPoint.map((point) => toPx(point.p, point.stress));
    return {
      points: [...curveGeometry.points, ...calcPixelPoints],
      segments: curveGeometry.segments,
    };
  }, [
    calcPoint,
    curvePoints,
    domain,
    plotAreaForOverlay.height,
    plotAreaForOverlay.width,
    plotAreaForOverlay.x,
    plotAreaForOverlay.y,
  ]);

  const legendPlacement = useMemo(
    () => findBestLegendPlacement(plotAreaForOverlay, legendSize, legendGeometry),
    [legendGeometry, legendSize, plotAreaForOverlay],
  );

  useEffect(() => {
    if (!layoutActive || !hasSeries) {
      return;
    }
    const wrapEl = plotRef.current;
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
  }, [layoutActive, hasSeries]);

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

  const clientToData = useCallback(
    (clientX: number, clientY: number) => {
      const el = plotRef.current;
      if (!el || !domain) return null;
      const rect = el.getBoundingClientRect();
      const area =
        livePlotArea ?? getPlotArea(rect.width, rect.height);
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
    [domain, livePlotArea],
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
    if (!hasSeries || !domain) return;

    if (event.button === 1) {
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      const mapped = clientToData(event.clientX, event.clientY);
      if (!mapped) return;
      middlePanHoldRef.current = true;
      setMiddlePanHold(true);
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
    const mapped = clientToData(event.clientX, event.clientY);

    if (panRef.current?.pointerId === event.pointerId) {
      const el = plotRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const area = livePlotArea ?? getPlotArea(rect.width, rect.height);
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
        const area = livePlotArea ?? getPlotArea(rect.width, rect.height);
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
    if (!hasSeries || !domain) return;
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
    if (!root || !hasSeries) {
      return;
    }
    try {
      if (format === "svg") {
        exportChartWithLegendSvg(root, "larson-miller.svg");
        return;
      }
      await exportChartWithLegendPng(root, "larson-miller.png");
    } catch (error) {
      console.error(error);
    }
  };

  if (!hasSeries) {
    return (
      <div className="larson-miller-chart-wrap larson-miller-chart-empty">
        <p className="larson-miller-chart-empty-message">
          {emptyReason
            ? larsonMillerChartEmptyMessage(emptyReason)
            : "Недостаточно данных для построения кривой."}
        </p>
      </div>
    );
  }

  if (!domain) {
    return null;
  }

  const canvasClass =
    toolMode === "pan" || middlePanHold
      ? "ashby-chart-canvas larson-miller-chart-wrap ashby-chart-canvas--pan"
      : toolMode === "zoom"
        ? "ashby-chart-canvas larson-miller-chart-wrap ashby-chart-canvas--zoom"
        : "ashby-chart-canvas larson-miller-chart-wrap";

  const toolsActive = toolMode !== "none" || middlePanHold;

  return (
    <div className="larson-miller-chart">
      <div
        ref={plotRef}
        className={canvasClass}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
          }
        }}
        onWheel={handleWheel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={CHART_MARGIN}>
            <LarsonMillerAxisLabels />
            <CartesianGrid stroke="#c5cad3" strokeWidth={1} />
            <LarsonMillerMinorGridlines
              xTicks={domain.x.ticks}
              yTicks={domain.y.ticks}
            />
            <XAxis
              type="number"
              dataKey="p"
              domain={domain.x.domain}
              ticks={domain.x.ticks}
              height={X_AXIS_HEIGHT}
              tick={{ fontSize: 13, fill: "#242930" }}
              tickFormatter={(value) => formatTickLabel(value)}
              allowDataOverflow
            />
            <YAxis
              type="number"
              dataKey="stress"
              width={Y_AXIS_WIDTH}
              domain={domain.y.domain}
              ticks={domain.y.ticks}
              tick={{ fontSize: 13, fill: "#242930" }}
              tickFormatter={(value) => formatTickLabel(value)}
              allowDataOverflow
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) =>
                toolsActive ? null : (
                  <LarsonMillerPointTooltip active={active} payload={payload} />
                )
              }
            />
            {curvePoints.length > 0 && (
              <Scatter
                name="Кривая длит.прочности"
                data={curvePoints}
                fill={CURVE_COLOR}
                line
                isAnimationActive={false}
              />
            )}
            {calcPoint.length > 0 && (
              <Scatter
                name="Расчетные данные"
                data={calcPoint}
                fill={CALC_COLOR}
                isAnimationActive={false}
              />
            )}
            <LarsonMillerPlotClip domain={domain} seriesKey={seriesKey} />
            <LarsonMillerPlotAreaReporter onPlotAreaChange={handlePlotAreaChange} />
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
            maxWidth: "none",
            display: "flex",
            flexDirection: "column",
            padding: "10px 10px 8px",
            border: "1px solid #d8dce3",
            borderRadius: 6,
            backgroundColor: LEGEND_OVERLAY_BG,
            boxShadow: "0 2px 10px rgba(36, 41, 48, 0.12)",
            boxSizing: "border-box",
            overflow: "visible",
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
              overflow: "visible",
              flex: "0 0 auto",
            }}
          >
            Элементы на графике
          </div>
          <ul
            className="ashby-legend-overlay-list larson-miller-legend-list"
            aria-label="Элементы на графике"
            style={{
              margin: 0,
              padding: "4px 4px 8px",
              listStyle: "none",
              overflow: "visible",
              flex: "0 0 auto",
              minHeight: 0,
              width: "max-content",
              maxWidth: "none",
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
      </div>

      <LarsonMillerChartToolbar
        enabled={hasSeries}
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
