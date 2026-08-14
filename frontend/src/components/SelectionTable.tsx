import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  calculationColumnSymbol,
  calculationColumnUnitLabel,
  TEMPERATURE_UNIT_TYPE,
} from "../lib/calculationColumnHeader";
import { copyToClipboard } from "../lib/copyToClipboard";
import { getSelectionCellDisplayText } from "../lib/formatSelectionCellValue";
import type {
  SelectionSortColumn,
  SelectionSortState,
} from "../lib/sortSelectionRows";
import { ColumnUnitContextMenu } from "./ColumnUnitContextMenu";
import { SelectionCellContextMenu } from "./SelectionCellContextMenu";
import { TempCommentIndicator } from "./TempCommentIndicator";
import { useResizableTableHeaders } from "../hooks/useResizableTableHeaders";
import type {
  TemperatureSelectionColumn,
  TemperatureSelectionRow,
  UnitResponse,
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
  stickyLeft: number;
}[] = [
  {
    key: "material_name",
    label: "Материал",
    className: "selection-table-col--material",
    width: 220,
    stickyLeft: 0,
  },
  {
    key: "strength_category",
    label: "КП",
    className: "selection-table-col--kp",
    width: 64,
    stickyLeft: 220,
  },
  {
    key: "source",
    label: "НТД",
    className: "selection-table-col--source",
    width: 140,
    stickyLeft: 284,
  },
  {
    key: "max_temp",
    label: "tприм ДО",
    className: "selection-table-col--temp",
    width: 100,
    stickyLeft: 424,
  },
];

const FROZEN_WIDTH = FROZEN_COLUMNS.reduce((sum, col) => sum + col.width, 0);

type UnitMenuState = {
  col: TemperatureSelectionColumn;
  x: number;
  y: number;
};

type CellContextMenuState = {
  rowIndex: number;
  column: SelectionSortColumn;
  x: number;
  y: number;
};

type SelectionTableProps = {
  scrollColumns: TemperatureSelectionColumn[];
  rows: TemperatureSelectionRow[];
  unitConfigs?: Record<string, UnitResponse>;
  columnUnits?: Record<string, string>;
  onColumnUnitChange?: (columnKey: string, unit: string) => void;
  sortState?: SelectionSortState;
  onSortColumn?: (column: SelectionSortColumn) => void;
};

function sortableHeaderProps(
  column: SelectionSortColumn,
  onSortColumn: SelectionTableProps["onSortColumn"],
  defaultTitle?: string,
) {
  if (!onSortColumn) {
    return {
      className: "",
      title: defaultTitle,
      onClick: undefined,
    };
  }

  return {
    className: "sortable",
    title: "Сортировать",
    onClick: () => onSortColumn(column),
  };
}

function renderSortIndicator(
  column: SelectionSortColumn,
  sortState: SelectionSortState | undefined,
) {
  if (!sortState || sortState.column !== column) {
    return null;
  }

  return (
    <span className="sort-indicator active" aria-hidden="true">
      {sortState.direction === "asc" ? "▲" : "▼"}
    </span>
  );
}

function hasTemperatureComment(row: TemperatureSelectionRow): boolean {
  return Boolean((row.temperature_comment ?? "").trim());
}

function getRowKey(row: TemperatureSelectionRow, index: number): string {
  const catIdx = row.category_index ?? index;
  const srcKey = row.source_ref_id ?? row.source ?? "";
  return `${row.material_id}-${catIdx}-${srcKey}`;
}

function renderColumnHeader(
  symbol: string,
  unitLabel: string,
  title?: string,
) {
  const fullTitle = title ?? (unitLabel ? `${symbol}, ${unitLabel}` : symbol);

  return (
    <span className="calculation-table-header" title={fullTitle}>
      <span className="calculation-table-header__text">
        <span className="calculation-table-header__symbol">{symbol}</span>
        {unitLabel && (
          <span className="calculation-table-header__unit">{unitLabel}</span>
        )}
      </span>
    </span>
  );
}

function frozenCellStyle(col: (typeof FROZEN_COLUMNS)[number]) {
  return { left: col.stickyLeft };
}

export function SelectionTable({
  scrollColumns,
  rows,
  unitConfigs = {},
  columnUnits = {},
  onColumnUnitChange,
  sortState,
  onSortColumn,
}: SelectionTableProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hTrackRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const syncingRef = useRef(false);
  const [fillsWidth, setFillsWidth] = useState(false);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [unitMenu, setUnitMenu] = useState<UnitMenuState | null>(null);
  const [cellContextMenu, setCellContextMenu] =
    useState<CellContextMenuState | null>(null);
  const [frozenWidth, setFrozenWidth] = useState(FROZEN_WIDTH);

  useResizableTableHeaders(tableRef);

  const copyCellAt = useCallback(
    async (rowIndex: number, column: SelectionSortColumn) => {
      const row = rows[rowIndex];
      if (!row) {
        return;
      }

      const text = getSelectionCellDisplayText(
        row,
        column,
        scrollColumns,
        columnUnits,
        unitConfigs,
      );

      try {
        await copyToClipboard(text);
      } catch {
        // Браузер может отклонить clipboard без user gesture.
      }
    },
    [rows, scrollColumns, columnUnits, unitConfigs],
  );

  const handleCellContextMenu = (
    event: React.MouseEvent,
    rowIndex: number,
    column: SelectionSortColumn,
  ) => {
    event.preventDefault();
    setUnitMenu(null);
    setCellContextMenu({
      rowIndex,
      column,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const temperatureUnitConfig = unitConfigs[TEMPERATURE_UNIT_TYPE];
  const temperatureUnitLabel = calculationColumnUnitLabel(
    temperatureUnitConfig?.system_unit ?? "C",
    temperatureUnitConfig,
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const table = tableRef.current;
    if (!viewport || !table) {
      return;
    }

    const measure = () => {
      if (scrollColumns.length === 0) {
        setFillsWidth(false);
        setHasHorizontalScroll(false);
        setScrollWidth(0);
        return;
      }

      const viewportWidth = viewport.clientWidth;
      const previousWidth = table.style.width;
      const previousLayout = table.style.tableLayout;
      table.style.tableLayout = "auto";
      table.style.width = "max-content";
      const naturalWidth = table.scrollWidth;
      table.style.width = previousWidth;
      table.style.tableLayout = previousLayout;

      const needsScroll = naturalWidth > viewportWidth + 1;

      let measuredFrozenWidth = 0;
      table.querySelectorAll("thead th.selection-table-col--frozen").forEach((th) => {
        measuredFrozenWidth += th.getBoundingClientRect().width;
      });
      if (measuredFrozenWidth <= 0) {
        measuredFrozenWidth = FROZEN_WIDTH;
      }
      setFrozenWidth(measuredFrozenWidth);

      setFillsWidth(!needsScroll);
      setHasHorizontalScroll(needsScroll);
      setScrollWidth(
        needsScroll
          ? Math.max(0, naturalWidth - measuredFrozenWidth)
          : viewportWidth,
      );

      if (!needsScroll) {
        viewport.scrollLeft = 0;
        if (hTrackRef.current) {
          hTrackRef.current.scrollLeft = 0;
        }
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(table);
    return () => observer.disconnect();
  }, [scrollColumns, rows, columnUnits, sortState, unitConfigs]);

  const syncScrollLeft = useCallback((source: "viewport" | "track", left: number) => {
    if (syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    if (source !== "track" && hTrackRef.current) {
      hTrackRef.current.scrollLeft = left;
    }
    if (source !== "viewport" && viewportRef.current) {
      viewportRef.current.scrollLeft = left;
    }
    syncingRef.current = false;
  }, []);

  const handleViewportScroll = () => {
    if (viewportRef.current) {
      syncScrollLeft("viewport", viewportRef.current.scrollLeft);
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

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const deltaX = event.deltaX;
    const deltaY = event.deltaY;

    if (deltaX !== 0) {
      event.preventDefault();
      viewport.scrollLeft += deltaX;
      syncScrollLeft("viewport", viewport.scrollLeft);
      return;
    }

    if (event.shiftKey && deltaY !== 0) {
      event.preventDefault();
      viewport.scrollLeft += deltaY;
      syncScrollLeft("viewport", viewport.scrollLeft);
    }
  };

  const tableClassName = `data-table selection-table selection-table--unified${
    fillsWidth ? " selection-table--fill-width" : ""
  }`;

  return (
    <>
      <div className="selection-table-container">
        <div
          ref={viewportRef}
          className="selection-table-viewport selection-table-viewport--unified"
          onScroll={handleViewportScroll}
          onWheel={handleWheel}
        >
          <table ref={tableRef} className={tableClassName}>
            <colgroup>
              {FROZEN_COLUMNS.map((col) => (
                <col key={col.key} style={{ width: col.width }} />
              ))}
              {scrollColumns.map((col) => (
                <col key={col.key} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {FROZEN_COLUMNS.map((col) => {
                  const header = sortableHeaderProps(
                    col.key,
                    onSortColumn,
                    col.label,
                  );

                  if (col.key === "max_temp") {
                    const title = temperatureUnitLabel
                      ? `${col.label}, ${temperatureUnitLabel}`
                      : col.label;

                    return (
                      <th
                        key={col.key}
                        style={frozenCellStyle(col)}
                        className={[
                          "selection-table-col",
                          "selection-table-col--frozen",
                          col.className,
                          header.className,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        title={onSortColumn ? header.title : title}
                        onClick={header.onClick}
                      >
                        {renderColumnHeader(
                          col.label,
                          temperatureUnitLabel || "°C",
                        )}
                        {renderSortIndicator(col.key, sortState)}
                      </th>
                    );
                  }

                  return (
                    <th
                      key={col.key}
                      style={frozenCellStyle(col)}
                      className={[
                        "selection-table-col",
                        "selection-table-col--frozen",
                        col.className,
                        header.className,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={header.title ?? col.label}
                      onClick={header.onClick}
                    >
                      {col.label}
                      {renderSortIndicator(col.key, sortState)}
                    </th>
                  );
                })}
                {scrollColumns.map((col) => {
                  const symbol = calculationColumnSymbol(col);
                  const unitConfig = col.unit_type
                    ? unitConfigs[col.unit_type]
                    : undefined;
                  const displayUnit = columnUnits[col.key] ?? col.unit ?? "";
                  const unitLabel = calculationColumnUnitLabel(
                    displayUnit,
                    unitConfig,
                  );
                  const title = unitLabel ? `${symbol}, ${unitLabel}` : symbol;
                  const header = sortableHeaderProps(
                    col.key,
                    onSortColumn,
                    title,
                  );
                  const canChangeUnit = Boolean(
                    col.unit_type && unitConfig && onColumnUnitChange,
                  );

                  return (
                    <th
                      key={col.key}
                      className={[
                        "selection-table-col",
                        "selection-table-col--value",
                        "calculation-table-col--value",
                        header.className,
                        canChangeUnit ? "calculation-table-col--unit-switch" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={
                        canChangeUnit
                          ? "ПКМ — смена единицы измерения"
                          : header.title ?? title
                      }
                      onClick={header.onClick}
                      onContextMenu={(event) => {
                        if (!canChangeUnit || !unitConfig) {
                          return;
                        }
                        event.preventDefault();
                        setCellContextMenu(null);
                        setUnitMenu({
                          col,
                          x: event.clientX,
                          y: event.clientY,
                        });
                      }}
                    >
                      {renderColumnHeader(symbol, unitLabel, title)}
                      {renderSortIndicator(col.key, sortState)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={getRowKey(row, index)}>
                  {FROZEN_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      style={frozenCellStyle(col)}
                      className={[
                        col.className,
                        "selection-table-col--frozen",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={
                        col.key === "material_name"
                          ? row.material_name
                          : undefined
                      }
                      onContextMenu={(event) =>
                        handleCellContextMenu(event, index, col.key)
                      }
                    >
                      {col.key === "max_temp" ? (
                        !hasTemperatureComment(row) ? (
                          getSelectionCellDisplayText(
                            row,
                            col.key,
                            scrollColumns,
                            columnUnits,
                            unitConfigs,
                          )
                        ) : (
                          <span className="temp-comment-cell">
                            <span className="temp-comment-cell__value">
                              {getSelectionCellDisplayText(
                                row,
                                col.key,
                                scrollColumns,
                                columnUnits,
                                unitConfigs,
                              )}
                            </span>
                            <TempCommentIndicator
                              comment={(row.temperature_comment ?? "").trim()}
                            />
                          </span>
                        )
                      ) : (
                        getSelectionCellDisplayText(
                          row,
                          col.key,
                          scrollColumns,
                          columnUnits,
                          unitConfigs,
                        )
                      )}
                    </td>
                  ))}
                  {scrollColumns.map((col) => (
                    <td
                      key={col.key}
                      className="selection-table-col--value"
                      onContextMenu={(event) =>
                        handleCellContextMenu(event, index, col.key)
                      }
                    >
                      {getSelectionCellDisplayText(
                        row,
                        col.key,
                        scrollColumns,
                        columnUnits,
                        unitConfigs,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className={`selection-table-hscroll-row${
            hasHorizontalScroll ? "" : " selection-table-hscroll-row--hidden"
          }`}
        >
          <div
            className="selection-table-hscroll-spacer"
            style={{ width: frozenWidth }}
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

      {unitMenu && unitMenu.col.unit_type && onColumnUnitChange && (
        <ColumnUnitContextMenu
          x={unitMenu.x}
          y={unitMenu.y}
          columnLabel={calculationColumnSymbol(unitMenu.col)}
          units={unitConfigs[unitMenu.col.unit_type]?.units ?? []}
          currentUnit={columnUnits[unitMenu.col.key] ?? unitMenu.col.unit}
          displayLabels={unitConfigs[unitMenu.col.unit_type]?.display_labels}
          onSelect={(unit) => onColumnUnitChange(unitMenu.col.key, unit)}
          onClose={() => setUnitMenu(null)}
        />
      )}
      {cellContextMenu && (
        <SelectionCellContextMenu
          x={cellContextMenu.x}
          y={cellContextMenu.y}
          onCopy={() =>
            void copyCellAt(cellContextMenu.rowIndex, cellContextMenu.column)
          }
          onClose={() => setCellContextMenu(null)}
        />
      )}
    </>
  );
}
