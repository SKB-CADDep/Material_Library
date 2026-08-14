import { useEffect, useRef, type RefObject } from "react";

const COL_EDGE_PX = 8;
const ROW_EDGE_PX = 10;
const DRAG_THRESHOLD_PX = 2;
const DEFAULT_MIN_COL_WIDTH = 48;
const DEFAULT_MIN_HEADER_HEIGHT = 40;
const DEFAULT_MAX_HEADER_HEIGHT = 240;

export type ResizableTableHeadersOptions = {
  minColumnWidth?: number;
  minHeaderHeight?: number;
  maxHeaderHeight?: number;
  disabled?: boolean;
  onLayoutChange?: () => void;
};

function recalculateFrozenStickyLeft(table: HTMLTableElement): number {
  const frozenThs = table.querySelectorAll("thead th.selection-table-col--frozen");
  if (frozenThs.length === 0) {
    return 0;
  }

  let left = 0;
  frozenThs.forEach((th) => {
    const el = th as HTMLElement;
    const idx = Array.from(el.parentElement!.children).indexOf(el);
    const width = el.getBoundingClientRect().width;
    table.querySelectorAll("tr").forEach((tr) => {
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
  notifyLayoutChange: () => void,
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
  recalculateFrozenStickyLeft(table);
  notifyLayoutChange();
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

  table.querySelectorAll("thead th").forEach((th) => {
    const cell = th as HTMLElement;
    cell.style.setProperty("height", px, "important");
    cell.style.setProperty("min-height", px, "important");
    cell.style.setProperty("max-height", px, "important");
    cell.style.setProperty("box-sizing", "border-box");
  });
}

function clearHeaderHeight(table: HTMLTableElement) {
  table.style.removeProperty("--table-header-height");
  table.classList.remove("data-table--header-height-custom");

  table.querySelectorAll("thead th").forEach((th) => {
    const cell = th as HTMLElement;
    cell.style.removeProperty("height");
    cell.style.removeProperty("min-height");
    cell.style.removeProperty("max-height");
    cell.style.removeProperty("box-sizing");
  });
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
  } = options;

  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  useEffect(() => {
    const table = tableRef.current;
    if (!table || disabled) {
      return;
    }

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
      const th = table.querySelector("thead th");
      return th?.getBoundingClientRect().height ?? minHeaderHeight;
    };

    const hitTest = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const th = target.closest("th");
      const thead = table.querySelector("thead");
      if (!th || !thead?.contains(th)) {
        return { mode: null as null };
      }

      const rect = th.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const nearRight = offsetX >= rect.width - COL_EDGE_PX;
      const nearBottom = offsetY >= rect.height - ROW_EDGE_PX;

      if (nearRight) {
        return {
          mode: "col" as const,
          th: th as HTMLTableCellElement,
          colIndex: Array.from(th.parentElement!.children).indexOf(th),
        };
      }
      if (nearBottom) {
        return { mode: "row" as const };
      }
      return { mode: null };
    };

    const onMouseMove = (event: MouseEvent) => {
      if (mode) {
        return;
      }

      const hit = hitTest(event);
      if (hit.mode === "col") {
        table.style.cursor = "col-resize";
      } else if (hit.mode === "row") {
        table.style.cursor = "row-resize";
      } else {
        table.style.cursor = "";
      }
    };

    const onMouseLeave = () => {
      if (!mode) {
        table.style.cursor = "";
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      const hit = hitTest(event);
      if (!hit.mode) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      dragDelta = 0;
      suppressNextClick = false;

      if (hit.mode === "col" && hit.th && hit.colIndex !== undefined) {
        mode = "col";
        activeColIndex = hit.colIndex;
        startX = event.clientX;
        startWidth = hit.th.getBoundingClientRect().width;
        table.style.tableLayout = "fixed";
      } else if (hit.mode === "row") {
        mode = "row";
        startY = event.clientY;
        startHeight = getHeaderHeight();
      }

      document.body.style.userSelect = "none";
    };

    const onDocumentMouseMove = (event: MouseEvent) => {
      if (!mode) {
        return;
      }

      if (mode === "col" && activeColIndex >= 0) {
        const delta = event.clientX - startX;
        dragDelta = Math.max(dragDelta, Math.abs(delta));
        applyColumnWidth(
          table,
          activeColIndex,
          startWidth + delta,
          minColumnWidth,
          notifyLayoutChange,
        );
      } else if (mode === "row") {
        const delta = event.clientY - startY;
        dragDelta = Math.max(dragDelta, Math.abs(delta));
        applyHeaderHeight(
          table,
          startHeight + delta,
          minHeaderHeight,
          maxHeaderHeight,
        );
        notifyLayoutChange();
      }
    };

    const onDocumentMouseUp = () => {
      if (!mode) {
        return;
      }

      if (dragDelta >= DRAG_THRESHOLD_PX) {
        suppressNextClick = true;
      }

      mode = null;
      activeColIndex = -1;
      document.body.style.userSelect = "";
      table.style.cursor = "";
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

    table.addEventListener("mousemove", onMouseMove);
    table.addEventListener("mouseleave", onMouseLeave);
    table.addEventListener("mousedown", onMouseDown, true);
    table.addEventListener("click", onClickCapture, true);
    document.addEventListener("mousemove", onDocumentMouseMove);
    document.addEventListener("mouseup", onDocumentMouseUp);

    return () => {
      table.removeEventListener("mousemove", onMouseMove);
      table.removeEventListener("mouseleave", onMouseLeave);
      table.removeEventListener("mousedown", onMouseDown, true);
      table.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("mousemove", onDocumentMouseMove);
      document.removeEventListener("mouseup", onDocumentMouseUp);
      table.classList.remove(
        "data-table--resizable-headers",
        "data-table--columns-resized",
      );
      clearHeaderHeight(table);
      table.style.cursor = "";
      table.style.removeProperty("table-layout");
      document.body.style.userSelect = "";
    };
  }, [tableRef, disabled, minColumnWidth, minHeaderHeight, maxHeaderHeight]);
}
