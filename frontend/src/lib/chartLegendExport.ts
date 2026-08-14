/** Экспорт графика с HTML-легендой (.ashby-legend-overlay) — как на диаграмме Эшби. */

const LEGEND_OVERLAY_BG = "rgba(255, 255, 255, 0.5)";
const EXPORT_LEGEND_SIDE_GAP = 16;

export type ChartSaveFormat = "png" | "svg";

type ExportLegendItem = {
  label: string;
  color: string;
  kind: "series" | "class";
  strokeDasharray?: string;
};

type LegendSidePanelLayout = {
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

function isLegendListScrollable(overlay: HTMLElement): boolean {
  const list = overlay.querySelector(".ashby-legend-overlay-list");
  if (!(list instanceof HTMLElement)) {
    return false;
  }
  return list.scrollHeight > list.clientHeight + 1;
}

function collectExportLegendItems(overlay: HTMLElement): ExportLegendItem[] {
  const items: ExportLegendItem[] = [];
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

function readLegendOverlayTitle(overlay: HTMLElement): string {
  const title = overlay.querySelector(
    ".ashby-legend-overlay-title",
  ) as HTMLElement | null;
  return title?.textContent?.trim() || "Элементы на графике";
}

function measureLegendSidePanel(
  items: ExportLegendItem[],
  title: string,
  maxHeight: number,
): LegendSidePanelLayout {
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
  const availableListH = Math.max(rowHeight, maxHeight - listTop - padding);
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
      x: padding + col * (colInnerW + colGap),
      y: listTop + row * (rowHeight + rowGap) + rowHeight / 2,
      label: item.label,
      color: item.color,
      kind: item.kind,
      strokeDasharray: item.strokeDasharray,
    };
  });

  const usedRows = Math.min(items.length, rowsPerCol);
  const height = Math.ceil(
    listTop + usedRows * rowHeight + Math.max(0, usedRows - 1) * rowGap + padding,
  );

  return {
    title,
    width,
    height: Math.min(height, maxHeight),
    padding,
    titleY: padding + titleFontSize / 2,
    titleFontSize,
    fontSize,
    markerW,
    labelPad,
    rows,
  };
}

function resolveExportLegend(
  root: HTMLElement,
  maxHeight: number,
): {
  overlay: HTMLElement | null;
  sidePanel: LegendSidePanelLayout | null;
} {
  const overlay = root.querySelector(
    ".ashby-legend-overlay",
  ) as HTMLElement | null;
  if (!overlay) {
    return { overlay: null, sidePanel: null };
  }
  if (!isLegendListScrollable(overlay)) {
    return { overlay, sidePanel: null };
  }
  const items = collectExportLegendItems(overlay);
  if (items.length === 0) {
    return { overlay, sidePanel: null };
  }
  return {
    overlay,
    sidePanel: measureLegendSidePanel(
      items,
      readLegendOverlayTitle(overlay),
      maxHeight,
    ),
  };
}

function drawExportLegendMarker(
  ctx: CanvasRenderingContext2D,
  item: Pick<ExportLegendItem, "color" | "kind" | "strokeDasharray">,
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
  layout: LegendSidePanelLayout,
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
    ctx.fillText(row.label, mx + layout.markerW + layout.labelPad, cy);
  }
  ctx.restore();
}

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
  ctx.fillStyle = styles.backgroundColor || LEGEND_OVERLAY_BG;
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

  overlay.querySelectorAll(".ashby-legend-item").forEach((item) => {
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

    if (label) {
      const labelRect = label.getBoundingClientRect();
      const labelStyles = window.getComputedStyle(label);
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

function drawHtmlTitleToContext(
  ctx: CanvasRenderingContext2D,
  root: HTMLElement,
): void {
  const title = root.querySelector(
    ".compare-props-chart-title",
  ) as HTMLElement | null;
  if (!title) {
    return;
  }
  const rootRect = root.getBoundingClientRect();
  const titleRect = title.getBoundingClientRect();
  const styles = window.getComputedStyle(title);
  ctx.save();
  ctx.fillStyle = styles.color || "#242930";
  ctx.font = `${styles.fontWeight || 600} ${styles.fontSize || "15px"} ${
    styles.fontFamily || "system-ui, sans-serif"
  }`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    title.textContent?.trim() ?? "",
    titleRect.left - rootRect.left + titleRect.width / 2,
    titleRect.top - rootRect.top + titleRect.height / 2,
  );
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

  const group = svgEl("g", { class: "chart-legend-export" });
  const styles = window.getComputedStyle(overlay);
  const bg = styles.backgroundColor || LEGEND_OVERLAY_BG;
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
      const line = markerSvg.querySelector("line");
      const color =
        circle?.getAttribute("fill") ||
        line?.getAttribute("stroke") ||
        "#3D5A80";

      group.appendChild(
        svgEl("line", {
          x1: mx + scaleX,
          y1: my + mh / 2,
          x2: mx + mw - scaleX,
          y2: my + mh / 2,
          stroke: color,
          "stroke-width": 2 * scaleX,
          "stroke-linecap": "round",
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

    if (label) {
      const labelRect = label.getBoundingClientRect();
      const labelStyles = window.getComputedStyle(label);
      const labelPadLeft = parseFloat(labelStyles.paddingLeft) || 0;
      const fontSize = (parseFloat(labelStyles.fontSize) || 13) * scaleY;
      const text = svgEl("text", {
        x: screenToSvgX(labelRect.left + labelPadLeft, svgRect, scaleX, vbX),
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

function appendLegendSidePanelSvg(
  parent: SVGElement,
  layout: LegendSidePanelLayout,
  panelX: number,
  panelY: number,
  scaleX: number,
  scaleY: number,
): { width: number; height: number } {
  const width = layout.width * scaleX;
  const height = layout.height * scaleY;
  const group = svgEl("g", { class: "chart-legend-export-side" });
  group.appendChild(
    svgEl("rect", {
      x: panelX,
      y: panelY,
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
    x: panelX + layout.padding * scaleX,
    y: panelY + layout.titleY * scaleY,
    fill: "#242930",
    "font-size": layout.titleFontSize * scaleY,
    "font-weight": "500",
    "font-family": "system-ui, -apple-system, sans-serif",
    "dominant-baseline": "middle",
  });
  title.textContent = layout.title;
  group.appendChild(title);

  for (const row of layout.rows) {
    const mx = panelX + row.x * scaleX;
    const cy = panelY + row.y * scaleY;
    const markerW = layout.markerW * scaleX;
    const color = row.color || "#3D5A80";
    group.appendChild(
      svgEl("line", {
        x1: mx + scaleX,
        y1: cy,
        x2: mx + markerW - scaleX,
        y2: cy,
        stroke: color,
        "stroke-width": 2 * scaleX,
        "stroke-linecap": "round",
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

function appendHtmlTitleToSvg(
  parent: SVGElement,
  root: HTMLElement,
  svgRect: DOMRect,
  scaleX: number,
  scaleY: number,
  vbX: number,
  vbY: number,
): void {
  const title = root.querySelector(
    ".compare-props-chart-title",
  ) as HTMLElement | null;
  if (!title) {
    return;
  }
  const titleRect = title.getBoundingClientRect();
  const styles = window.getComputedStyle(title);
  const fontSize = (parseFloat(styles.fontSize) || 15) * scaleY;
  const text = svgEl("text", {
    x: screenToSvgX(
      titleRect.left + titleRect.width / 2,
      svgRect,
      scaleX,
      vbX,
    ),
    y: screenToSvgY(
      titleRect.top + titleRect.height / 2,
      svgRect,
      scaleY,
      vbY,
    ),
    fill: styles.color || "#242930",
    "font-size": fontSize,
    "font-weight": styles.fontWeight || "600",
    "font-family":
      styles.fontFamily || "system-ui, -apple-system, sans-serif",
    "text-anchor": "middle",
    "dominant-baseline": "middle",
  });
  text.textContent = title.textContent?.trim() ?? "";
  parent.appendChild(text);
}

export async function exportChartWithLegendPng(
  root: HTMLElement,
  filename = "chart.png",
): Promise<void> {
  const svg = root.querySelector("svg") as SVGSVGElement | null;
  if (!svg) {
    return;
  }

  const chartW = root.clientWidth;
  const chartH = root.clientHeight;
  if (chartW <= 0 || chartH <= 0) {
    return;
  }

  const { overlay, sidePanel } = resolveExportLegend(root, chartH);
  const sideGap = sidePanel ? EXPORT_LEGEND_SIDE_GAP : 0;
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

  drawHtmlTitleToContext(ctx, root);

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
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

export function exportChartWithLegendSvg(
  root: HTMLElement,
  filename = "chart.svg",
): void {
  const svg =
    (root.querySelector("svg.recharts-surface") as SVGSVGElement | null) ||
    (root.querySelector("svg") as SVGSVGElement | null);
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

  const { overlay, sidePanel } = resolveExportLegend(root, displayH);

  const ns = "http://www.w3.org/2000/svg";
  const rootSvg = document.createElementNS(ns, "svg");
  rootSvg.setAttribute("xmlns", ns);
  rootSvg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
  rootSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const contentGroup = document.createElementNS(ns, "g");
  contentGroup.setAttribute("class", "chart-export-content");

  const clone = svg.cloneNode(true) as SVGSVGElement;
  while (clone.firstChild) {
    contentGroup.appendChild(clone.firstChild);
  }

  contentGroup
    .querySelectorAll(
      ".recharts-tooltip-cursor, .recharts-cursor, .recharts-brush",
    )
    .forEach((el) => el.remove());

  appendHtmlTitleToSvg(
    contentGroup,
    root,
    svgRect,
    scaleX,
    scaleY,
    vbX,
    vbY,
  );

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
        const gapSvg = EXPORT_LEGEND_SIDE_GAP * scaleX;
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

  rootSvg.removeAttribute("width");
  rootSvg.removeAttribute("height");
  rootSvg.removeAttribute("style");
  rootSvg.setAttribute("viewBox", `0 0 ${finalVbW} ${finalVbH}`);
  rootSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const screenStyle = document.createElementNS(ns, "style");
  screenStyle.textContent =
    "@media screen{" +
    "svg{position:fixed;inset:0;width:100%;height:100%;" +
    "background:#fff}" +
    "}";
  rootSvg.insertBefore(screenStyle, rootSvg.firstChild);

  const serialized = new XMLSerializer().serializeToString(rootSvg);
  const source = `<?xml version="1.0" encoding="UTF-8"?>\n` + serialized;
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
