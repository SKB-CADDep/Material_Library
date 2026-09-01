import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
import {
  renderSortIndicator,
  sortableHeaderProps,
} from "../lib/tableSortHeader";
import { formatScientificPlain, ScientificText } from "../lib/scientificNotation";
import { ColumnUnitContextMenu } from "./ColumnUnitContextMenu";
import { SelectionCellContextMenu } from "./SelectionCellContextMenu";
import { TempCommentIndicator } from "./TempCommentIndicator";
import { useResizableTableHeaders, syncFrozenStickyColumns } from "../hooks/useResizableTableHeaders";
import { ALL_NTD_FILTER } from "../lib/ntdFilter";
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
    label: "Маркировка",
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
    label: "Нормативно-техническая документация",
    className: "selection-table-col--source",
    width: 220,
    stickyLeft: 284,
  },
  {
    key: "max_temp",
    label: "tприм ДО",
    className: "selection-table-col--temp",
    width: 100,
    stickyLeft: 504,
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

type NtdHeaderFilter = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

type SelectionTableProps = {
  scrollColumns: TemperatureSelectionColumn[];
  rows: TemperatureSelectionRow[];
  unitConfigs?: Record<string, UnitResponse>;
  columnUnits?: Record<string, string>;
  onColumnUnitChange?: (columnKey: string, unit: string) => void;
  sortState?: SelectionSortState;
  onSortColumn?: (column: SelectionSortColumn) => void;
  ntdFilter?: NtdHeaderFilter;
  emptyFilterMessage?: string;
};

function frozenCellStyle(
  col: (typeof FROZEN_COLUMNS)[number],
  columnsResized: boolean,
): CSSProperties | undefined {
  if (columnsResized) {
    return undefined;
  }
  return {
    left: col.stickyLeft,
    width: col.width,
    minWidth: col.width,
    maxWidth: col.width,
  };
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
    <span className="calculation-table-header" title={formatScientificPlain(fullTitle)}>
      <span className="calculation-table-header__text">
        <span className="calculation-table-header__symbol">
          <ScientificText>{symbol}</ScientificText>
        </span>
        {unitLabel && (
          <span className="calculation-table-header__unit">
            <ScientificText>{unitLabel}</ScientificText>
          </span>
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
  ntdFilter,
  emptyFilterMessage,
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
  const [layoutTick, setLayoutTick] = useState(0);
  const [columnsResized, setColumnsResized] = useState(false);

  const scrollColumnKeys = scrollColumns.map((col) => col.key).join("|");

  useResizableTableHeaders(tableRef, {
    eventRootRef: viewportRef,
    headerStructureKey: scrollColumnKeys,
    onLayoutChange: () => {
      setColumnsResized(true);
      setLayoutTick((value) => value + 1);
    },
  });

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

  useEffect(() => {
    setColumnsResized(false);
    const table = tableRef.current;
    if (!table) {
      return;
    }
    table.classList.remove("data-table--columns-resized");
    table.style.removeProperty("table-layout");
    table.style.removeProperty("width");
    table.style.removeProperty("min-width");
    table.querySelectorAll("colgroup col").forEach((col) => {
      (col as HTMLElement).style.removeProperty("width");
    });
    table.querySelectorAll("th, td").forEach((cell) => {
      const el = cell as HTMLElement;
      el.style.removeProperty("width");
      el.style.removeProperty("min-width");
      el.style.removeProperty("max-width");
      el.style.removeProperty("left");
    });
  }, [scrollColumnKeys]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const table = tableRef.current;
    if (!viewport || !table) {
      return;
    }

    const clearMeasuredStickyLeft = () => {
      table.querySelectorAll(".selection-table-col--frozen").forEach((cell) => {
        (cell as HTMLElement).style.removeProperty("left");
      });
    };

    const measure = () => {
      if (scrollColumns.length === 0) {
        setFillsWidth(false);
        setHasHorizontalScroll(false);
        setScrollWidth(0);
        return;
      }

      const viewportWidth = viewport.clientWidth;
      const isResized = table.classList.contains("data-table--columns-resized");

      const previousWidth = table.style.width;
      const previousLayout = table.style.tableLayout;
      const previousMinWidth = table.style.minWidth;
      table.style.tableLayout = "fixed";
      table.style.minWidth = "0";
      table.style.width = "max-content";

      const naturalWidth = table.scrollWidth;
      const measuredFrozenWidth = isResized
        ? syncFrozenStickyColumns(table)
        : FROZEN_WIDTH;

      if (!isResized) {
        clearMeasuredStickyLeft();
      }

      table.style.width = previousWidth;
      table.style.tableLayout = previousLayout;
      table.style.minWidth = previousMinWidth;

      const frozenPart =
        measuredFrozenWidth > 0 ? measuredFrozenWidth : FROZEN_WIDTH;
      const needsScroll = naturalWidth > viewportWidth + 1;

      setFrozenWidth(frozenPart);
      setFillsWidth(!needsScroll && !isResized);
      setHasHorizontalScroll(needsScroll);
      setScrollWidth(
        needsScroll
          ? Math.max(0, naturalWidth - frozenPart)
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
    return () => observer.disconnect();
  }, [scrollColumnKeys, rows, columnUnits, sortState, unitConfigs, layoutTick]);

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
    fillsWidth && !columnsResized ? " selection-table--fill-width" : ""
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
                <col key={col.key} style={{ width: 88 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {FROZEN_COLUMNS.map((col) => {
                  const header = sortableHeaderProps(
                    onSortColumn ? () => onSortColumn(col.key) : undefined,
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
                          "selection-table-col--frozen",
                          col.className,
                          header.className,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={frozenCellStyle(col, columnsResized)}
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

                  if (col.key === "source" && ntdFilter) {
                    return (
                      <th
                        key={col.key}
                        className={[
                          "selection-table-col",
                          "selection-table-col--frozen",
                          "selection-table-col--ntd-filter",
                          col.className,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        title={col.label}
                      >
                        <div className="selection-ntd-header">
                          <span
                            className={[
                              "selection-ntd-header__title",
                              header.className,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            title={header.title ?? col.label}
                            onClick={header.onClick}
                          >
                            {col.label}
                            {renderSortIndicator(col.key, sortState)}
                          </span>
                          <select
                            id="ntd-filter-select"
                            className="selection-ntd-header__filter"
                            data-tour="temp-ntd"
                            aria-label="Фильтр по НТД"
                            value={ntdFilter.value}
                            onChange={(event) => ntdFilter.onChange(event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            disabled={ntdFilter.options.length === 0}
                            title={
                              ntdFilter.options.length === 0
                                ? "Нет данных для фильтрации по НТД"
                                : "Фильтр по НТД"
                            }
                          >
                            <option value={ALL_NTD_FILTER}>Все</option>
                            {ntdFilter.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      </th>
                    );
                  }

                  return (
                    <th
                      key={col.key}
                      className={[
                        "selection-table-col",
                        "selection-table-col--frozen",
                        col.className,
                        header.className,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={frozenCellStyle(col, columnsResized)}
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
                    onSortColumn ? () => onSortColumn(col.key) : undefined,
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
                          ? `${header.title ?? title}. ПКМ — смена единицы измерения`
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
              {rows.length === 0 && emptyFilterMessage ? (
                <tr>
                  <td
                    className="selection-table-empty"
                    colSpan={FROZEN_COLUMNS.length + scrollColumns.length}
                  >
                    {emptyFilterMessage}
                  </td>
                </tr>
              ) : null}
              {rows.map((row, index) => (
                <tr key={getRowKey(row, index)}>
                  {FROZEN_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        col.className,
                        "selection-table-col--frozen",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={frozenCellStyle(col, columnsResized)}
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
