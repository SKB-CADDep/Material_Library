import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { formatCellValue } from "../lib/formatCellValue";
import { TempCommentIndicator } from "./TempCommentIndicator";
import type {
  TemperatureSelectionColumn,
  TemperatureSelectionRow,
} from "../types/api";

type FrozenColumnKey =
  | "material_name"
  | "strength_category"
  | "source"
  | "max_temp";

const FROZEN_COLUMNS: {
  key: FrozenColumnKey;
  label: string;
  className: string;
  width: number;
}[] = [
  {
    key: "material_name",
    label: "Материал",
    className: "selection-table-col--material",
    width: 220,
  },
  {
    key: "strength_category",
    label: "КП",
    className: "selection-table-col--kp",
    width: 64,
  },
  {
    key: "source",
    label: "НТД",
    className: "selection-table-col--source",
    width: 140,
  },
  {
    key: "max_temp",
    label: "tприм ДО, °C",
    className: "selection-table-col--temp",
    width: 100,
  },
];

const FROZEN_WIDTH = FROZEN_COLUMNS.reduce((sum, col) => sum + col.width, 0);

type SelectionTableProps = {
  scrollColumns: Pick<TemperatureSelectionColumn, "key" | "label">[];
  rows: TemperatureSelectionRow[];
};


function hasTemperatureComment(row:TemperatureSelectionRow): boolean{
  if ((row.temperature_comment ?? "").trim()){
    return true
  }
  return false
}

function getFrozenCellValue(
  row: TemperatureSelectionRow,
  key: FrozenColumnKey,
): string {
  switch (key) {
    case "material_name":
      return row.material_name;
    case "strength_category":
      return row.strength_category || "—";
    case "source":
      return row.source || "—";
    case "max_temp":
      return formatCellValue(row.max_temp);
  }
}

function getRowKey(row: TemperatureSelectionRow, index: number): string {
  const catIdx = row.category_index ?? index;
  const srcKey = row.source_ref_id ?? row.source ?? "";
  return `${row.material_id}-${catIdx}-${srcKey}`;
}

export function SelectionTable({ scrollColumns, rows }: SelectionTableProps) {
  const scrollPaneRef = useRef<HTMLDivElement>(null);
  const hTrackRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLTableElement>(null);
  const syncingRef = useRef(false);
  const [fillsWidth, setFillsWidth] = useState(false);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const [scrollWidth, setScrollWidth] = useState(0);

  useLayoutEffect(() => {
    const pane = scrollPaneRef.current;
    const table = scrollTableRef.current;
    if (!pane || !table) {
      return;
    }

    const measure = () => {
      if (scrollColumns.length === 0) {
        setFillsWidth(false);
        setHasHorizontalScroll(false);
        setScrollWidth(0);
        return;
      }

      const paneWidth = pane.clientWidth;
      const previousWidth = table.style.width;
      table.style.width = "max-content";
      const naturalWidth = table.scrollWidth;
      table.style.width = previousWidth;

      const needsScroll = naturalWidth > paneWidth + 1;

      setFillsWidth(!needsScroll);
      setHasHorizontalScroll(needsScroll);
      setScrollWidth(needsScroll ? naturalWidth : paneWidth);

      if (!needsScroll) {
        pane.scrollLeft = 0;
        if (hTrackRef.current) {
          hTrackRef.current.scrollLeft = 0;
        }
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    observer.observe(table);
    return () => observer.disconnect();
  }, [scrollColumns, rows]);

  const syncScrollLeft = useCallback((source: "pane" | "track", left: number) => {
    if (syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    if (source === "pane" && hTrackRef.current) {
      hTrackRef.current.scrollLeft = left;
    }
    if (source === "track" && scrollPaneRef.current) {
      scrollPaneRef.current.scrollLeft = left;
    }
    syncingRef.current = false;
  }, []);

  const handlePaneScroll = () => {
    if (scrollPaneRef.current) {
      syncScrollLeft("pane", scrollPaneRef.current.scrollLeft);
    }
  };

  const handleTrackScroll = () => {
    if (hTrackRef.current) {
      syncScrollLeft("track", hTrackRef.current.scrollLeft);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!hasHorizontalScroll) {
      return;
    }

    const pane = scrollPaneRef.current;
    if (!pane) {
      return;
    }

    const deltaX = event.deltaX;
    const deltaY = event.deltaY;

    if (deltaX !== 0) {
      event.preventDefault();
      pane.scrollLeft += deltaX;
      syncScrollLeft("pane", pane.scrollLeft);
      return;
    }

    if (event.shiftKey && deltaY !== 0) {
      event.preventDefault();
      pane.scrollLeft += deltaY;
      syncScrollLeft("pane", pane.scrollLeft);
    }
  };

  return (
    <div className="selection-table-container">
      <div className="selection-table-viewport" onWheel={handleWheel}>
        <div className="selection-table-split">
          <div className="selection-table-frozen">
            <table className="data-table selection-table selection-table--frozen">
              <colgroup>
                {FROZEN_COLUMNS.map((col) => (
                  <col key={col.key} style={{ width: col.width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {FROZEN_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`selection-table-col ${col.className}`}
                      title={col.label}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={getRowKey(row, index)}>
                    {FROZEN_COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={col.className}
                        title={
                          col.key === "material_name"
                            ? row.material_name
                            : undefined
                        }
                      >
                        {col.key === "max_temp" ? (
                          !hasTemperatureComment(row) ? (formatCellValue(row.max_temp)) : (
                          <span className="temp-comment-cell">
                            <span className="temp-comment-cell__value">
                              {formatCellValue(row.max_temp)}
                            </span>
                            <TempCommentIndicator
                              comment={(row.temperature_comment ?? "").trim()}
                            />
                          </span>
                        )): (
                        
                        getFrozenCellValue(row, col.key))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            ref={scrollPaneRef}
            className="selection-table-scroll-pane"
            onScroll={handlePaneScroll}
          >
            <table
              ref={scrollTableRef}
              className={`data-table selection-table selection-table--scroll${
                fillsWidth ? " selection-table--fill-width" : ""
              }`}
            >
              <thead>
                <tr>
                  {scrollColumns.map((col) => (
                    <th
                      key={col.key}
                      className="selection-table-col selection-table-col--value"
                      title={col.label}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={getRowKey(row, index)}>
                    {scrollColumns.map((col) => (
                      <td key={col.key} className="selection-table-col--value">
                        {formatCellValue(row.values[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div
        className={`selection-table-hscroll-row${
          hasHorizontalScroll ? "" : " selection-table-hscroll-row--hidden"
        }`}
      >
        <div
          className="selection-table-hscroll-spacer"
          style={{ width: FROZEN_WIDTH }}
          aria-hidden="true"
        />
        <div
          ref={hTrackRef}
          className="selection-table-hscroll-track"
          onScroll={handleTrackScroll}
        >
          <div
            className="selection-table-hscroll-inner"
            style={{ width: scrollWidth }}
          />
        </div>
      </div>
    </div>
  );
}
