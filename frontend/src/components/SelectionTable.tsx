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
    label: "tприм ДО",
    className: "selection-table-col--temp",
    width: 100,
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

export function SelectionTable({
  scrollColumns,
  rows,
  unitConfigs = {},
  columnUnits = {},
  onColumnUnitChange,
  sortState,
  onSortColumn,
}: SelectionTableProps) {
  const scrollPaneRef = useRef<HTMLDivElement>(null);
  const hTrackRef = useRef<HTMLDivElement>(null);
  const scrollTableRef = useRef<HTMLTableElement>(null);
  const syncingRef = useRef(false);
  const [fillsWidth, setFillsWidth] = useState(false);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [unitMenu, setUnitMenu] = useState<UnitMenuState | null>(null);
  const [cellContextMenu, setCellContextMenu] =
    useState<CellContextMenuState | null>(null);

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
    <>
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
                          className={[
                            "selection-table-col",
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
                        className={[
                          "selection-table-col",
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
                    const title = unitLabel
                      ? `${symbol}, ${unitLabel}`
                      : symbol;
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

    {unitMenu && unitMenu.col.unit_type && onColumnUnitChange && (
      <ColumnUnitContextMenu
        x={unitMenu.x}
        y={unitMenu.y}
        columnLabel={calculationColumnSymbol(unitMenu.col)}
        units={unitConfigs[unitMenu.col.unit_type]?.units ?? []}
        currentUnit={columnUnits[unitMenu.col.key] ?? unitMenu.col.unit}
        displayLabels={
          unitConfigs[unitMenu.col.unit_type]?.display_labels
        }
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
