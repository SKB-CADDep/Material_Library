import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const COL_EDGE_PX = 8;
const ROW_RAIL_HIT_PX = 28;
const ROW_CELL_EDGE_PX = 20;
const DRAG_THRESHOLD_PX = 2;
const DEFAULT_MIN_COL_WIDTH = 48;
const DEFAULT_MIN_HEADER_HEIGHT = 40;
const DEFAULT_MAX_HEADER_HEIGHT = 240;

const COL_HANDLE_CLASS = "table-col-resize-handle";
const ROW_RAIL_CLASS = "table-header-resize-rail";
const ROW_HANDLE_CLASS = "table-row-resize-handle";

export type HeaderRowResizeMode = "rail" | "cell";

export type ResizableTableHeadersOptions = {
  minColumnWidth?: number;
  minHeaderHeight?: number;
  maxHeaderHeight?: number;
  disabled?: boolean;
  onLayoutChange?: () => void;

  eventRootRef?: RefObject<HTMLElement | null>;

  headerStructureKey?: string;

  headerRowResize?: HeaderRowResizeMode;
};

function recalculateFrozenStickyLeft(table: HTMLTableElement): number {
  const headerRow = table.querySelector(
    "thead tr:not(.table-header-resize-rail-row)",
  );
  if (!headerRow) {
    return 0;
  }

  const frozenThs = Array.from(headerRow.children).filter((cell) =>
    (cell as HTMLElement).classList.contains("selection-table-col--frozen"),
  ) as HTMLElement[];
  if (frozenThs.length === 0) {
    return 0;
  }

  let left = 0;
  frozenThs.forEach((th) => {
    const idx = Array.from(headerRow.children).indexOf(th);
    const width = th.offsetWidth;
    table
      .querySelectorAll("tr:not(.table-header-resize-rail-row)")
      .forEach((tr) => {
        const cell = tr.children[idx] as HTMLElement | undefined;
        if (cell?.classList.contains("selection-table-col--frozen")) {
          cell.style.left = `${left}px`;
        }
      });
    left += width;
  });

  const spacer = table
    .closest(".selection-table-container")
    ?.querySelector(".selection-table-hscroll-spacer") as HTMLElement | undefined;
  if (spacer) {
    spacer.style.width = `${left}px`;
  }

  return left;
}

function recalculateChemPivotStickyLeft(table: HTMLTableElement): void {
  if (!table.classList.contains("chem-comparison-pivot-table")) {
    return;
  }

  const elementCell = table.querySelector(
    "thead th.chem-comparison-pivot-col--element",
  ) as HTMLElement | null;
  if (!elementCell) {
    return;
  }

  const left = elementCell.getBoundingClientRect().width;
  table.querySelectorAll(".chem-comparison-pivot-col--name").forEach((cell) => {
    (cell as HTMLElement).style.left = `${left}px`;
  });
}

function recalculateStickyColumns(table: HTMLTableElement): void {
  recalculateFrozenStickyLeft(table);
  recalculateChemPivotStickyLeft(table);
}

function setCellWidth(cell: HTMLElement, width: number) {
  const px = `${width}px`;
  cell.style.setProperty("width", px, "important");
  cell.style.setProperty("min-width", px, "important");
  cell.style.setProperty("max-width", px, "important");
}

function applyColumnWidth(
  table: HTMLTableElement,
  colIndex: number,
  width: number,
  minColumnWidth: number,
) {
  const nextWidth = Math.max(minColumnWidth, width);
  const cols = table.querySelectorAll("colgroup col");
  if (cols[colIndex]) {
    (cols[colIndex] as HTMLElement).style.width = `${nextWidth}px`;
  }

  table.querySelectorAll("tr").forEach((tr) => {
    const cell = tr.children[colIndex] as HTMLElement | undefined;
    if (cell) {
      setCellWidth(cell, nextWidth);
    }
  });

  table.classList.add("data-table--columns-resized");
  recalculateStickyColumns(table);
}

function applyHeaderHeight(
  table: HTMLTableElement,
  height: number,
  minHeaderHeight: number,
  maxHeaderHeight: number,
) {
  const clamped = Math.min(maxHeaderHeight, Math.max(minHeaderHeight, height));
  const px = `${clamped}px`;

  table.style.setProperty("--table-header-height", px);
  table.classList.add("data-table--header-height-custom");

  table.querySelectorAll("thead tr:not(.table-header-resize-rail-row) th").forEach((th) => {
    const cell = th as HTMLElement;
    cell.style.setProperty("height", px, "important");
    cell.style.setProperty("min-height", px, "important");
    cell.style.setProperty("max-height", px, "important");
    cell.style.setProperty("box-sizing", "border-box");
  });

  syncHeaderHeightVar(table);
}

function clearHeaderHeight(table: HTMLTableElement) {
  table.style.removeProperty("--table-header-height");
  table.classList.remove("data-table--header-height-custom");

  table.querySelectorAll("thead tr:not(.table-header-resize-rail-row) th").forEach((th) => {
    const cell = th as HTMLElement;
    cell.style.removeProperty("height");
    cell.style.removeProperty("min-height");
    cell.style.removeProperty("max-height");
    cell.style.removeProperty("box-sizing");
  });
}

function syncHeaderHeightVar(table: HTMLTableElement) {
  const th = table.querySelector(
    "thead tr:not(.table-header-resize-rail-row) th",
  );
  if (!th) {
    return;
  }
  const height = th.getBoundingClientRect().height;
  if (height > 0) {
    table.style.setProperty("--table-header-height", `${height}px`);
  }
}

function getHeaderRow(thead: Element): HTMLTableRowElement | null {
  return thead.querySelector("tr:not(.table-header-resize-rail-row)");
}

function installResizeHandles(
  table: HTMLTableElement,
  headerRowResize: HeaderRowResizeMode,
) {
  const thead = table.querySelector("thead");
  if (!thead) {
    return;
  }

  const headerRow = getHeaderRow(thead);
  if (!headerRow) {
    return;
  }

  if (headerRowResize === "rail") {
    table.classList.add("data-table--header-row-resize-rail");
  } else {
    table.classList.remove("data-table--header-row-resize-rail");
    thead.querySelector("tr.table-header-resize-rail-row")?.remove();
  }

  headerRow.querySelectorAll("th").forEach((cell) => {
    const th = cell as HTMLElement;
    if (!th.querySelector(`:scope > .${COL_HANDLE_CLASS}`)) {
      const handle = document.createElement("span");
      handle.className = COL_HANDLE_CLASS;
      handle.setAttribute("aria-hidden", "true");
      th.appendChild(handle);
    }

    if (headerRowResize === "cell") {
      if (!th.querySelector(`:scope > .${ROW_HANDLE_CLASS}`)) {
        const rowHandle = document.createElement("span");
        rowHandle.className = ROW_HANDLE_CLASS;
        rowHandle.setAttribute("aria-hidden", "true");
        th.appendChild(rowHandle);
      }
    } else {
      th.querySelectorAll(`:scope > .${ROW_HANDLE_CLASS}`).forEach((legacy) => {
        legacy.remove();
      });
    }
  });

  if (headerRowResize === "rail") {
    const colCount = headerRow.querySelectorAll("th").length;
    let railRow = thead.querySelector("tr.table-header-resize-rail-row") as HTMLTableRowElement | null;
    if (!railRow) {
      railRow = document.createElement("tr");
      railRow.className = "table-header-resize-rail-row";
      railRow.setAttribute("aria-hidden", "true");
      const cell = document.createElement("th");
      cell.className = "table-header-resize-rail-cell";
      cell.colSpan = colCount;
      const rail = document.createElement("div");
      rail.className = ROW_RAIL_CLASS;
      rail.title = "Потяните для изменения высоты шапки";
      cell.appendChild(rail);
      railRow.appendChild(cell);
      thead.appendChild(railRow);
    } else {
      const cell = railRow.querySelector("th.table-header-resize-rail-cell") as HTMLTableCellElement | null;
      if (cell) {
        cell.colSpan = colCount;
      }
    }

    thead.querySelectorAll(`:scope > .${ROW_RAIL_CLASS}`).forEach((legacy) => {
      legacy.remove();
    });
  }

  syncHeaderHeightVar(table);
}

function isRowResizeHit(
  table: HTMLTableElement,
  x: number,
  y: number,
  headerRowResize: HeaderRowResizeMode,
): boolean {
  const thead = table.querySelector("thead");
  if (!thead) {
    return false;
  }

  const headerRow = getHeaderRow(thead);
  if (!headerRow) {
    return false;
  }

  if (headerRowResize === "rail") {
    const rail = thead.querySelector(
      "tr.table-header-resize-rail-row .table-header-resize-rail",
    );
    if (rail) {
      const railRect = rail.getBoundingClientRect();
      if (
        x >= railRect.left &&
        x <= railRect.right &&
        y >= railRect.top &&
        y <= railRect.bottom
      ) {
        return true;
      }
    }

    const theadRect = thead.getBoundingClientRect();
    return (
      y >= theadRect.bottom - 8 &&
      y <= theadRect.bottom + ROW_RAIL_HIT_PX &&
      x >= theadRect.left &&
      x <= theadRect.right
    );
  }

  for (const cell of headerRow.querySelectorAll("th")) {
    const rect = cell.getBoundingClientRect();
    if (
      y >= rect.bottom - ROW_CELL_EDGE_PX &&
      y <= rect.bottom + ROW_CELL_EDGE_PX &&
      x >= rect.left &&
      x <= rect.right
    ) {
      return true;
    }
  }

  const theadRect = thead.getBoundingClientRect();
  return (
    y >= theadRect.bottom - ROW_CELL_EDGE_PX &&
    y <= theadRect.bottom + ROW_CELL_EDGE_PX &&
    x >= theadRect.left &&
    x <= theadRect.right
  );
}

type HeaderHitTestResult =
  | { mode: "col"; th: HTMLTableCellElement; colIndex: number }
  | { mode: "row" }
  | { mode: null };

function hitTestByEdges(
  table: HTMLTableElement,
  event: MouseEvent,
  headerRowResize: HeaderRowResizeMode,
): HeaderHitTestResult {
  const thead = table.querySelector("thead");
  if (!thead) {
    return { mode: null };
  }

  const headerRow = getHeaderRow(thead);
  if (!headerRow) {
    return { mode: null };
  }

  const x = event.clientX;
  const y = event.clientY;
  const rowEdgePx =
    headerRowResize === "rail" ? ROW_RAIL_HIT_PX / 2 : ROW_CELL_EDGE_PX;

  let colHit: {
    th: HTMLTableCellElement;
    colIndex: number;
    dist: number;
  } | null = null;

  const headerCells = headerRow.querySelectorAll("th");
  for (const cell of headerCells) {
    const th = cell as HTMLTableCellElement;
    const rect = th.getBoundingClientRect();

    const inColumnBand = y >= rect.top - 2 && y <= rect.bottom + rowEdgePx;

    if (inColumnBand) {
      const distRight = Math.abs(x - rect.right);
      if (distRight <= COL_EDGE_PX && (!colHit || distRight < colHit.dist)) {
        colHit = {
          th,
          colIndex: Array.from(th.parentElement!.children).indexOf(th),
          dist: distRight,
        };
      }

      const distLeft = Math.abs(x - rect.left);
      const leftColIndex = Array.from(th.parentElement!.children).indexOf(th) - 1;
      if (
        distLeft <= COL_EDGE_PX &&
        leftColIndex >= 0 &&
        (!colHit || distLeft < colHit.dist)
      ) {
        const prevTh = th.parentElement!.children[leftColIndex] as HTMLTableCellElement;
        colHit = {
          th: prevTh,
          colIndex: leftColIndex,
          dist: distLeft,
        };
      }
    }
  }

  const rowHit = isRowResizeHit(table, x, y, headerRowResize);

  if (colHit && rowHit && colHit.dist > 4) {
    colHit = null;
  }

  if (colHit) {
    return {
      mode: "col",
      th: colHit.th,
      colIndex: colHit.colIndex,
    };
  }
  if (rowHit) {
    return { mode: "row" };
  }
  return { mode: null };
}

export function syncFrozenStickyColumns(table: HTMLTableElement): number {
  return recalculateFrozenStickyLeft(table);
}

export function syncChemPivotStickyColumns(table: HTMLTableElement): void {
  recalculateChemPivotStickyLeft(table);
}

export function useResizableTableHeaders(
  tableRef: RefObject<HTMLTableElement | null>,
  options: ResizableTableHeadersOptions = {},
) {
  const {
    minColumnWidth = DEFAULT_MIN_COL_WIDTH,
    minHeaderHeight = DEFAULT_MIN_HEADER_HEIGHT,
    maxHeaderHeight = DEFAULT_MAX_HEADER_HEIGHT,
    disabled = false,
    onLayoutChange,
    eventRootRef,
    headerStructureKey = "",
    headerRowResize = "cell",
  } = options;

  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;
  const headerRowResizeRef = useRef(headerRowResize);
  headerRowResizeRef.current = headerRowResize;

  const [boundTable, setBoundTable] = useState<HTMLTableElement | null>(null);

  useLayoutEffect(() => {
    setBoundTable(tableRef.current);
  });

  useLayoutEffect(() => {
    const table = boundTable;
    if (!table || disabled) {
      return;
    }

    const install = () =>
      installResizeHandles(table, headerRowResizeRef.current);

    install();

    const thead = table.querySelector("thead");
    if (!thead) {
      return;
    }

    const observer = new MutationObserver(install);
    observer.observe(thead, { childList: true, subtree: true });

    const resizeObserver = new ResizeObserver(install);
    resizeObserver.observe(table);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      thead.querySelector("tr.table-header-resize-rail-row")?.remove();
      table.classList.remove("data-table--header-row-resize-rail");
    };
  }, [boundTable, disabled, headerStructureKey, headerRowResize]);

  useEffect(() => {
    const table = boundTable;
    if (!table || disabled) {
      return;
    }

    const eventRoot = eventRootRef?.current ?? table;
    table.classList.add("data-table--resizable-headers");

    let mode: "col" | "row" | null = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let activeColIndex = -1;
    let dragDelta = 0;
    let suppressNextClick = false;

    const notifyLayoutChange = () => {
      onLayoutChangeRef.current?.();
    };

    const getHeaderHeight = (): number => {
      const th = table.querySelector(
        "thead tr:not(.table-header-resize-rail-row) th",
      );
      return th?.getBoundingClientRect().height ?? minHeaderHeight;
    };

    const beginColResize = (
      event: MouseEvent,
      th: HTMLTableCellElement,
      colIndex: number,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      mode = "col";
      activeColIndex = colIndex;
      startX = event.clientX;
      startWidth = th.getBoundingClientRect().width;
      dragDelta = 0;
      suppressNextClick = false;
      table.style.tableLayout = "fixed";
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    };

    const beginRowResize = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      mode = "row";
      startY = event.clientY;
      startHeight = getHeaderHeight();
      dragDelta = 0;
      suppressNextClick = false;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    };

    const onPointerDown = (event: MouseEvent) => {
      if (event.button !== 0 || mode) {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest(`.${COL_HANDLE_CLASS}`)) {
        const th = target.closest("th") as HTMLTableCellElement | null;
        if (!th) {
          return;
        }
        const colIndex = Array.from(th.parentElement!.children).indexOf(th);
        beginColResize(event, th, colIndex);
        return;
      }

      if (target.closest(`.${ROW_RAIL_CLASS}`)) {
        beginRowResize(event);
        return;
      }

      if (target.closest(`.${ROW_HANDLE_CLASS}`)) {
        beginRowResize(event);
        return;
      }

      const hit = hitTestByEdges(table, event, headerRowResizeRef.current);
      if (hit.mode === "col" && hit.th && hit.colIndex !== undefined) {
        beginColResize(event, hit.th, hit.colIndex);
      } else if (hit.mode === "row") {
        beginRowResize(event);
      }
    };

    const onDocumentMouseMove = (event: MouseEvent) => {
      if (mode === "col" && activeColIndex >= 0) {
        const delta = event.clientX - startX;
        dragDelta = Math.max(dragDelta, Math.abs(delta));
        applyColumnWidth(
          table,
          activeColIndex,
          startWidth + delta,
          minColumnWidth,
        );
        return;
      }

      if (mode === "row") {
        const delta = event.clientY - startY;
        dragDelta = Math.max(dragDelta, Math.abs(delta));
        applyHeaderHeight(
          table,
          startHeight + delta,
          minHeaderHeight,
          maxHeaderHeight,
        );
        return;
      }

      const hit = hitTestByEdges(table, event, headerRowResizeRef.current);
      document.body.style.cursor =
        hit.mode === "col"
          ? "col-resize"
          : hit.mode === "row"
            ? "row-resize"
            : "";
    };

    const onDocumentMouseUp = () => {
      if (!mode) {
        return;
      }

      const didDrag = dragDelta >= DRAG_THRESHOLD_PX;
      if (didDrag) {
        suppressNextClick = true;
        notifyLayoutChange();
      }

      mode = null;
      activeColIndex = -1;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressNextClick) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      suppressNextClick = false;
    };

    eventRoot.addEventListener("mousedown", onPointerDown, true);
    table.addEventListener("click", onClickCapture, true);
    document.addEventListener("mousemove", onDocumentMouseMove);
    document.addEventListener("mouseup", onDocumentMouseUp);

    return () => {
      eventRoot.removeEventListener("mousedown", onPointerDown, true);
      table.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("mousemove", onDocumentMouseMove);
      document.removeEventListener("mouseup", onDocumentMouseUp);
      table.classList.remove("data-table--resizable-headers");
      clearHeaderHeight(table);
      table.style.cursor = "";
      table.style.removeProperty("table-layout");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [
    boundTable,
    disabled,
    minColumnWidth,
    minHeaderHeight,
    maxHeaderHeight,
    eventRootRef,
    headerStructureKey,
    headerRowResize,
  ]);
}
