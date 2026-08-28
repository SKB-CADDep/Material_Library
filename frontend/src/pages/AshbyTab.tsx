import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from "recharts";
import { useWorkspace } from "../context/WorkSpaceContext";
import { getAshbyOptions, postAshby } from "../api/selection";
import { applyAshbyChartColors } from "../lib/chartColors";
import type {
  AshbyAxisMeta,
  AshbyAxisOption,
  AshbyHull,
  AshbyResponse,
} from "../types/api";
import {
  formatScientificPlain,
  ScientificText,
} from "../lib/scientificNotation";
import {
  computeNiceAxisFromValues,
  computeTicksForFixedDomain,
  type NiceAxisResult,
} from "../utils/chartTicks";

/** Отступы ScatterChart. top увеличен — под заголовок над полем осей. */
const ASHBY_CHART_MARGIN = { top: 40, right: 28, bottom: 48, left: 64 } as const;
/** Минимальная ширина полосы тиков Y (короткие числа). */
const ASHBY_Y_AXIS_WIDTH_MIN = 48;
/** Отступ подписи Y слева от полосы тиков. */
const ASHBY_Y_LABEL_OUTSIDE_GAP = 14;
/** Не сужаем полосу Y, пока оценка не меньше на столько px (анти-дёргание при зуме). */
const ASHBY_Y_AXIS_WIDTH_SHRINK_HYSTERESIS = 16;
/** Высота полосы тиков X в Recharts (default). */
const ASHBY_X_AXIS_HEIGHT = 30;
/** Внутренний отступ от границ поля графика (примерно 0.5 см). */
const ASHBY_EDGE_PADDING_RATIO = 0.07;
/**
 * Расстояние подписи X от линии оси (= высота тиков X + прежний offset).
 */
const ASHBY_AXIS_TITLE_GAP = ASHBY_X_AXIS_HEIGHT + 18;
/** Отступ легенды от границ области данных (как borderaxespad в matplotlib). */
const ASHBY_LEGEND_PADDING = 12;
/** Фон легенды: полупрозрачный белый (50%). */
const ASHBY_LEGEND_OVERLAY_BG = "rgba(255, 255, 255, 0.5)";
/** Отступ плашки координат от точки (как у Recharts Tooltip offset). */
const ASHBY_TOOLTIP_OFFSET = 10;
/** Отступ текстовых координат курсора (без плашки) от указателя. */
const ASHBY_CURSOR_COORDS_OFFSET = 12;
/**
 * Радиус захвата точки для плашки (px в системе SVG).
 * Крупнее маркера — плашка срабатывает и при мелком масштабе.
 */
const ASHBY_POINT_HIT_PX = 14;
/** Пауза перед пересчётом позиции легенды после смены domain (мс). */
const ASHBY_LEGEND_PLACE_DEBOUNCE_MS = 120;
/** Зазор между графиком и боковой легендой при экспорте (px экрана). */
const ASHBY_EXPORT_LEGEND_SIDE_GAP = 16;

type AshbyCursorGeomCache = {
  svg: SVGSVGElement;
  canvasLeft: number;
  canvasTop: number;
};

type AshbyExportLegendItem = {
  label: string;
  color: string;
  kind: "series" | "class";
  strokeDasharray?: string;
};

type AshbyLegendSidePanelLayout = {
  title: string;
  width: number;
  height: number;
  padding: number;
  titleY: number;
  titleFontSize: number;
  fontSize: number;
  markerW: number;
  labelPad: number;
  rows: Array<{
    x: number;
    y: number;
    label: string;
    color: string;
    kind: "series" | "class";
    strokeDasharray?: string;
  }>;
};

type AshbyPointTip = {
  x: number;
  y: number;
  /** Все материалы с этой координатой (совпадающие точки). */
  materials: Array<{ label: string; color: string }>;
  /** Координата маркера в системе chart (как у Recharts Tooltip coordinate). */
  chartX: number;
  chartY: number;
};

type AshbyCursorScaleBridge = {
  plotArea: { x: number; y: number; width: number; height: number };
  xScale: ScaleLike | undefined;
  yScale: ScaleLike | undefined;
  domain: AxisDomain;
};

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось загрузить изображение графика"));
    img.src = url;
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Легенда на экране прокручивается — для экспорта нужна боковая панель. */
function isAshbyLegendListScrollable(overlay: HTMLElement): boolean {
  const list = overlay.querySelector(".ashby-legend-overlay-list");
  if (!(list instanceof HTMLElement)) {
    return false;
  }
  return list.scrollHeight > list.clientHeight + 1;
}

function collectAshbyExportLegendItems(
  overlay: HTMLElement,
): AshbyExportLegendItem[] {
  const items: AshbyExportLegendItem[] = [];
  overlay.querySelectorAll(".ashby-legend-item").forEach((item) => {
    const itemEl = item as HTMLElement;
    const label = itemEl.querySelector(
      ".ashby-legend-label",
    ) as HTMLElement | null;
    if (!label) {
      return;
    }
    const markerSvg = itemEl.querySelector("svg");
    const circle = markerSvg?.querySelector("circle");
    const rect = markerSvg?.querySelector("rect");
    const line = markerSvg?.querySelector("line");
    const color =
      circle?.getAttribute("fill") ||
      rect?.getAttribute("fill") ||
      line?.getAttribute("stroke") ||
      "#3D5A80";
    items.push({
      label: label.textContent?.trim() ?? "",
      color,
      kind: rect ? "class" : "series",
      strokeDasharray: line?.getAttribute("stroke-dasharray") || undefined,
    });
  });
  return items;
}

function readAshbyLegendOverlayTitle(overlay: HTMLElement): string {
  const title = overlay.querySelector(
    ".ashby-legend-overlay-title",
  ) as HTMLElement | null;
  return title?.textContent?.trim() || "Элементы на графике";
}

/** Раскладка полной легенды справа от графика (только для экспорта).
 * Высота ограничена низом графика: лишние пункты уходят во 2-ю, 3-ю… колонки.
 */
function measureAshbyLegendSidePanel(
  items: AshbyExportLegendItem[],
  title: string,
  maxHeight: number,
): AshbyLegendSidePanelLayout {
  const padding = 12;
  const titleFontSize = 14;
  const fontSize = 13;
  const markerW = 28;
  const labelPad = Math.round((0.25 * 96) / 2.54);
  const rowGap = 6;
  const colGap = 16;
  const rowHeight = Math.max(18, Math.ceil(fontSize * 1.4));
  const titleBlock = titleFontSize + 10;
  const listTop = padding + titleBlock;

  const canvas = document.createElement("canvas");
  const measureCtx = canvas.getContext("2d");
  let maxLabel = 80;
  let titleWidth = 80;
  if (measureCtx) {
    measureCtx.font = `500 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
    titleWidth = measureCtx.measureText(title).width;
    measureCtx.font = `400 ${fontSize}px system-ui, -apple-system, sans-serif`;
    for (const item of items) {
      maxLabel = Math.max(maxLabel, measureCtx.measureText(item.label).width);
    }
  }

  const colInnerW = markerW + labelPad + maxLabel;
  const availableListH = Math.max(
    rowHeight,
    maxHeight - listTop - padding,
  );
  const rowsPerCol = Math.max(
    1,
    Math.floor((availableListH + rowGap) / (rowHeight + rowGap)),
  );
  const colCount = Math.max(1, Math.ceil(items.length / rowsPerCol));
  const contentW = colCount * colInnerW + Math.max(0, colCount - 1) * colGap;
  const width = Math.ceil(padding * 2 + Math.max(contentW, titleWidth));

  const rows = items.map((item, index) => {
    const col = Math.floor(index / rowsPerCol);
    const row = index % rowsPerCol;
    return {
      ...item,
      x: padding + col * (colInnerW + colGap),
      y: listTop + row * (rowHeight + rowGap) + rowHeight / 2,
    };
  });

  const tallestRows = Math.min(rowsPerCol, items.length);
  const height = Math.ceil(
    Math.min(
      maxHeight,
      listTop +
        tallestRows * rowHeight +
        Math.max(0, tallestRows - 1) * rowGap +
        padding,
    ),
  );

  return {
    title,
    width,
    height,
    padding,
    titleY: padding + titleFontSize / 2,
    titleFontSize,
    fontSize,
    markerW,
    labelPad,
    rows,
  };
}

function drawExportLegendMarker(
  ctx: CanvasRenderingContext2D,
  item: Pick<AshbyExportLegendItem, "color" | "kind" | "strokeDasharray">,
  mx: number,
  cy: number,
  markerW: number,
): void {
  const color = item.color || "#3D5A80";
  if (item.kind === "class") {
    const mh = 12;
    const my = cy - mh / 2;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(mx, my, markerW, mh);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, markerW, mh);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  if (item.strokeDasharray) {
    ctx.setLineDash(
      item.strokeDasharray
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => Number.isFinite(n)),
    );
  } else {
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.moveTo(mx + 1, cy);
  ctx.lineTo(mx + markerW - 1, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(mx + markerW / 2, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegendSidePanelToContext(
  ctx: CanvasRenderingContext2D,
  layout: AshbyLegendSidePanelLayout,
  ox: number,
  oy: number,
): void {
  ctx.save();
  roundRectPath(ctx, ox, oy, layout.width, layout.height, 6);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#d8dce3";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#242930";
  ctx.font = `500 ${layout.titleFontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(layout.title, ox + layout.padding, oy + layout.titleY);

  for (const row of layout.rows) {
    const mx = ox + row.x;
    const cy = oy + row.y;
    drawExportLegendMarker(ctx, row, mx, cy, layout.markerW);
    ctx.fillStyle = "#242930";
    ctx.font = `400 ${layout.fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(
      row.label,
      mx + layout.markerW + layout.labelPad,
      cy,
    );
  }
  ctx.restore();
}

function appendExportLegendMarkerSvg(
  group: SVGElement,
  item: Pick<AshbyExportLegendItem, "color" | "kind" | "strokeDasharray">,
  mx: number,
  cy: number,
  markerW: number,
  scaleX: number,
  scaleY: number,
): void {
  const color = item.color || "#3D5A80";
  if (item.kind === "class") {
    const mh = 12 * scaleY;
    group.appendChild(
      svgEl("rect", {
        x: mx,
        y: cy - mh / 2,
        width: markerW,
        height: mh,
        rx: 2 * scaleX,
        fill: color,
        "fill-opacity": 0.45,
        stroke: color,
        "stroke-opacity": 0.85,
        "stroke-width": 1 * scaleX,
      }),
    );
    return;
  }
  group.appendChild(
    svgEl("line", {
      x1: mx + scaleX,
      y1: cy,
      x2: mx + markerW - scaleX,
      y2: cy,
      stroke: color,
      "stroke-width": 2 * scaleX,
      "stroke-linecap": "round",
      ...(item.strokeDasharray
        ? { "stroke-dasharray": item.strokeDasharray }
        : {}),
    }),
  );
  group.appendChild(
    svgEl("circle", {
      cx: mx + markerW / 2,
      cy,
      r: 4 * scaleX,
      fill: color,
      stroke: color,
    }),
  );
}

/** Полная легенда справа от графика в координатах SVG. */
function appendLegendSidePanelSvg(
  parent: SVGElement,
  layout: AshbyLegendSidePanelLayout,
  ox: number,
  oy: number,
  scaleX: number,
  scaleY: number,
): { width: number; height: number } {
  const width = layout.width * scaleX;
  const height = layout.height * scaleY;
  const group = svgEl("g", { class: "ashby-legend-export-side" });

  group.appendChild(
    svgEl("rect", {
      x: ox,
      y: oy,
      width,
      height,
      rx: 6 * scaleX,
      ry: 6 * scaleY,
      fill: "#ffffff",
      stroke: "#d8dce3",
      "stroke-width": 1 * scaleX,
    }),
  );

  const title = svgEl("text", {
    x: ox + layout.padding * scaleX,
    y: oy + layout.titleY * scaleY,
    fill: "#242930",
    "font-size": layout.titleFontSize * scaleY,
    "font-weight": "500",
    "font-family": "system-ui, -apple-system, sans-serif",
    "dominant-baseline": "middle",
  });
  title.textContent = layout.title;
  group.appendChild(title);

  const markerW = layout.markerW * scaleX;
  for (const row of layout.rows) {
    const mx = ox + row.x * scaleX;
    const cy = oy + row.y * scaleY;
    appendExportLegendMarkerSvg(
      group,
      row,
      mx,
      cy,
      markerW,
      scaleX,
      scaleY,
    );
    const text = svgEl("text", {
      x: mx + markerW + layout.labelPad * scaleX,
      y: cy,
      fill: "#242930",
      "font-size": layout.fontSize * scaleY,
      "font-family": "system-ui, -apple-system, sans-serif",
      "dominant-baseline": "middle",
    });
    text.textContent = row.label;
    group.appendChild(text);
  }

  parent.appendChild(group);
  return { width, height };
}

function resolveAshbyExportLegend(
  root: HTMLElement,
  maxHeight: number,
): {
  overlay: HTMLElement | null;
  sidePanel: AshbyLegendSidePanelLayout | null;
} {
  const overlay = root.querySelector(
    ".ashby-legend-overlay",
  ) as HTMLElement | null;
  if (!overlay) {
    return { overlay: null, sidePanel: null };
  }
  if (!isAshbyLegendListScrollable(overlay)) {
    return { overlay, sidePanel: null };
  }
  const items = collectAshbyExportLegendItems(overlay);
  if (items.length === 0) {
    return { overlay, sidePanel: null };
  }
  return {
    overlay,
    sidePanel: measureAshbyLegendSidePanel(
      items,
      readAshbyLegendOverlayTitle(overlay),
      Math.max(120, maxHeight),
    ),
  };
}

/** Рисует HTML-легенду на canvas по фактическому положению на экране. */
function drawLegendOverlayToContext(
  ctx: CanvasRenderingContext2D,
  overlay: HTMLElement,
  root: HTMLElement,
): void {
  const rootRect = root.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  const x = overlayRect.left - rootRect.left;
  const y = overlayRect.top - rootRect.top;
  const width = overlayRect.width;
  const height = overlayRect.height;
  if (width <= 0 || height <= 0) {
    return;
  }

  const styles = window.getComputedStyle(overlay);
  ctx.save();
  roundRectPath(ctx, x, y, width, height, 6);
  ctx.fillStyle = styles.backgroundColor || ASHBY_LEGEND_OVERLAY_BG;
  ctx.fill();
  ctx.strokeStyle = styles.borderColor || "#d8dce3";
  ctx.lineWidth = 1;
  ctx.stroke();

  const title = overlay.querySelector(
    ".ashby-legend-overlay-title",
  ) as HTMLElement | null;
  if (title) {
    const titleRect = title.getBoundingClientRect();
    const titleStyles = window.getComputedStyle(title);
    ctx.fillStyle = titleStyles.color || "#242930";
    ctx.font = `${titleStyles.fontWeight || 500} ${titleStyles.fontSize || "14px"} ${
      titleStyles.fontFamily || "system-ui, sans-serif"
    }`;
    ctx.textBaseline = "middle";
    ctx.fillText(
      title.textContent?.trim() ?? "",
      titleRect.left - rootRect.left,
      titleRect.top - rootRect.top + titleRect.height / 2,
    );
  }

  const empty = overlay.querySelector(
    ".ashby-legend-panel-empty",
  ) as HTMLElement | null;
  if (empty) {
    const emptyRect = empty.getBoundingClientRect();
    const emptyStyles = window.getComputedStyle(empty);
    const emptyPadLeft = parseFloat(emptyStyles.paddingLeft) || 0;
    ctx.fillStyle = emptyStyles.color || "#5C6570";
    ctx.font = `${emptyStyles.fontWeight || 400} ${emptyStyles.fontSize || "14px"} ${
      emptyStyles.fontFamily || "system-ui, sans-serif"
    }`;
    ctx.textBaseline = "middle";
    ctx.fillText(
      empty.textContent?.trim() ?? "",
      emptyRect.left - rootRect.left + emptyPadLeft,
      emptyRect.top - rootRect.top + emptyRect.height / 2,
    );
    ctx.restore();
    return;
  }

  const items = overlay.querySelectorAll(".ashby-legend-item");
  items.forEach((item) => {
    const itemEl = item as HTMLElement;
    const itemRect = itemEl.getBoundingClientRect();
    const markerSvg = itemEl.querySelector("svg");
    const label = itemEl.querySelector(
      ".ashby-legend-label",
    ) as HTMLElement | null;

    if (markerSvg) {
      const markerRect = markerSvg.getBoundingClientRect();
      const mx = markerRect.left - rootRect.left;
      const my = markerRect.top - rootRect.top;
      const mw = markerRect.width;
      const mh = markerRect.height;
      const circle = markerSvg.querySelector("circle");
      const rect = markerSvg.querySelector("rect");
      const line = markerSvg.querySelector("line");
      const color =
        circle?.getAttribute("fill") ||
        rect?.getAttribute("fill") ||
        line?.getAttribute("stroke") ||
        "#3D5A80";

      if (rect) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(mx, my + 1, mw, Math.max(8, mh - 2));
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(mx, my + 1, mw, Math.max(8, mh - 2));
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        const dash = line?.getAttribute("stroke-dasharray");
        if (dash) {
          ctx.setLineDash(
            dash
              .split(/[\s,]+/)
              .map(Number)
              .filter((n) => Number.isFinite(n)),
          );
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(mx + 1, my + mh / 2);
        ctx.lineTo(mx + mw - 1, my + mh / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(mx + mw / 2, my + mh / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (label) {
      const labelRect = label.getBoundingClientRect();
      const labelStyles = window.getComputedStyle(label);
      // padding-left на экране отодвигает глифы; getBoundingClientRect — край бокса.
      const labelPadLeft = parseFloat(labelStyles.paddingLeft) || 0;
      ctx.fillStyle = labelStyles.color || "#242930";
      ctx.font = `${labelStyles.fontWeight || 400} ${labelStyles.fontSize || "13px"} ${
        labelStyles.fontFamily || "system-ui, sans-serif"
      }`;
      ctx.textBaseline = "middle";
      ctx.fillText(
        label.textContent?.trim() ?? "",
        labelRect.left - rootRect.left + labelPadLeft,
        itemRect.top - rootRect.top + itemRect.height / 2,
      );
    }
  });

  ctx.restore();
}

async function drawSvgToContext(
  ctx: CanvasRenderingContext2D,
  svg: SVGSVGElement,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("width")) {
    clone.setAttribute("width", String(width));
  }
  if (!clone.getAttribute("height")) {
    clone.setAttribute("height", String(height));
  }
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadHtmlImage(url);
    ctx.drawImage(img, offsetX, offsetY, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Экспорт поля графика (SVG + легенда) в PNG. */
async function exportAshbyChartPng(root: HTMLElement): Promise<void> {
  const svg = root.querySelector("svg");
  if (!svg) {
    return;
  }

  const chartW = root.clientWidth;
  const chartH = root.clientHeight;
  if (chartW <= 0 || chartH <= 0) {
    return;
  }

  const { overlay, sidePanel } = resolveAshbyExportLegend(root, chartH);
  const sideGap = sidePanel ? ASHBY_EXPORT_LEGEND_SIDE_GAP : 0;
  const width = chartW + sideGap + (sidePanel?.width ?? 0);
  const height = chartH;

  const scale = Math.min(2, window.devicePixelRatio || 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const rootRect = root.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  await drawSvgToContext(
    ctx,
    svg,
    svgRect.left - rootRect.left,
    svgRect.top - rootRect.top,
    svgRect.width,
    svgRect.height,
  );

  if (sidePanel) {
    drawLegendSidePanelToContext(ctx, sidePanel, chartW + sideGap, 0);
  } else if (overlay) {
    drawLegendOverlayToContext(ctx, overlay, root);
  }

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Не удалось создать PNG"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ashby-diagram.png";
      link.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

/** Экспорт SVG графика вместе с легендой (как на экране). */
function exportAshbyChartSvg(root: HTMLElement): void {
  const svg =
    (root.querySelector(
      ".ashby-chart-layer svg.recharts-surface",
    ) as SVGSVGElement | null) ||
    (root.querySelector(".ashby-chart-layer svg") as SVGSVGElement | null);
  if (!svg) {
    return;
  }

  const svgRect = svg.getBoundingClientRect();
  const displayW = svgRect.width;
  const displayH = svgRect.height;
  if (displayW <= 0 || displayH <= 0) {
    return;
  }

  const vbAttr = svg.getAttribute("viewBox");
  let vbX = 0;
  let vbY = 0;
  let vbW = displayW;
  let vbH = displayH;
  if (vbAttr) {
    const parts = vbAttr
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      parts.length === 4 &&
      parts.every((n) => Number.isFinite(n)) &&
      parts[2] > 0 &&
      parts[3] > 0
    ) {
      vbX = parts[0];
      vbY = parts[1];
      vbW = parts[2];
      vbH = parts[3];
    }
  }
  const scaleX = vbW / displayW;
  const scaleY = vbH / displayH;

  const { overlay, sidePanel } = resolveAshbyExportLegend(root, displayH);

  const ns = "http://www.w3.org/2000/svg";
  const rootSvg = document.createElementNS(ns, "svg");
  rootSvg.setAttribute("xmlns", ns);
  rootSvg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
  rootSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const contentGroup = document.createElementNS(ns, "g");
  contentGroup.setAttribute("class", "ashby-export-content");

  // Переносим содержимое графика (не сам вложенный <svg>).
  const clone = svg.cloneNode(true) as SVGSVGElement;
  while (clone.firstChild) {
    contentGroup.appendChild(clone.firstChild);
  }

  // Убираем невидимые full-size слои Recharts, раздувающие getBBox.
  contentGroup
    .querySelectorAll(
      ".recharts-tooltip-cursor, .recharts-cursor, .recharts-brush",
    )
    .forEach((el) => el.remove());
  contentGroup.querySelectorAll("rect").forEach((rect) => {
    const fill = (rect.getAttribute("fill") || "").toLowerCase();
    const opacity = Number(rect.getAttribute("fill-opacity") ?? "1");
    const widthAttr = rect.getAttribute("width") || "";
    const heightAttr = rect.getAttribute("height") || "";
    const isTransparent =
      fill === "none" ||
      fill === "transparent" ||
      fill === "rgba(0, 0, 0, 0)" ||
      opacity === 0;
    const isFullBleed =
      widthAttr === "100%" ||
      heightAttr === "100%" ||
      Number(widthAttr) >= vbW * 0.95 ||
      Number(heightAttr) >= vbH * 0.95;
    if (isTransparent && isFullBleed) {
      rect.remove();
    }
  });

  // Короткая легенда без скролла — поверх графика, как на экране.
  if (overlay && !sidePanel) {
    appendLegendSvgGroupRelativeToSvg(
      contentGroup,
      overlay,
      svgRect,
      scaleX,
      scaleY,
      vbX,
      vbY,
    );
  }

  rootSvg.appendChild(contentGroup);

  // Измеряем реальные границы рисунка и нормализуем viewBox к (0,0).
  rootSvg.style.position = "fixed";
  rootSvg.style.left = "-10000px";
  rootSvg.style.top = "0";
  rootSvg.style.visibility = "hidden";
  rootSvg.style.pointerEvents = "none";
  document.body.appendChild(rootSvg);

  let finalVbX = vbX;
  let finalVbY = vbY;
  let finalVbW = vbW;
  let finalVbH = vbH;
  try {
    const bbox = contentGroup.getBBox();
    if (bbox.width > 0 && bbox.height > 0) {
      const pad = 8;
      if (sidePanel) {
        const gapSvg = ASHBY_EXPORT_LEGEND_SIDE_GAP * scaleX;
        const panelX = bbox.x + bbox.width + gapSvg;
        const panelY = bbox.y;
        const panelSize = appendLegendSidePanelSvg(
          contentGroup,
          sidePanel,
          panelX,
          panelY,
          scaleX,
          scaleY,
        );
        finalVbX = Math.min(bbox.x, panelX) - pad;
        finalVbY = Math.min(bbox.y, panelY) - pad;
        finalVbW =
          Math.max(bbox.x + bbox.width, panelX + panelSize.width) -
          finalVbX +
          pad;
        finalVbH =
          Math.max(bbox.y + bbox.height, panelY + panelSize.height) -
          finalVbY +
          pad;
      } else {
        finalVbX = bbox.x - pad;
        finalVbY = bbox.y - pad;
        finalVbW = bbox.width + pad * 2;
        finalVbH = bbox.height + pad * 2;
      }
    }
  } catch {
    // оставляем исходный viewBox
  } finally {
    rootSvg.style.position = "";
    rootSvg.style.left = "";
    rootSvg.style.top = "";
    rootSvg.style.visibility = "";
    rootSvg.style.pointerEvents = "";
    document.body.removeChild(rootSvg);
  }

  // Сдвигаем контент в начало координат — viewBox всегда 0 0 W H.
  contentGroup.setAttribute(
    "transform",
    `translate(${-finalVbX}, ${-finalVbY})`,
  );

  const background = svgEl("rect", {
    x: 0,
    y: 0,
    width: finalVbW,
    height: finalVbH,
    fill: "#ffffff",
  });
  rootSvg.insertBefore(background, contentGroup);

  // Без width/height в px: иначе браузер рисует график в углу окна
  // (как 1425×556 на большом экране) и оставляет пустоту справа/снизу.
  rootSvg.removeAttribute("width");
  rootSvg.removeAttribute("height");
  rootSvg.removeAttribute("style");
  rootSvg.setAttribute("viewBox", `0 0 ${finalVbW} ${finalVbH}`);
  rootSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // При открытии .svg как документа Chrome/Edge не всегда растягивают
  // «голый» viewBox на весь viewport — фиксируем через CSS на корне.
  const screenStyle = document.createElementNS(ns, "style");
  screenStyle.textContent =
    "@media screen{" +
    "svg{position:fixed;inset:0;width:100%;height:100%;" +
    "background:#fff}" +
    "}";
  rootSvg.insertBefore(screenStyle, rootSvg.firstChild);

  const serialized = new XMLSerializer().serializeToString(rootSvg);
  const source =
    `<?xml version="1.0" encoding="UTF-8"?>\n` + serialized;
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ashby-diagram.svg";
  link.click();
  URL.revokeObjectURL(url);
}

function svgEl(
  name: string,
  attrs: Record<string, string | number>,
): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function screenToSvgX(
  screenX: number,
  svgRect: DOMRect,
  scaleX: number,
  vbX: number,
): number {
  return vbX + (screenX - svgRect.left) * scaleX;
}

function screenToSvgY(
  screenY: number,
  svgRect: DOMRect,
  scaleY: number,
  vbY: number,
): number {
  return vbY + (screenY - svgRect.top) * scaleY;
}

/** Легенда в координатах SVG графика (1:1 с тем, что на экране). */
function appendLegendSvgGroupRelativeToSvg(
  parent: SVGElement,
  overlay: HTMLElement,
  svgRect: DOMRect,
  scaleX: number,
  scaleY: number,
  vbX: number,
  vbY: number,
): void {
  const overlayRect = overlay.getBoundingClientRect();
  const x = screenToSvgX(overlayRect.left, svgRect, scaleX, vbX);
  const y = screenToSvgY(overlayRect.top, svgRect, scaleY, vbY);
  const width = overlayRect.width * scaleX;
  const height = overlayRect.height * scaleY;
  if (width <= 0 || height <= 0) {
    return;
  }

  const group = svgEl("g", { class: "ashby-legend-export" });
  const styles = window.getComputedStyle(overlay);
  const bg = styles.backgroundColor || ASHBY_LEGEND_OVERLAY_BG;
  const border = styles.borderColor || "#d8dce3";

  group.appendChild(
    svgEl("rect", {
      x,
      y,
      width,
      height,
      rx: 6 * scaleX,
      ry: 6 * scaleY,
      fill: bg,
      stroke: border,
      "stroke-width": 1 * scaleX,
    }),
  );

  const title = overlay.querySelector(
    ".ashby-legend-overlay-title",
  ) as HTMLElement | null;
  if (title) {
    const titleRect = title.getBoundingClientRect();
    const titleStyles = window.getComputedStyle(title);
    const fontSize = (parseFloat(titleStyles.fontSize) || 14) * scaleY;
    const text = svgEl("text", {
      x: screenToSvgX(titleRect.left, svgRect, scaleX, vbX),
      y: screenToSvgY(
        titleRect.top + titleRect.height / 2,
        svgRect,
        scaleY,
        vbY,
      ),
      fill: titleStyles.color || "#242930",
      "font-size": fontSize,
      "font-weight": titleStyles.fontWeight || "500",
      "font-family":
        titleStyles.fontFamily || "system-ui, -apple-system, sans-serif",
      "dominant-baseline": "middle",
    });
    text.textContent = title.textContent?.trim() ?? "";
    group.appendChild(text);
  }

  const empty = overlay.querySelector(
    ".ashby-legend-panel-empty",
  ) as HTMLElement | null;
  if (empty) {
    const emptyRect = empty.getBoundingClientRect();
    const emptyStyles = window.getComputedStyle(empty);
    const emptyPadLeft = parseFloat(emptyStyles.paddingLeft) || 0;
    const fontSize = (parseFloat(emptyStyles.fontSize) || 14) * scaleY;
    const text = svgEl("text", {
      x: screenToSvgX(
        emptyRect.left + emptyPadLeft,
        svgRect,
        scaleX,
        vbX,
      ),
      y: screenToSvgY(
        emptyRect.top + emptyRect.height / 2,
        svgRect,
        scaleY,
        vbY,
      ),
      fill: emptyStyles.color || "#5C6570",
      "font-size": fontSize,
      "font-family":
        emptyStyles.fontFamily || "system-ui, -apple-system, sans-serif",
      "dominant-baseline": "middle",
    });
    text.textContent = empty.textContent?.trim() ?? "";
    group.appendChild(text);
    parent.appendChild(group);
    return;
  }

  overlay.querySelectorAll(".ashby-legend-item").forEach((item) => {
    const itemEl = item as HTMLElement;
    const itemRect = itemEl.getBoundingClientRect();
    const markerSvg = itemEl.querySelector("svg");
    const label = itemEl.querySelector(
      ".ashby-legend-label",
    ) as HTMLElement | null;

    if (markerSvg) {
      const markerRect = markerSvg.getBoundingClientRect();
      const mx = screenToSvgX(markerRect.left, svgRect, scaleX, vbX);
      const my = screenToSvgY(markerRect.top, svgRect, scaleY, vbY);
      const mw = markerRect.width * scaleX;
      const mh = markerRect.height * scaleY;
      const circle = markerSvg.querySelector("circle");
      const rect = markerSvg.querySelector("rect");
      const line = markerSvg.querySelector("line");
      const color =
        circle?.getAttribute("fill") ||
        rect?.getAttribute("fill") ||
        line?.getAttribute("stroke") ||
        "#3D5A80";

      if (rect) {
        group.appendChild(
          svgEl("rect", {
            x: mx,
            y: my + scaleY,
            width: mw,
            height: Math.max(8 * scaleY, mh - 2 * scaleY),
            rx: 2 * scaleX,
            fill: color,
            "fill-opacity": 0.45,
            stroke: color,
            "stroke-opacity": 0.85,
            "stroke-width": 1 * scaleX,
          }),
        );
      } else {
        group.appendChild(
          svgEl("line", {
            x1: mx + scaleX,
            y1: my + mh / 2,
            x2: mx + mw - scaleX,
            y2: my + mh / 2,
            stroke: color,
            "stroke-width": 2 * scaleX,
            "stroke-linecap": "round",
            ...(line?.getAttribute("stroke-dasharray")
              ? {
                  "stroke-dasharray": line.getAttribute("stroke-dasharray")!,
                }
              : {}),
          }),
        );
        group.appendChild(
          svgEl("circle", {
            cx: mx + mw / 2,
            cy: my + mh / 2,
            r: 4 * scaleX,
            fill: color,
            stroke: color,
          }),
        );
      }
    }

    if (label) {
      const labelRect = label.getBoundingClientRect();
      const labelStyles = window.getComputedStyle(label);
      // Как на экране: padding-left (0.25cm) между маркером и текстом.
      const labelPadLeft = parseFloat(labelStyles.paddingLeft) || 0;
      const fontSize = (parseFloat(labelStyles.fontSize) || 13) * scaleY;
      const text = svgEl("text", {
        x: screenToSvgX(
          labelRect.left + labelPadLeft,
          svgRect,
          scaleX,
          vbX,
        ),
        y: screenToSvgY(
          itemRect.top + itemRect.height / 2,
          svgRect,
          scaleY,
          vbY,
        ),
        fill: labelStyles.color || "#242930",
        "font-size": fontSize,
        "font-family":
          labelStyles.fontFamily || "system-ui, -apple-system, sans-serif",
        "dominant-baseline": "middle",
      });
      text.textContent = label.textContent?.trim() ?? "";
      group.appendChild(text);
    }
  });

  parent.appendChild(group);
}

type AshbySaveFormat = "png" | "svg";

function AshbySaveMenuItem({
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
        margin: 0,
        padding: "8px 12px",
        border: "none",
        borderRadius: 6,
        background: hovered ? "#E8EEF4" : "transparent",
        textAlign: "left",
        fontSize: 13,
        color: hovered ? "#3D5A80" : "#242930",
        cursor: "pointer",
        boxSizing: "border-box",
        transition: "background-color 0.12s ease, color 0.12s ease",
      }}
    >
      {label}
    </button>
  );
}

function axisCaption(label: string, unit: string): string {
  return unit ? `${label} [${unit}]` : label;
}

/** Строка оси в подсказке: «T = 550 °C» (значение — целое, как на плашке). */
function formatAshbyAxisReadout(
  axis: Pick<AshbyAxisMeta, "symbol" | "key" | "unit" | "label"> | null | undefined,
  value: number,
): string {
  const symbol =
    (axis?.symbol || "").trim() ||
    (axis?.key || "").trim() ||
    (axis?.label || "").trim() ||
    "?";
  // Не показываем служебные ключи осей «x»/«y» как символ.
  const safeSymbol =
    symbol.toLowerCase() === "x" || symbol.toLowerCase() === "y" ? "?" : symbol;
  const valueLabel = Number.isFinite(value) ? String(Math.round(value)) : "";
  const unit = (axis?.unit || "").trim();
  return unit
    ? `${safeSymbol} = ${valueLabel} ${unit}`
    : `${safeSymbol} = ${valueLabel}`;
}

function collectAshbyMaterialsAtPoint(
  seriesList: ReadonlyArray<{
    label: string;
    color: string;
    points: Array<{ x: number; y: number }>;
  }>,
  x: number,
  y: number,
): Array<{ label: string; color: string }> {
  const found: Array<{ label: string; color: string }> = [];
  const seen = new Set<string>();
  for (const series of seriesList) {
    const hit = series.points.some(
      (point) => point.x === x && point.y === y,
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

function axisCaptionFromOption(
  option: AshbyAxisOption | undefined,
  fallback: string,
): string {
  if (!option) {
    return fallback;
  }
  const name =
    option.label.replace(/\s*\([^)]*\)\s*$/, "").trim() || option.label;
  return axisCaption(name, option.unit);
}

/** Символ оси: из API, иначе из подписи «Имя (T)» в options. */
function resolveAshbyAxisMeta(
  axis: AshbyAxisMeta | null | undefined,
  option: AshbyAxisOption | undefined,
): AshbyAxisMeta | null {
  if (!axis && !option) {
    return null;
  }
  const fromLabel = option?.label.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? "";
  const symbol =
    (axis?.symbol || "").trim() ||
    fromLabel ||
    (option?.key || "").trim() ||
    (axis?.key || "").trim();
  return {
    key: axis?.key || option?.key || "",
    label: axis?.label || option?.label || "",
    symbol,
    unit: (axis?.unit || option?.unit || "").trim(),
  };
}

/**
 * Предпочитает целые подписи, но при сильном зуме оставляет 1-2 знака после запятой.
 */
function formatAdaptiveTickLabel(value: number, step: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  if (!Number.isFinite(step) || step >= 1) {
    return String(Math.round(value));
  }
  const digits = step >= 0.1 ? 1 : 2;
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** Оценка ширины полосы тиков Y по фактическим подписям. */
function estimateYAxisWidth(ticks: number[], step: number): number {
  const labels = ticks.map((tick) => formatAdaptiveTickLabel(tick, step));
  let maxPx = 0;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
      for (const label of labels) {
        maxPx = Math.max(maxPx, ctx.measureText(label).width);
      }
    }
  }
  if (maxPx <= 0) {
    const maxLen = Math.max(1, ...labels.map((label) => label.length), 1);
    maxPx = maxLen * 7.2;
  }
  // Запас под padding тиков Recharts.
  return Math.max(ASHBY_Y_AXIS_WIDTH_MIN, Math.ceil(maxPx + 16));
}

type AxisDomain = {
  x: NiceAxisResult;
  y: NiceAxisResult;
};

const EMPTY_AXES: AshbyAxisOption[] = [];
const EMPTY_CLASSES: string[] = [];

type ChartToolMode = "none" | "pan" | "zoom";

function zoomDomain(axis: NiceAxisResult, factor: number): NiceAxisResult {
  const [min, max] = axis.domain;
  const mid = (min + max) / 2;
  const half = ((max - min) / 2) * factor;
  return {
    domain: [mid - half, mid + half],
    ticks: axis.ticks,
    step: axis.step,
  };
}

/** Масштаб вокруг точки pivot (в единицах оси). factor < 1 — приблизить. */
function zoomDomainAt(
  axis: NiceAxisResult,
  factor: number,
  pivot: number,
): NiceAxisResult {
  const [min, max] = axis.domain;
  return {
    domain: [pivot + (min - pivot) * factor, pivot + (max - pivot) * factor],
    ticks: axis.ticks,
    step: axis.step,
  };
}

/** Непрерывный фактор зума по deltaY (учитывает тачпад и мышь). */
function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  let dy = deltaY;
  if (deltaMode === 1) {
    dy *= 16;
  } else if (deltaMode === 2) {
    dy *= 400;
  }
  const clamped = Math.max(-160, Math.min(160, dy));
  return Math.exp(clamped * 0.0016);
}

function shiftDomain(axis: NiceAxisResult, delta: number): NiceAxisResult {
  const [min, max] = axis.domain;
  return {
    domain: [min + delta, max + delta],
    ticks: axis.ticks,
    step: axis.step,
  };
}

function domainsEqual(a: AxisDomain, b: AxisDomain): boolean {
  return (
    a.x.domain[0] === b.x.domain[0] &&
    a.x.domain[1] === b.x.domain[1] &&
    a.y.domain[0] === b.y.domain[0] &&
    a.y.domain[1] === b.y.domain[1]
  );
}

function emptyDomain(): AxisDomain {
  const axis = computeNiceAxisFromValues([0, 1]);
  const fallback: NiceAxisResult = {
    domain: [0, 1],
    ticks: [0, 0.5, 1],
    step: 0.5,
  };
  return { x: axis ?? fallback, y: axis ?? fallback };
}

function buildBaseDomain(data: AshbyResponse): AxisDomain | null {
  const xs = data.series.flatMap((series) =>
    series.points.map((p) => p.x),
  );
  const ys = data.series.flatMap((series) =>
    series.points.map((p) => p.y),
  );
  if (xs.length === 0 || ys.length === 0) {
    return null;
  }
  // Отступ внутри поля графика: оставляем небольшой запас у границ (~0.5 см).
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xSpan = Math.max(xMax - xMin, Math.abs(xMin) * 0.1 || 1);
  const ySpan = Math.max(yMax - yMin, Math.abs(yMin) * 0.1 || 1);
  const xPad = xSpan * ASHBY_EDGE_PADDING_RATIO;
  const yPad = ySpan * ASHBY_EDGE_PADDING_RATIO;

  const x = computeTicksForFixedDomain(
    xMin - xPad,
    xMax + xPad,
    { targetTickCount: 8 },
  );
  const y = computeTicksForFixedDomain(
    yMin - yPad,
    yMax + yPad,
    { targetTickCount: 8 },
  );
  if (!x || !y) {
    return null;
  }
  return { x, y };
}

/**
 * Заголовок по центру поля между осями X и Y.
 * SVG <text textAnchor="middle"> — без foreignObject (там CSS часто не действует → текст «липнет» к оси Y).
 */
function AshbyChartTitle({ title }: { title: string }) {
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
      className="ashby-chart-svg-title"
      fill="currentColor"
      fontSize={15}
      fontWeight={600}
    >
      {title}
    </text>
  );
}

/**
 * Пунктирные мини-секции посередине между основными тиками
 * (как на вкладке «Сравнение материалов (свойства)» / desktop _add_minor_gridlines).
 */
function AshbyMinorGridlines({
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
    <g className="ashby-minor-grid" pointerEvents="none">
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
            key={`ashby-x-mid-${value}`}
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
            key={`ashby-y-mid-${value}`}
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
 * Подписи осей: Y сдвигается вместе с фактической шириной полосы тиков.
 */
function AshbyAxisLabels({
  xLabel,
  yLabel,
  yAxisWidth,
}: {
  xLabel: string;
  yLabel: string;
  yAxisWidth: number;
}) {
  const plotArea = usePlotArea();
  if (!plotArea) {
    return null;
  }

  const xTextX = plotArea.x + plotArea.width / 2;
  const xTextY = plotArea.y + plotArea.height + ASHBY_AXIS_TITLE_GAP;
  const yTextX = plotArea.x - yAxisWidth - ASHBY_Y_LABEL_OUTSIDE_GAP;
  const yTextY = plotArea.y + plotArea.height / 2;

  return (
    <g className="ashby-axis-labels" pointerEvents="none">
      {xLabel ? (
        <text
          x={xTextX}
          y={xTextY}
          textAnchor="middle"
          dominantBaseline="text-after-edge"
          className="ashby-axis-label"
          fill="currentColor"
          fontSize={14}
        >
          {formatScientificPlain(xLabel)}
        </text>
      ) : null}
      {yLabel ? (
        <text
          x={yTextX}
          y={yTextY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="ashby-axis-label"
          fill="currentColor"
          fontSize={14}
          transform={`rotate(-90, ${yTextX}, ${yTextY})`}
        >
          {formatScientificPlain(yLabel)}
        </text>
      ) : null}
    </g>
  );
}

/** Hull для Recharts 3: scale через hooks (паритет fill alpha=0.15). */
const HullPolygons = memo(function HullPolygons({
  hulls,
}: {
  hulls: AshbyHull[];
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plotArea = usePlotArea();
  const reactId = useId().replace(/:/g, "");
  const clipId = `ashby-hull-clip-${reactId}`;

  if (!xScale || !yScale || !plotArea || hulls.length === 0) {
    return null;
  }

  return (
    <g className="ashby-hulls">
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
      <g clipPath={`url(#${clipId})`}>
        {hulls.map((hull) => {
          const coords = hull.points
            .map((point) => {
              const px = xScale(point.x);
              const py = yScale(point.y);
              if (px == null || py == null) {
                return null;
              }
              return `${px},${py}`;
            })
            .filter((value): value is string => value != null);
          if (coords.length < 3) {
            return null;
          }
          return (
            <polygon
              key={hull.class_name}
              points={coords.join(" ")}
              fill={hull.color}
              fillOpacity={0.15}
              stroke="none"
            />
          );
        })}
      </g>
    </g>
  );
});

const ASHBY_SECTION_LABEL_STYLE: CSSProperties = {
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 1.4,
  color: "#242930",
};

const ASHBY_LABELFRAME_STYLE: CSSProperties = {
  position: "relative",
  border: "1px solid #d8dce3",
  borderRadius: 6,
  backgroundColor: "#fff",
  overflow: "visible",
};

const ASHBY_LABELFRAME_TITLE_STYLE: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 10,
  zIndex: 2,
  transform: "translateY(-50%)",
  padding: "0 6px",
  margin: 0,
  backgroundColor: "#fff",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  ...ASHBY_SECTION_LABEL_STYLE,
};

/** Плашка «Выберите классы»: как .ashby-labelframe + рост по высоте. */
const ASHBY_CLASS_LABELFRAME_STYLE: CSSProperties = {
  ...ASHBY_LABELFRAME_STYLE,
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  minHeight: 200,
  width: "100%",
  padding: "14px 10px 10px",
  boxSizing: "border-box",
};

/** Список классов — те же отступы, что у .ashby-listbox. */
const ASHBY_CLASS_LIST_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "0.1cm",
  listStyle: "none",
  margin: "4px 0 0",
  padding: "4px 4px 8px 4px",
  flex: "1 1 auto",
  minHeight: 110,
  maxHeight: 280,
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "auto",
};

const ASHBY_CLASS_ROW_STYLE: CSSProperties = {
  display: "block",
  listStyle: "none",
  margin: 0,
  padding: 0,
  width: "100%",
  boxSizing: "border-box",
};

const ASHBY_CLASS_ROW_LABEL_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minWidth: 0,
  margin: 0,
  padding: "6px 8px",
  borderRadius: 4,
  cursor: "pointer",
  boxSizing: "border-box",
};

/** Пустая легенда: без маркера, текст на месте подписи элемента (28px + 0.25cm). */
const ASHBY_LEGEND_EMPTY_STYLE: CSSProperties = {
  display: "block",
  listStyle: "none",
  margin: 0,
  padding: 0,
  paddingLeft: "calc(28px + 0.25cm)",
  fontSize: 14,
  lineHeight: 1.4,
  color: "#5C6570",
  boxSizing: "border-box",
};

const ASHBY_LEGEND_ITEM_STYLE: CSSProperties = {
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

type AshbyLegendItem = {
  id: string;
  value: string;
  color: string;
  kind: "series" | "class";
  /** Штрих линии при совпадении координат с другой серией. */
  strokeDasharray?: string;
};

/** Паттерны штриха для серий с одинаковыми точками (первая — сплошная). */
const ASHBY_OVERLAP_DASHES = ["", "8 4", "2 3", "10 3 2 3", "1 2 6 2"] as const;

function ashbyPointsSignature(
  points: Array<{ x: number; y: number }>,
): string {
  return points
    .map((point) => `${point.x.toFixed(6)}:${point.y.toFixed(6)}`)
    .join("|");
}

/** Индекс совпадения внутри группы одинаковых кривых → dasharray. */
function buildAshbyOverlapDashBySeriesId(
  seriesList: Array<{ id: string; points: Array<{ x: number; y: number }> }>,
): Map<string, string | undefined> {
  const groups = new Map<string, string[]>();
  for (const series of seriesList) {
    if (series.points.length === 0) {
      continue;
    }
    const key = ashbyPointsSignature(series.points);
    const ids = groups.get(key);
    if (ids) {
      ids.push(series.id);
    } else {
      groups.set(key, [series.id]);
    }
  }
  const result = new Map<string, string | undefined>();
  for (const ids of groups.values()) {
    ids.forEach((id, index) => {
      result.set(
        id,
        ASHBY_OVERLAP_DASHES[index % ASHBY_OVERLAP_DASHES.length] || undefined,
      );
    });
  }
  return result;
}

type AshbyLegendPlacement = { top: number; left: number };

type AshbyPlotPoint = { x: number; y: number };

type AshbyLegendRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type AshbyLegendGeometry = {
  points: AshbyPlotPoint[];
  segments: Array<[AshbyPlotPoint, AshbyPlotPoint]>;
};

/** Шаг сетки кандидатов позиции легенды (чем меньше — тем точнее поиск «дыры»). */
const ASHBY_LEGEND_GRID_COLS = 7;
const ASHBY_LEGEND_GRID_ROWS = 7;

function legendRectContainsPoint(rect: AshbyLegendRect, point: AshbyPlotPoint): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

function orientation(
  a: AshbyPlotPoint,
  b: AshbyPlotPoint,
  c: AshbyPlotPoint,
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: AshbyPlotPoint, b: AshbyPlotPoint, c: AshbyPlotPoint): boolean {
  return (
    Math.min(a.x, b.x) <= c.x &&
    c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y &&
    c.y <= Math.max(a.y, b.y)
  );
}

function segmentsIntersect(
  a: AshbyPlotPoint,
  b: AshbyPlotPoint,
  c: AshbyPlotPoint,
  d: AshbyPlotPoint,
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 === 0 && onSegment(a, b, c)) {
    return true;
  }
  if (o2 === 0 && onSegment(a, b, d)) {
    return true;
  }
  if (o3 === 0 && onSegment(c, d, a)) {
    return true;
  }
  if (o4 === 0 && onSegment(c, d, b)) {
    return true;
  }
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** Пересекает ли отрезок прямоугольник легенды (как matplotlib line.intersects_bbox). */
function segmentIntersectsLegendRect(
  a: AshbyPlotPoint,
  b: AshbyPlotPoint,
  rect: AshbyLegendRect,
): boolean {
  if (legendRectContainsPoint(rect, a) || legendRectContainsPoint(rect, b)) {
    return true;
  }
  const left = rect.left;
  const right = rect.left + rect.width;
  const top = rect.top;
  const bottom = rect.top + rect.height;
  const corners: AshbyPlotPoint[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  const edges: Array<[AshbyPlotPoint, AshbyPlotPoint]> = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  return edges.some(([c, d]) => segmentsIntersect(a, b, c, d));
}

/** Прореживает/досэмплирует полилинию, чтобы ловить пересечения посередине сегментов. */
function samplePolylinePoints(
  points: AshbyPlotPoint[],
  stepPx = 16,
): { points: AshbyPlotPoint[]; segments: Array<[AshbyPlotPoint, AshbyPlotPoint]> } {
  const sampled: AshbyPlotPoint[] = [];
  const segments: Array<[AshbyPlotPoint, AshbyPlotPoint]> = [];
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

function clampLegendRectToPlotArea(
  rect: AshbyLegendRect,
  plotArea: { x: number; y: number; width: number; height: number },
  pad: number,
): AshbyLegendRect {
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

function countLegendOverlapBadness(
  rect: AshbyLegendRect,
  geometry: AshbyLegendGeometry,
): number {
  let badness = 0;
  for (const point of geometry.points) {
    if (legendRectContainsPoint(rect, point)) {
      badness += 1;
    }
  }
  for (const [a, b] of geometry.segments) {
    if (segmentIntersectsLegendRect(a, b, rect)) {
      // Пересечение линии важнее одиночной точки.
      badness += 8;
    }
  }
  return badness;
}

function buildLegendCandidateGrid(
  plotArea: { x: number; y: number; width: number; height: number },
  legendSize: { width: number; height: number },
  pad: number,
): AshbyLegendPlacement[] {
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

  const candidates: AshbyLegendPlacement[] = [];
  const cols = ASHBY_LEGEND_GRID_COLS;
  const rows = ASHBY_LEGEND_GRID_ROWS;

  const colSpan = Math.max(cols - 1, 1);
  const rowSpan = Math.max(rows - 1, 1);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const left = minLeft + ((maxLeft - minLeft) * col) / colSpan;
      const top = minTop + ((maxTop - minTop) * row) / rowSpan;
      candidates.push({ left, top });
    }
  }
  return candidates;
}

/**
 * Ищет по всей области графика позицию с минимумом касаний линий
 * (углы, края, центр — где угодно). При ничьей — ближе к правому верхнему углу.
 */
function findBestLegendPlacement(
  plotArea: { x: number; y: number; width: number; height: number },
  legendSize: { width: number; height: number },
  geometry: AshbyLegendGeometry,
  pad = ASHBY_LEGEND_PADDING,
): AshbyLegendPlacement {
  if (plotArea.width <= 0 || plotArea.height <= 0 || legendSize.width <= 0) {
    return { top: pad, left: pad };
  }

  const candidates = buildLegendCandidateGrid(plotArea, legendSize, pad);
  const preferLeft = plotArea.x + plotArea.width - legendSize.width - pad;
  const preferTop = plotArea.y + pad;

  const initialPlacement = clampLegendRectToPlotArea(
    {
      left: preferLeft,
      top: preferTop,
      width: legendSize.width,
      height: legendSize.height,
    },
    plotArea,
    pad,
  );
  let bestPlacement: AshbyLegendPlacement = {
    top: initialPlacement.top,
    left: initialPlacement.left,
  };
  let bestBadness = Infinity;
  let bestTie = Infinity;

  for (const candidate of candidates) {
    const rect: AshbyLegendRect = {
      left: candidate.left,
      top: candidate.top,
      width: legendSize.width,
      height: legendSize.height,
    };
    const badness = countLegendOverlapBadness(rect, geometry);
    const tie = Math.hypot(candidate.left - preferLeft, candidate.top - preferTop);
    if (badness < bestBadness || (badness === bestBadness && tie < bestTie)) {
      bestBadness = badness;
      bestTie = tie;
      bestPlacement = { top: candidate.top, left: candidate.left };
      // Нулевое пересечение у правого верхнего — дальше искать незачем.
      if (badness === 0 && tie < 1) {
        break;
      }
    }
  }

  return bestPlacement;
}

function buildLegendGeometry(
  data: AshbyResponse | null,
  xScale: (value: number) => number | undefined,
  yScale: (value: number) => number | undefined,
): AshbyLegendGeometry {
  const points: AshbyPlotPoint[] = [];
  const segments: Array<[AshbyPlotPoint, AshbyPlotPoint]> = [];

  for (const item of data?.series ?? []) {
    if (item.points.length === 0) {
      continue;
    }
    const seriesPx: AshbyPlotPoint[] = [];
    for (const point of item.points) {
      const px = xScale(point.x);
      const py = yScale(point.y);
      if (px != null && py != null) {
        seriesPx.push({ x: px, y: py });
      }
    }
    const sampled = samplePolylinePoints(seriesPx);
    points.push(...sampled.points);
    segments.push(...sampled.segments);
  }

  for (const hull of data?.hulls ?? []) {
    const hullPx: AshbyPlotPoint[] = [];
    for (const point of hull.points) {
      const px = xScale(point.x);
      const py = yScale(point.y);
      if (px != null && py != null) {
        hullPx.push({ x: px, y: py });
      }
    }
    if (hullPx.length >= 2) {
      const closed = hullPx.length >= 3 ? [...hullPx, hullPx[0]] : hullPx;
      const sampled = samplePolylinePoints(closed);
      points.push(...sampled.points);
      segments.push(...sampled.segments);
    }
  }

  return { points, segments };
}

function buildAshbyLegend(data: AshbyResponse | null): AshbyLegendItem[] {
  if (!data) {
    return [];
  }
  const plotted = data.series.filter((series) => series.points.length > 0);
  const overlapDash = buildAshbyOverlapDashBySeriesId(plotted);
  const items: AshbyLegendItem[] = [];
  for (const series of plotted) {
    items.push({
      id: `series:${series.id}`,
      value: series.label,
      color: series.color,
      kind: "series",
      strokeDasharray: overlapDash.get(series.id),
    });
  }
  const classItems =
    data.class_legend && data.class_legend.length > 0
      ? data.class_legend
      : data.hulls.map((hull) => ({
          class_name: hull.class_name,
          color: hull.color,
        }));
  for (const item of classItems) {
    if (!item.class_name?.trim()) {
      continue;
    }
    items.push({
      id: `class:${item.class_name}`,
      value: `Класс: ${item.class_name}`,
      color: item.color,
      kind: "class",
    });
  }
  return items;
}

/** Маркер серии: короткая линия + кружок. */
function AshbyLegendSeriesMarker({
  color,
  strokeDasharray,
}: {
  color: string;
  strokeDasharray?: string;
}) {
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
        strokeDasharray={strokeDasharray || undefined}
      />
      <circle cx={w / 2} cy={7} r={4} fill={stroke} stroke={stroke} strokeWidth={1} />
    </svg>
  );
}

/**
 * Маркер класса: прямоугольник цвета заливки области на графике
 * (как matplotlib.patches.Patch в десктопе).
 */
function AshbyLegendClassSwatch({ color }: { color: string }) {
  const fill = color || "#1f77b4";
  const w = 28;
  const h = 12;
  return (
    <svg
      className="ashby-legend-class-swatch"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      style={{
        width: w,
        minWidth: w,
        height: h,
        display: "block",
        flexShrink: 0,
      }}
    >
      <rect
        x={0.5}
        y={0.5}
        width={w - 1}
        height={h - 1}
        rx={2}
        fill={fill}
        fillOpacity={0.45}
        stroke={fill}
        strokeOpacity={0.85}
        strokeWidth={1}
      />
    </svg>
  );
}

/** Белая плашка у точки (материалы + Y/X). */
function AshbyPointTipPlaque({
  tip,
  xAxis,
  yAxis,
}: {
  tip: AshbyPointTip;
  xAxis: AshbyAxisMeta | null;
  yAxis: AshbyAxisMeta | null;
}) {
  return (
    <div
      className="ashby-point-tooltip"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transform: `translate(${tip.chartX + ASHBY_TOOLTIP_OFFSET}px, ${
          tip.chartY + ASHBY_TOOLTIP_OFFSET
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
        <ScientificText>{formatAshbyAxisReadout(yAxis, tip.y)}</ScientificText>
      </div>
      <div>
        <ScientificText>{formatAshbyAxisReadout(xAxis, tip.x)}</ScientificText>
      </div>
    </div>
  );
}

/**
 * Координаты у курсора без плашки (Y сверху, X снизу).
 * Обновляется через ref/DOM — без setState на каждый mousemove.
 */
function AshbyCursorCoordsLabel({
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
      className="ashby-cursor-coords"
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

/**
 * Держит актуальные plotArea/scale для перевода экранных координат в данные.
 * Пишет в ref на каждом рендере (без setState).
 */
function AshbyCursorScaleReporter({
  domain,
  bridgeRef,
}: {
  domain: AxisDomain;
  bridgeRef: RefObject<AshbyCursorScaleBridge | null>;
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

/** Высота «шапки» легенды (заголовок + внутренние отступы плашки). */
const ASHBY_LEGEND_CHROME_PX = 52;
/** Легенда не выше этой доли высоты поля графика. */
const ASHBY_LEGEND_MAX_CHART_RATIO = 0.55;

function AshbyLegendOverlay({
  items,
  placement,
  chartHeight,
  overlayRef,
}: {
  items: AshbyLegendItem[];
  placement: AshbyLegendPlacement | null;
  chartHeight: number;
  overlayRef: RefObject<HTMLDivElement | null>;
}) {
  const top = placement?.top ?? ASHBY_LEGEND_PADDING;
  const availableBelow = Math.max(
    120,
    chartHeight - top - ASHBY_LEGEND_PADDING,
  );
  const maxBoxHeight = Math.max(
    120,
    Math.min(
      availableBelow,
      Math.floor(chartHeight * ASHBY_LEGEND_MAX_CHART_RATIO),
    ),
  );
  const listMaxHeight = Math.max(72, maxBoxHeight - ASHBY_LEGEND_CHROME_PX);

  return (
    <div
      ref={overlayRef}
      className="ashby-legend-overlay"
      aria-label="Цвета элементов на графике"
      onWheel={(event) => {
        // Не зумить график, пока крутим список легенды.
        event.stopPropagation();
      }}
      style={{
        position: "absolute",
        ...(placement
          ? { top: placement.top, left: placement.left, right: "auto" }
          : {
              top: ASHBY_LEGEND_PADDING,
              right: ASHBY_LEGEND_PADDING,
              left: "auto",
            }),
        width: "max-content",
        maxWidth: "calc(100% - 24px)",
        maxHeight: maxBoxHeight,
        display: "flex",
        flexDirection: "column",
        padding: "10px 10px 8px",
        border: "1px solid #d8dce3",
        borderRadius: 6,
        backgroundColor: ASHBY_LEGEND_OVERLAY_BG,
        boxShadow: "0 2px 10px rgba(36, 41, 48, 0.12)",
        boxSizing: "border-box",
        overflow: "hidden",
        zIndex: 3,
        pointerEvents: items.length > 0 ? "auto" : "none",
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
          // Явный maxHeight — иначе flex+maxHeight родителя часто не даёт scroll.
          maxHeight: listMaxHeight,
          height: "auto",
          overflowX: "hidden",
          overflowY: "auto",
          flex: "0 1 auto",
          minHeight: 0,
          width: "max-content",
          maxWidth: "100%",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.length === 0 ? (
          <li
            className="ashby-legend-panel-empty"
            style={ASHBY_LEGEND_EMPTY_STYLE}
          >
            Постройте диаграмму — здесь появятся материалы и их цвета
          </li>
        ) : (
          items.map((item, index) => (
            <li
              key={item.id}
              className="ashby-legend-item"
              style={{
                ...ASHBY_LEGEND_ITEM_STYLE,
                marginBottom: index === items.length - 1 ? 0 : 6,
              }}
            >
              {item.kind === "class" ? (
                <AshbyLegendClassSwatch color={item.color} />
              ) : (
                <AshbyLegendSeriesMarker
                  color={item.color}
                  strokeDasharray={item.strokeDasharray}
                />
              )}
              <span
                className="ashby-legend-label"
                style={{
                  paddingLeft: "0.25cm",
                  boxSizing: "border-box",
                  whiteSpace: "nowrap",
                }}
              >
                {item.value}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Выбирает положение легенды внутри plotArea с минимальным перекрытием данных. */
function AshbyLegendPlacementReporter({
  data,
  domain,
  legendSize,
  toolMode,
  onPlacementChange,
}: {
  data: AshbyResponse | null;
  domain: AxisDomain;
  legendSize: { width: number; height: number };
  toolMode: ChartToolMode;
  onPlacementChange: (placement: AshbyLegendPlacement) => void;
}) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();

  useEffect(() => {
    if (!plotArea || !xScale || !yScale || legendSize.width <= 0 || legendSize.height <= 0) {
      return;
    }
    const delay =
      toolMode === "none"
        ? ASHBY_LEGEND_PLACE_DEBOUNCE_MS
        : ASHBY_LEGEND_PLACE_DEBOUNCE_MS * 2;
    const timer = window.setTimeout(() => {
      const geometry = buildLegendGeometry(
        data,
        (value) => xScale(value) ?? undefined,
        (value) => yScale(value) ?? undefined,
      );
      onPlacementChange(
        findBestLegendPlacement(plotArea, legendSize, geometry),
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    plotArea?.x,
    plotArea?.y,
    plotArea?.width,
    plotArea?.height,
    xScale,
    yScale,
    data,
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

function AshbyChart({
  data,
  domain,
  xLabel,
  yLabel,
  xAxis,
  yAxis,
  title,
  legendItems,
  toolMode,
  interactionEnabled,
  onDomainPreview,
  onDomainCommit,
}: {
  data: AshbyResponse | null;
  domain: AxisDomain;
  xLabel: string;
  yLabel: string;
  xAxis: AshbyAxisMeta | null;
  yAxis: AshbyAxisMeta | null;
  title: string;
  legendItems: AshbyLegendItem[];
  toolMode: ChartToolMode;
  interactionEnabled: boolean;
  onDomainPreview: (next: AxisDomain) => void;
  onDomainCommit: (next: AxisDomain) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const legendOverlayRef = useRef<HTMLDivElement>(null);
  const cursorScaleBridgeRef = useRef<AshbyCursorScaleBridge | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const cursorLabelRef = useRef<HTMLDivElement | null>(null);
  const cursorYLineRef = useRef<HTMLDivElement | null>(null);
  const cursorXLineRef = useRef<HTMLDivElement | null>(null);
  const cursorGeomCacheRef = useRef<AshbyCursorGeomCache | null>(null);
  const cursorPendingRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);
  const cursorLastTextRef = useRef({ y: "", x: "" });
  const xAxisRef = useRef(xAxis);
  const yAxisRef = useRef(yAxis);
  const toolModeRef = useRef(toolMode);
  const middlePanHoldRef = useRef(false);
  const pointTipRef = useRef<AshbyPointTip | null>(null);
  const dismissedTipKeyRef = useRef<string | null>(null);
  const plottedSeriesRef = useRef<
    Array<{
      id: string;
      label: string;
      color: string;
      points: Array<{ x: number; y: number }>;
    }>
  >([]);
  const domainRafRef = useRef<number | null>(null);
  const pendingDomainRef = useRef<AxisDomain | null>(null);
  const [pointTip, setPointTip] = useState<AshbyPointTip | null>(null);
  const [middlePanHold, setMiddlePanHold] = useState(false);
  /** Размер поля графика: ширина/высота по доступному месту до края страницы. */
  const [chartSize, setChartSize] = useState({ width: 560, height: 580 });
  const [legendSize, setLegendSize] = useState({ width: 280, height: 120 });
  const [legendPlacement, setLegendPlacement] = useState<AshbyLegendPlacement | null>(
    null,
  );

  xAxisRef.current = xAxis;
  yAxisRef.current = yAxis;
  toolModeRef.current = toolMode;
  middlePanHoldRef.current = middlePanHold;
  pointTipRef.current = pointTip;

  const pointTipKey = useCallback((tip: AshbyPointTip) => {
    const materialsKey = tip.materials
      .map((item) => `${item.label}:${item.color}`)
      .join(";");
    return [
      materialsKey,
      tip.x,
      tip.y,
      Math.round(tip.chartX),
      Math.round(tip.chartY),
    ].join("|");
  }, []);

  const clearPointTip = useCallback((dismissKey: string | null = null) => {
    if (dismissKey) {
      dismissedTipKeyRef.current = dismissKey;
    }
    pointTipRef.current = null;
    setPointTip((prev) => (prev === null ? prev : null));
  }, []);

  const handlePointTipReport = useCallback(
    (tip: AshbyPointTip | null) => {
      if (!tip) {
        // Не трогаем dismissed-ключ здесь: его сбрасывает mouse leave / новая точка.
        if (pointTipRef.current !== null) {
          pointTipRef.current = null;
          setPointTip(null);
        }
        return;
      }
      const key = pointTipKey(tip);
      if (dismissedTipKeyRef.current === key) {
        return;
      }
      dismissedTipKeyRef.current = null;
      const prev = pointTipRef.current;
      if (prev && pointTipKey(prev) === key) {
        return;
      }
      pointTipRef.current = tip;
      setPointTip(tip);
    },
    [pointTipKey],
  );

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
    const canvas = canvasRef.current;
    if (!canvas) {
      cursorGeomCacheRef.current = null;
      return null;
    }
    const svg =
      (canvas.querySelector(
        ".ashby-chart-layer svg.recharts-surface",
      ) as SVGSVGElement | null) ||
      (canvas.querySelector(".ashby-chart-layer svg") as SVGSVGElement | null);
    if (!svg) {
      cursorGeomCacheRef.current = null;
      return null;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const cache: AshbyCursorGeomCache = {
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
      let geom = cursorGeomCacheRef.current;
      if (!geom || !geom.svg.isConnected) {
        geom = refreshCursorGeomCache();
      }

      const labelEl = cursorLabelRef.current;
      const yLineEl = cursorYLineRef.current;
      const xLineEl = cursorXLineRef.current;
      if (!labelEl || !yLineEl || !xLineEl) {
        return;
      }

      const bridge = cursorScaleBridgeRef.current;
      if (!bridge || !geom) {
        labelEl.style.visibility = "hidden";
        return;
      }

      const local = clientToSvgLocal(
        geom.svg,
        pending.clientX,
        pending.clientY,
      );
      if (!local) {
        labelEl.style.visibility = "hidden";
        return;
      }
      const { plotArea, xScale, yScale, domain: bridgeDomain } = bridge;
      if (
        local.x < plotArea.x ||
        local.x > plotArea.x + plotArea.width ||
        local.y < plotArea.y ||
        local.y > plotArea.y + plotArea.height
      ) {
        if (pointTipRef.current) {
          clearPointTip(pointTipKey(pointTipRef.current));
        }
        labelEl.style.visibility = "hidden";
        return;
      }

      // Свой hit-test: ближайшая точка в радиусе (не зависит от размера маркера Recharts).
      const hitR2 = ASHBY_POINT_HIT_PX * ASHBY_POINT_HIT_PX;
      let bestDist2 = hitR2;
      let best: {
        x: number;
        y: number;
        chartX: number;
        chartY: number;
      } | null = null;
      for (const series of plottedSeriesRef.current) {
        for (const point of series.points) {
          const cx = xScale?.(point.x);
          const cy = yScale?.(point.y);
          if (cx == null || cy == null) {
            continue;
          }
          const dx = local.x - cx;
          const dy = local.y - cy;
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= bestDist2) {
            bestDist2 = dist2;
            best = {
              x: point.x,
              y: point.y,
              chartX: Math.round(cx),
              chartY: Math.round(cy),
            };
          }
        }
      }

      if (best) {
        const materials = collectAshbyMaterialsAtPoint(
          plottedSeriesRef.current,
          best.x,
          best.y,
        );
        handlePointTipReport({
          x: best.x,
          y: best.y,
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
        clearPointTip(pointTipKey(pointTipRef.current));
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
        pending.clientX - geom.canvasLeft + ASHBY_CURSOR_COORDS_OFFSET;
      const top =
        pending.clientY - geom.canvasTop + ASHBY_CURSOR_COORDS_OFFSET;
      labelEl.style.transform = `translate(${left}px, ${top}px)`;
      labelEl.style.visibility = "visible";

      const yText = formatScientificPlain(
        formatAshbyAxisReadout(yAxisRef.current, dataY),
      );
      const xText = formatScientificPlain(
        formatAshbyAxisReadout(xAxisRef.current, dataX),
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
    pointTipKey,
    clientToSvgLocal,
    handlePointTipReport,
  ]);

  const handleCursorMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (toolModeRef.current !== "none" || middlePanHoldRef.current) {
        hideCursorReadout();
        return;
      }
      cursorPendingRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
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
    if (!interactionEnabled && middlePanHold) {
      setMiddlePanHold(false);
      middlePanHoldRef.current = false;
    }
  }, [interactionEnabled, middlePanHold]);

  useEffect(() => {
    if (pointTip) {
      hideCursorReadout();
    }
  }, [pointTip, hideCursorReadout]);

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

  const handleLegendPlacementChange = useCallback((next: AshbyLegendPlacement) => {
    setLegendPlacement((prev) =>
      prev && prev.top === next.top && prev.left === next.left ? prev : next,
    );
  }, []);

  useLayoutEffect(() => {
    const el = legendOverlayRef.current;
    if (!el) {
      return;
    }

    const updateLegendSize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        // Размер для размещения = видимая плашка (уже с maxHeight), не scrollHeight.
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
    return () => {
      observer.disconnect();
    };
  }, [legendItems, chartSize.height, legendPlacement?.top]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const updateSize = () => {
      const width = Math.max(280, Math.floor(stage.clientWidth));
      const height = Math.max(280, Math.floor(stage.clientHeight));
      if (width > 0 && height > 0) {
        setChartSize((prev) =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height },
        );
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const domainLiveRef = useRef(domain);
  domainLiveRef.current = domain;

  const scheduleDomainUpdate = useCallback(
    (update: AxisDomain | ((prev: AxisDomain) => AxisDomain)) => {
      const base = pendingDomainRef.current ?? domainLiveRef.current;
      pendingDomainRef.current =
        typeof update === "function" ? update(base) : update;
      if (domainRafRef.current !== null) {
        return;
      }
      domainRafRef.current = requestAnimationFrame(() => {
        domainRafRef.current = null;
        const pending = pendingDomainRef.current;
        pendingDomainRef.current = null;
        if (pending) {
          onDomainPreview(pending);
        }
      });
    },
    [onDomainPreview],
  );

  const commitDomainUpdate = useCallback(
    (next: AxisDomain) => {
      pendingDomainRef.current = null;
      if (domainRafRef.current !== null) {
        cancelAnimationFrame(domainRafRef.current);
        domainRafRef.current = null;
      }
      onDomainCommit(next);
    },
    [onDomainCommit],
  );

  useEffect(() => {
    return () => {
      if (domainRafRef.current !== null) {
        cancelAnimationFrame(domainRafRef.current);
      }
    };
  }, []);

  const plottedSeries = useMemo(
    () => (data?.series ?? []).filter((series) => series.points.length > 0),
    [data],
  );
  plottedSeriesRef.current = plottedSeries;
  const overlapDashById = useMemo(
    () => buildAshbyOverlapDashBySeriesId(plottedSeries),
    [plottedSeries],
  );
  const hulls = data?.hulls ?? [];

  const scatterModels = useMemo(
    () =>
      plottedSeries.map((item) => ({
        id: item.id,
        label: item.label,
        color: item.color,
        strokeDasharray: overlapDashById.get(item.id),
        data: item.points.map((point) => ({
          x: point.x,
          y: point.y,
          materialLabel: item.label,
        })),
      })),
    [plottedSeries, overlapDashById],
  );

  useEffect(() => {
    if (plottedSeries.length === 0) {
      clearPointTip();
      dismissedTipKeyRef.current = null;
    }
  }, [plottedSeries.length, clearPointTip]);

  /** Невидимые точки, чтобы оси/сетка рисовались даже без данных. */
  const axisSeed = [
    { x: domain.x.domain[0], y: domain.y.domain[0] },
    { x: domain.x.domain[1], y: domain.y.domain[1] },
  ];

  // View domain оставляем как есть; тики — «красивые» внутри диапазона (без snap domain).
  const viewAxisTicks = useMemo(
    () => ({
      x: computeTicksForFixedDomain(domain.x.domain[0], domain.x.domain[1], {
        targetTickCount: 8,
      }),
      y: computeTicksForFixedDomain(domain.y.domain[0], domain.y.domain[1], {
        targetTickCount: 8,
      }),
    }),
    [domain.x.domain, domain.y.domain],
  );

  const estimatedYAxisWidth = useMemo(
    () => estimateYAxisWidth(viewAxisTicks.y.ticks, viewAxisTicks.y.step),
    [viewAxisTicks.y.ticks, viewAxisTicks.y.step],
  );

  const yAxisWidthRef = useRef(estimatedYAxisWidth);
  const [yAxisWidth, setYAxisWidth] = useState(estimatedYAxisWidth);

  useEffect(() => {
    const prev = yAxisWidthRef.current;
    if (
      estimatedYAxisWidth > prev ||
      estimatedYAxisWidth < prev - ASHBY_Y_AXIS_WIDTH_SHRINK_HYSTERESIS
    ) {
      yAxisWidthRef.current = estimatedYAxisWidth;
      setYAxisWidth(estimatedYAxisWidth);
    }
  }, [estimatedYAxisWidth]);

  // React onWheel — passive, preventDefault не блокирует скролл страницы.
  // Нативный listener с { passive: false } нужен, чтобы зум не крутил страницу.
  // Над легендой preventDefault не ставим — иначе не крутится список.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!interactionEnabled) {
        return;
      }
      const legend = legendOverlayRef.current;
      if (
        legend &&
        event.target instanceof Node &&
        legend.contains(event.target)
      ) {
        return;
      }
      event.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [interactionEnabled]);

  return (
    <div className="ashby-chart-inner">
      <div className="ashby-chart-stage" ref={stageRef}>
        <div
          ref={canvasRef}
          className={
            toolMode === "pan" || middlePanHold
              ? "ashby-chart-canvas ashby-chart-canvas--pan"
              : toolMode === "zoom"
                ? "ashby-chart-canvas ashby-chart-canvas--zoom"
                : "ashby-chart-canvas"
          }
          style={{
            position: "relative",
            width: chartSize.width,
            height: chartSize.height,
          }}
          onMouseMove={handleCursorMove}
          onMouseLeave={() => {
            hideCursorReadout();
            clearPointTip();
            dismissedTipKeyRef.current = null;
          }}
          onMouseEnter={() => {
            cursorGeomCacheRef.current = null;
          }}
          onAuxClick={(event) => {
            if (event.button === 1) {
              event.preventDefault();
            }
          }}
          onWheel={(event) => {
            if (!interactionEnabled || toolMode !== "none" || middlePanHold) {
              return;
            }
            const legend = legendOverlayRef.current;
            if (
              legend &&
              event.target instanceof Node &&
              legend.contains(event.target)
            ) {
              return;
            }
            event.preventDefault();
            const factor = wheelZoomFactor(event.deltaY, event.deltaMode);
            scheduleDomainUpdate((prev) => ({
              x: zoomDomain(prev.x, factor),
              y: zoomDomain(prev.y, factor),
            }));
          }}
        >
          {/* График; легенда поверх с прозрачностью (pointer-events: none). */}
          <div
            className="ashby-chart-layer"
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              height: "100%",
            }}
          >
            <ResponsiveContainer width={chartSize.width} height={chartSize.height}>
              <ScatterChart margin={{ ...ASHBY_CHART_MARGIN }}>
                <AshbyChartTitle title={title} />
                <AshbyAxisLabels
                  xLabel={xLabel}
                  yLabel={yLabel}
                  yAxisWidth={yAxisWidth}
                />
                {/* Основные секции — сплошная сетка по тикам. */}
                <CartesianGrid stroke="#c5cad3" strokeWidth={1} />
                {/* Мини-секции — пунктир посередине между тиками. */}
                <AshbyMinorGridlines
                  xTicks={viewAxisTicks.x.ticks}
                  yTicks={viewAxisTicks.y.ticks}
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  name=""
                  domain={domain.x.domain}
                  ticks={viewAxisTicks.x.ticks}
                  allowDataOverflow
                  tickCount={8}
                  tickFormatter={(value) =>
                    formatAdaptiveTickLabel(Number(value), viewAxisTicks.x.step)
                  }
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name=""
                  width={yAxisWidth}
                  domain={domain.y.domain}
                  ticks={viewAxisTicks.y.ticks}
                  allowDataOverflow
                  tickCount={8}
                  tickFormatter={(value) =>
                    formatAdaptiveTickLabel(Number(value), viewAxisTicks.y.step)
                  }
                />
                {hulls.length > 0 && <HullPolygons hulls={hulls} />}
                {plottedSeries.length === 0 && (
                  <Scatter
                    id="ashby-axis-seed"
                    data={axisSeed}
                    fill="transparent"
                    stroke="none"
                    legendType="none"
                    isAnimationActive={false}
                  />
                )}
                {scatterModels.map((item) => (
                  <Scatter
                    key={item.id}
                    id={item.id}
                    name={item.label}
                    data={item.data}
                    fill={item.color}
                    stroke={item.color}
                    line={{
                      stroke: item.color,
                      strokeWidth: item.strokeDasharray ? 2 : 1.5,
                      ...(item.strokeDasharray
                        ? { strokeDasharray: item.strokeDasharray }
                        : {}),
                    }}
                    lineType="joint"
                    legendType="none"
                    isAnimationActive={false}
                  />
                ))}
                <AshbyCursorScaleReporter
                  domain={domain}
                  bridgeRef={cursorScaleBridgeRef}
                />
                <AshbyChartInteraction
                  mode={toolMode}
                  enabled={interactionEnabled}
                  domain={domain}
                  onDomainPreview={scheduleDomainUpdate}
                  onDomainCommit={commitDomainUpdate}
                  onMiddlePanHoldChange={setMiddlePanHold}
                />
                <AshbyLegendPlacementReporter
                  data={data}
                  domain={domain}
                  legendSize={legendSize}
                  toolMode={toolMode}
                  onPlacementChange={handleLegendPlacementChange}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <AshbyLegendOverlay
            items={legendItems}
            placement={legendPlacement}
            chartHeight={chartSize.height}
            overlayRef={legendOverlayRef}
          />
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
            {pointTip ? (
              <AshbyPointTipPlaque
                tip={pointTip}
                xAxis={xAxis}
                yAxis={yAxis}
              />
            ) : null}
            <AshbyCursorCoordsLabel
              labelRef={cursorLabelRef}
              yLineRef={cursorYLineRef}
              xLineRef={cursorXLineRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type ScaleLike = ((value: number | string) => number | undefined) & {
  invert?: (value: number) => number;
};

function invertScale(
  scale: ScaleLike | undefined,
  pixel: number,
  fallbackDomain: [number, number],
  plotStart: number,
  plotSize: number,
  /** Для оси Y: сверху max, снизу min. */
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

function domainFromPointerDelta(
  origin: AxisDomain,
  start: { x: number; y: number },
  end: { x: number; y: number },
  plotArea: { x: number; y: number; width: number; height: number },
  xScale: ScaleLike | undefined,
  yScale: ScaleLike | undefined,
): AxisDomain {
  const x0 = invertScale(
    xScale,
    start.x,
    origin.x.domain,
    plotArea.x,
    plotArea.width,
  );
  const x1 = invertScale(
    xScale,
    end.x,
    origin.x.domain,
    plotArea.x,
    plotArea.width,
  );
  const y0 = invertScale(
    yScale,
    start.y,
    origin.y.domain,
    plotArea.y,
    plotArea.height,
    true,
  );
  const y1 = invertScale(
    yScale,
    end.y,
    origin.y.domain,
    plotArea.y,
    plotArea.height,
    true,
  );
  return {
    x: shiftDomain(origin.x, x0 - x1),
    y: shiftDomain(origin.y, y0 - y1),
  };
}

/**
 * Слой pan / box-zoom поверх области данных.
 * Рендерится внутри ScatterChart, чтобы использовать plotArea и scale.
 * Средняя кнопка (колёсико) — временная «рука» на время зажатия.
 */
function AshbyChartInteraction({
  mode,
  enabled,
  domain,
  onDomainPreview,
  onDomainCommit,
  onMiddlePanHoldChange,
}: {
  mode: ChartToolMode;
  enabled: boolean;
  domain: AxisDomain;
  onDomainPreview: (
    next: AxisDomain | ((prev: AxisDomain) => AxisDomain),
  ) => void;
  onDomainCommit: (next: AxisDomain) => void;
  onMiddlePanHoldChange?: (active: boolean) => void;
}) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale() as ScaleLike | undefined;
  const yScale = useYAxisScale() as ScaleLike | undefined;
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: AxisDomain;
    kind: "pan" | "zoom";
    fromMiddle: boolean;
  } | null>(null);
  const [middlePanHold, setMiddlePanHold] = useState(false);
  const [box, setBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const setMiddleHold = useCallback(
    (active: boolean) => {
      setMiddlePanHold(active);
      onMiddlePanHoldChange?.(active);
    },
    [onMiddlePanHoldChange],
  );

  if (!enabled || !plotArea) {
    return null;
  }

  const cursor =
    mode === "pan" || middlePanHold
      ? "grab"
      : mode === "zoom"
        ? "crosshair"
        : undefined;

  function clientToSvgPoint(
    event: PointerEvent<SVGRectElement>,
  ): { x: number; y: number } | null {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) {
      return null;
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return null;
    }
    const local = point.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function handlePointerDown(event: PointerEvent<SVGRectElement>) {
    if (!plotArea) {
      return;
    }

    // Средняя кнопка (колёсико): временная «рука».
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      const pt = clientToSvgPoint(event);
      if (!pt) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      setMiddleHold(true);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: pt.x,
        startY: pt.y,
        origin: domain,
        kind: "pan",
        fromMiddle: true,
      };
      setBox(null);
      return;
    }

    // Инструменты панели — только ЛКМ.
    if (event.button !== 0 || mode === "none") {
      return;
    }
    const pt = clientToSvgPoint(event);
    if (!pt) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: pt.x,
      startY: pt.y,
      origin: domain,
      kind: mode,
      fromMiddle: false,
    };
    setBox(null);
  }

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !plotArea) {
      return;
    }
    const pt = clientToSvgPoint(event);
    if (!pt) {
      return;
    }

    if (drag.kind === "pan") {
      onDomainPreview(
        domainFromPointerDelta(
          drag.origin,
          { x: drag.startX, y: drag.startY },
          pt,
          plotArea,
          xScale,
          yScale,
        ),
      );
      return;
    }

    if (drag.kind === "zoom") {
      const x = Math.min(drag.startX, pt.x);
      const y = Math.min(drag.startY, pt.y);
      const width = Math.abs(pt.x - drag.startX);
      const height = Math.abs(pt.y - drag.startY);
      setBox({ x, y, width, height });
    }
  }

  function finishDrag(event: PointerEvent<SVGRectElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !plotArea) {
      return;
    }
    const pt = clientToSvgPoint(event);
    dragRef.current = null;
    if (drag.fromMiddle) {
      setMiddleHold(false);
    }

    if (drag.kind === "pan") {
      if (!pt) {
        return;
      }
      const next = domainFromPointerDelta(
        drag.origin,
        { x: drag.startX, y: drag.startY },
        pt,
        plotArea,
        xScale,
        yScale,
      );
      if (!domainsEqual(drag.origin, next)) {
        onDomainCommit(next);
      } else {
        onDomainPreview(drag.origin);
      }
      return;
    }

    if (drag.kind === "zoom" && pt) {
      const xA = invertScale(
        xScale,
        drag.startX,
        drag.origin.x.domain,
        plotArea.x,
        plotArea.width,
      );
      const xB = invertScale(
        xScale,
        pt.x,
        drag.origin.x.domain,
        plotArea.x,
        plotArea.width,
      );
      const yA = invertScale(
        yScale,
        drag.startY,
        drag.origin.y.domain,
        plotArea.y,
        plotArea.height,
        true,
      );
      const yB = invertScale(
        yScale,
        pt.y,
        drag.origin.y.domain,
        plotArea.y,
        plotArea.height,
        true,
      );
      setBox(null);
      const minSpanX =
        (drag.origin.x.domain[1] - drag.origin.x.domain[0]) * 0.002;
      const minSpanY =
        (drag.origin.y.domain[1] - drag.origin.y.domain[0]) * 0.002;
      const xMin = Math.min(xA, xB);
      const xMax = Math.max(xA, xB);
      const yMin = Math.min(yA, yB);
      const yMax = Math.max(yA, yB);
      if (xMax - xMin < minSpanX || yMax - yMin < minSpanY) {
        return;
      }
      onDomainCommit({
        x: {
          domain: [xMin, xMax],
          ticks: drag.origin.x.ticks,
          step: drag.origin.x.step,
        },
        y: {
          domain: [yMin, yMax],
          ticks: drag.origin.y.ticks,
          step: drag.origin.y.step,
        },
      });
    }
  }

  return (
    <g className="ashby-chart-interaction" style={cursor ? { cursor } : undefined}>
      <rect
        x={plotArea.x}
        y={plotArea.y}
        width={plotArea.width}
        height={plotArea.height}
        fill="transparent"
        style={{ cursor: cursor ?? "default", touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={() => {
          const drag = dragRef.current;
          dragRef.current = null;
          setBox(null);
          if (drag?.fromMiddle) {
            setMiddleHold(false);
          }
          onDomainPreview(domain);
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          if (!plotArea) {
            return;
          }
          // Скролл страницы блокирует native wheel на .ashby-chart-canvas.
          const svg = event.currentTarget.ownerSVGElement;
          if (!svg) {
            return;
          }
          const point = svg.createSVGPoint();
          point.x = event.clientX;
          point.y = event.clientY;
          const ctm = svg.getScreenCTM();
          if (!ctm) {
            return;
          }
          const local = point.matrixTransform(ctm.inverse());
          const factor = wheelZoomFactor(event.deltaY, event.deltaMode);
          const pivotX = invertScale(
            xScale,
            local.x,
            domain.x.domain,
            plotArea.x,
            plotArea.width,
          );
          const pivotY = invertScale(
            yScale,
            local.y,
            domain.y.domain,
            plotArea.y,
            plotArea.height,
            true,
          );
          onDomainPreview((prev) => ({
            x: zoomDomainAt(prev.x, factor, pivotX),
            y: zoomDomainAt(prev.y, factor, pivotY),
          }));
        }}
      />
      {box && mode === "zoom" ? (
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill="rgba(61, 90, 128, 0.12)"
          stroke="#3D5A80"
          strokeDasharray="4 3"
          strokeWidth={1}
          pointerEvents="none"
        />
      ) : null}
    </g>
  );
}

function ToolbarIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ASHBY_TOOLBAR_ACCENT = "#3D5A80";
const ASHBY_TOOLBAR_ACCENT_HOVER = "#2E4A6B";
const ASHBY_TOOLBAR_ACCENT_SOFT = "#E8EEF4";

function AshbyToolbarButton({
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
    backgroundColor = "transparent";
    color = "#5C6570";
  } else if (hovered) {
    // Как «Построить диаграмму»: синий фон, белая иконка; при нажатии — темнее
    const fill = pressed ? ASHBY_TOOLBAR_ACCENT_HOVER : ASHBY_TOOLBAR_ACCENT;
    backgroundColor = fill;
    color = "#ffffff";
    borderColor = fill;
  } else if (active) {
    backgroundColor = ASHBY_TOOLBAR_ACCENT_SOFT;
    color = ASHBY_TOOLBAR_ACCENT;
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
        transition:
          "background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

function AshbyChartToolbar({
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
  onSave: (format: AshbySaveFormat) => void;
}) {
  /** Расстояние между кнопками. */
  const buttonGap = "0.3cm";
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saveMenuPos, setSaveMenuPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const saveButtonWrapRef = useRef<HTMLDivElement>(null);

  function updateSaveMenuPos() {
    const wrap = saveButtonWrapRef.current;
    if (!wrap) {
      return;
    }
    const rect = wrap.getBoundingClientRect();
    // Меню слева от вертикальной панели
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

  function handleSaveFormat(format: AshbySaveFormat) {
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
            <AshbySaveMenuItem
              label="PNG"
              onClick={() => handleSaveFormat("png")}
            />
            <AshbySaveMenuItem
              label="SVG"
              onClick={() => handleSaveFormat("svg")}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className="ashby-toolbar"
      data-tour="ashby-toolbar"
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
      <AshbyToolbarButton
        onClick={onHome}
        disabled={!enabled}
        title="Исходный масштаб"
        ariaLabel="Исходный масштаб"
      >
        <ToolbarIcon>
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6.5 10.5V20h11V10.5" />
        </ToolbarIcon>
      </AshbyToolbarButton>
      {renderSpacer("gap-1")}
      <AshbyToolbarButton
        active={mode === "pan"}
        onClick={() => onModeChange(mode === "pan" ? "none" : "pan")}
        disabled={!enabled}
        title="Перемещение"
        ariaLabel="Перемещение"
        ariaPressed={mode === "pan"}
      >
        <ToolbarIcon>
          <path d="M18 11V6a2 2 0 0 0-4 0v1" />
          <path d="M14 10V4a2 2 0 0 0-4 0v2" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </ToolbarIcon>
      </AshbyToolbarButton>
      {renderSpacer("gap-2")}
      <AshbyToolbarButton
        active={mode === "zoom"}
        onClick={() => onModeChange(mode === "zoom" ? "none" : "zoom")}
        disabled={!enabled}
        title="Масштаб рамкой"
        ariaLabel="Масштаб рамкой"
        ariaPressed={mode === "zoom"}
      >
        <ToolbarIcon>
          <path d="M7 4H4v3" />
          <path d="M17 4h3v3" />
          <path d="M7 20H4v-3" />
          <path d="M17 20h3v-3" />
          <rect x={8} y={8} width={8} height={8} rx={1} />
        </ToolbarIcon>
      </AshbyToolbarButton>
      {renderSpacer("gap-3")}
      <AshbyToolbarButton
        onClick={onZoomIn}
        disabled={!enabled}
        title="Приблизить"
        ariaLabel="Приблизить"
      >
        <ToolbarIcon>
          <circle cx={11} cy={11} r={6.5} />
          <path d="M16.5 16.5 21 21" />
          <path d="M8.5 11h5" />
          <path d="M11 8.5v5" />
        </ToolbarIcon>
      </AshbyToolbarButton>
      {renderSpacer("gap-4")}
      <AshbyToolbarButton
        onClick={onZoomOut}
        disabled={!enabled}
        title="Отдалить"
        ariaLabel="Отдалить"
      >
        <ToolbarIcon>
          <circle cx={11} cy={11} r={6.5} />
          <path d="M16.5 16.5 21 21" />
          <path d="M8.5 11h5" />
        </ToolbarIcon>
      </AshbyToolbarButton>
      {renderSpacer("gap-5")}
      <div
        ref={saveButtonWrapRef}
        className="ashby-save-menu"
        style={{ position: "relative", zIndex: 101, display: "inline-flex" }}
      >
        <AshbyToolbarButton
          active={saveMenuOpen}
          onClick={() => setSaveMenuOpen((open) => !open)}
          disabled={!enabled}
          title="Сохранить график"
          ariaLabel="Сохранить график"
          ariaPressed={saveMenuOpen}
        >
          <ToolbarIcon>
            <path d="M5 4h11l3 3v13H5V4z" />
            <path d="M8 4v5h8V4" />
            <path d="M8 18h8" />
            <path d="M8 14h8" />
          </ToolbarIcon>
        </AshbyToolbarButton>
      </div>
      {saveMenu}
    </div>
  );
}

export function AshbyTab() {
  const { workspace } = useWorkspace();
  const areaOptions = workspace?.application_areas ?? [];

  const [selectedArea, setSelectedArea] = useState("Все");
  const [xProp, setXProp] = useState("");
  const [yProp, setYProp] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [plotData, setPlotData] = useState<AshbyResponse | null>(null);
  const [baseDomain, setBaseDomain] = useState<AxisDomain | null>(null);
  const [viewDomain, setViewDomain] = useState<AxisDomain | null>(null);
  const [toolMode, setToolMode] = useState<ChartToolMode>("none");
  const [axesReady, setAxesReady] = useState(false);

  const areasParam =
    selectedArea && selectedArea !== "Все" ? [selectedArea] : undefined;

  const optionsQuery = useQuery({
    queryKey: ["selection", "ashby", "options", selectedArea],
    queryFn: () => getAshbyOptions(areasParam),
    enabled: Boolean(workspace),
  });

  const axes = optionsQuery.data?.axes ?? EMPTY_AXES;
  const classPool = optionsQuery.data?.classes ?? EMPTY_CLASSES;

  useEffect(() => {
    if (axes.length === 0 || axesReady) {
      return;
    }
    const keys = axes.map((axis) => axis.key);
    const defaultX = keys.includes("yield_strength")
      ? "yield_strength"
      : (keys[0] ?? "");
    let defaultY = keys.includes("temperature")
      ? "temperature"
      : (keys.find((key) => key !== defaultX) ?? "");
    if (defaultY === defaultX) {
      defaultY = keys.find((key) => key !== defaultX) ?? "";
    }
    setXProp(defaultX);
    setYProp(defaultY);
    setAxesReady(true);
  }, [axes, axesReady]);

  useEffect(() => {
    setSelectedClasses((prev) => {
      const next = prev.filter((className) => classPool.includes(className));
      if (
        next.length === prev.length &&
        next.every((name, index) => name === prev[index])
      ) {
        return prev;
      }
      return next;
    });
  }, [classPool]);

  const xOptions = useMemo(
    () => axes.filter((axis) => axis.key !== yProp),
    [axes, yProp],
  );
  const yOptions = useMemo(
    () => axes.filter((axis) => axis.key !== xProp),
    [axes, xProp],
  );

  const xAxisOption = axes.find((axis) => axis.key === xProp);
  const yAxisOption = axes.find((axis) => axis.key === yProp);

  const chartXLabel = plotData
    ? axisCaption(plotData.x_axis.label, plotData.x_axis.unit)
    : axisCaptionFromOption(xAxisOption, "Ось X");
  const chartYLabel = plotData
    ? axisCaption(plotData.y_axis.label, plotData.y_axis.unit)
    : axisCaptionFromOption(yAxisOption, "Ось Y");
  const chartXAxis = useMemo(
    () => resolveAshbyAxisMeta(plotData?.x_axis, xAxisOption),
    [plotData?.x_axis, xAxisOption],
  );
  const chartYAxis = useMemo(
    () => resolveAshbyAxisMeta(plotData?.y_axis, yAxisOption),
    [plotData?.y_axis, yAxisOption],
  );

  const plotMutation = useMutation({
    mutationFn: postAshby,
    onSuccess: (data) => {
      const colored = applyAshbyChartColors(data);
      setPlotData(colored);
      const nextDomain = buildBaseDomain(colored) ?? emptyDomain();
      setBaseDomain(nextDomain);
      setViewDomain(nextDomain);
      setToolMode("none");
    },
  });

  const chartData = plotData;
  const legendItems = useMemo(() => buildAshbyLegend(chartData), [chartData]);

  const hasPlottedPoints = Boolean(
    plotData?.series.some((series) => series.points.length > 0),
  );

  const activeDomain = useMemo(() => {
    if (hasPlottedPoints && plotData) {
      return viewDomain ?? buildBaseDomain(plotData) ?? emptyDomain();
    }
    return emptyDomain();
  }, [hasPlottedPoints, plotData, viewDomain]);

  const chartTitle = !workspace
    ? "Диаграмма Эшби"
    : optionsQuery.isError
      ? "Ошибка загрузки параметров"
      : plotMutation.isPending
        ? "Построение диаграммы…"
        : plotMutation.isError
          ? "Ошибка построения диаграммы"
          : selectedClasses.length === 0
            ? "Диаграмма Эшби (классы не выбраны)"
            : plotData
              ? hasPlottedPoints
                ? "Диаграмма Эшби по классам"
                : "Нет данных для выбранных осей и классов"
              : "Диаграмма Эшби";

  function requestPlot(
    nextX = xProp,
    nextY = yProp,
    classes = selectedClasses,
  ) {
    if (!nextX || !nextY || nextX === nextY || classes.length === 0) {
      return;
    }
    plotMutation.mutate({
      x_prop: nextX,
      y_prop: nextY,
      class_names: classes,
      ...(areasParam ? { areas: areasParam } : {}),
    });
  }

  function toggleClassSelection(className: string) {
    setSelectedClasses((prev) =>
      prev.includes(className)
        ? prev.filter((name) => name !== className)
        : [...prev, className],
    );
  }

  function handleAxisChange(axis: "x" | "y", next: string) {
    if (axis === "x") {
      setXProp(next);
      if (next === yProp) {
        const fallback = axes.find((item) => item.key !== next)?.key ?? "";
        setYProp(fallback);
        if (selectedClasses.length > 0 && fallback) {
          requestPlot(next, fallback);
        }
        return;
      }
      if (selectedClasses.length > 0) {
        requestPlot(next, yProp);
      }
      return;
    }

    setYProp(next);
    if (next === xProp) {
      const fallback = axes.find((item) => item.key !== next)?.key ?? "";
      setXProp(fallback);
      if (selectedClasses.length > 0 && fallback) {
        requestPlot(fallback, next);
      }
      return;
    }
    if (selectedClasses.length > 0) {
      requestPlot(xProp, next);
    }
  }

  function handleReset() {
    setSelectedClasses([]);
    setPlotData(null);
    setBaseDomain(null);
    setViewDomain(null);
    setToolMode("none");
    plotMutation.reset();
  }

  function handleHome() {
    const home = baseDomain
      ? baseDomain
      : plotData && hasPlottedPoints
        ? (buildBaseDomain(plotData) ?? emptyDomain())
        : emptyDomain();
    setViewDomain(home);
  }

  function handleZoom(factor: number) {
    const current = viewDomain ?? activeDomain;
    setViewDomain({
      x: zoomDomain(current.x, factor),
      y: zoomDomain(current.y, factor),
    });
  }

  async function handleSave(format: AshbySaveFormat) {
    const root = document.querySelector(
      ".ashby-chart-canvas",
    ) as HTMLElement | null;
    if (!root) {
      return;
    }
    try {
      if (format === "svg") {
        exportAshbyChartSvg(root);
        return;
      }
      await exportAshbyChartPng(root);
    } catch (error) {
      console.error(error);
    }
  }

  const canPlot =
    Boolean(workspace) &&
    Boolean(xProp) &&
    Boolean(yProp) &&
    xProp !== yProp &&
    selectedClasses.length > 0 &&
    !plotMutation.isPending;

  const statusMessage = !workspace
    ? "Откройте workspace с материалами"
    : optionsQuery.isLoading
      ? "Загрузка параметров…"
      : optionsQuery.isError
        ? optionsQuery.error.message
        : plotMutation.isError
          ? plotMutation.error.message
          : null;

  return (
    <div
      className="ashby-tab"
      style={{
        paddingTop: "0.5cm",
        paddingLeft: "0.5cm",
        paddingRight: "0.5cm",
        boxSizing: "border-box",
      }}
    >
      <div
        className="ashby-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 4fr)",
          gap: 20,
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          paddingTop: 0,
          paddingLeft: 0,
        }}
      >
        <aside
          className="ashby-controls"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5cm",
          }}
        >
          <div className="ashby-field" data-tour="ashby-area">
            <label htmlFor="ashby-area" className="ashby-section-label" style={ASHBY_SECTION_LABEL_STYLE}>
              Область применения:
            </label>
            <div className="ashby-control-shell">
              <select
                id="ashby-area"
                className="input ashby-field-control"
                value={selectedArea}
                disabled={!workspace}
                onChange={(event) => setSelectedArea(event.target.value)}
              >
                <option value="Все">Все</option>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ashby-field" data-tour="ashby-x-axis">
            <label htmlFor="ashby-x-axis" className="ashby-section-label" style={ASHBY_SECTION_LABEL_STYLE}>
              Ось X:
            </label>
            <div className="ashby-control-shell">
              <select
                id="ashby-x-axis"
                className="input ashby-field-control"
                value={xProp}
                disabled={!workspace || axes.length === 0}
                onChange={(event) => handleAxisChange("x", event.target.value)}
              >
                {xOptions.map((axis) => (
                  <option key={axis.key} value={axis.key}>
                    {formatScientificPlain(axis.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ashby-field" data-tour="ashby-y-axis">
            <label htmlFor="ashby-y-axis" className="ashby-section-label" style={ASHBY_SECTION_LABEL_STYLE}>
              Ось Y:
            </label>
            <div className="ashby-control-shell">
              <select
                id="ashby-y-axis"
                className="input ashby-field-control"
                value={yProp}
                disabled={!workspace || axes.length === 0}
                onChange={(event) => handleAxisChange("y", event.target.value)}
              >
                {yOptions.map((axis) => (
                  <option key={axis.key} value={axis.key}>
                    {formatScientificPlain(axis.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="ashby-selection-stack"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <div
              className="ashby-labelframe ashby-class-labelframe"
              data-tour="ashby-classes"
              style={ASHBY_CLASS_LABELFRAME_STYLE}
            >
              <div
                className="ashby-labelframe-title ashby-section-label"
                style={ASHBY_LABELFRAME_TITLE_STYLE}
              >
                Выберите классы
              </div>
              <ul
                className="ashby-listbox ashby-class-list"
                role="listbox"
                aria-multiselectable="true"
                aria-label="Выберите классы"
                style={ASHBY_CLASS_LIST_STYLE}
              >
                {classPool.map((className) => (
                  <li
                    key={className}
                    className="ashby-class-row"
                    role="option"
                    aria-selected={selectedClasses.includes(className)}
                    style={ASHBY_CLASS_ROW_STYLE}
                  >
                    <label
                      className="ashby-class-row-label"
                      style={ASHBY_CLASS_ROW_LABEL_STYLE}
                    >
                      <input
                        type="checkbox"
                        className="ashby-class-checkbox"
                        checked={selectedClasses.includes(className)}
                        disabled={!workspace}
                        onChange={() => toggleClassSelection(className)}
                      />
                      <span className="ashby-class-row-name" title={className}>
                        {className}
                      </span>
                    </label>
                  </li>
                ))}
                {workspace &&
                  !optionsQuery.isLoading &&
                  classPool.length === 0 && (
                    <li
                      className="ashby-listbox-empty"
                      style={ASHBY_CLASS_ROW_STYLE}
                    >
                      Нет классов
                    </li>
                  )}
              </ul>
            </div>

            <div
              className="ashby-selection-stack-spacer"
              aria-hidden
              style={{
                width: "100%",
                height: "0.15cm",
                minHeight: "0.15cm",
                flex: "0 0 0.15cm",
              }}
            />

            <div
              className="ashby-actions"
              data-tour="ashby-actions"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.15cm",
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
              }}
            >
              <button
                type="button"
                className="ashby-action-btn"
                style={{
                  width: "calc(100% - 20px)",
                  maxWidth: "calc(100% - 20px)",
                  marginInline: "auto",
                }}
                disabled={!canPlot}
                onClick={() => requestPlot()}
              >
                Построить диаграмму
              </button>
              <button
                type="button"
                className="ashby-action-btn button-secondary"
                style={{
                  width: "calc(100% - 20px)",
                  maxWidth: "calc(100% - 20px)",
                  marginInline: "auto",
                }}
                disabled={!workspace}
                onClick={handleReset}
              >
                Сбросить
              </button>
            </div>
          </div>
        </aside>

        <section
          className="ashby-chart-panel"
          data-tour="ashby-chart"
          aria-label="Поле диаграммы Эшби"
        >
          <div className="ashby-chart-field">
            {statusMessage && (
              <p
                className={
                  optionsQuery.isError || plotMutation.isError
                    ? "ashby-status ashby-status--error"
                    : "ashby-status"
                }
              >
                {statusMessage}
              </p>
            )}

            <div className="ashby-chart-wrap">
              <AshbyChart
                data={chartData}
                domain={activeDomain}
                xLabel={chartXLabel}
                yLabel={chartYLabel}
                xAxis={chartXAxis}
                yAxis={chartYAxis}
                title={chartTitle}
                legendItems={legendItems}
                toolMode={toolMode}
                interactionEnabled={hasPlottedPoints}
                onDomainPreview={setViewDomain}
                onDomainCommit={setViewDomain}
              />
              <AshbyChartToolbar
                enabled={hasPlottedPoints}
                mode={toolMode}
                onHome={handleHome}
                onModeChange={setToolMode}
                onZoomIn={() => handleZoom(0.8)}
                onZoomOut={() => handleZoom(1.25)}
                onSave={handleSave}
              />
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
