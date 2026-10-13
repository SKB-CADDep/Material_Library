import { useEffect, useMemo, useRef, useState } from "react";

import type {

  CalculationCell,

  SingleCalculationColumn,

  SingleCalculationRow,

  UnitResponse,

} from "../types/api";

import {
  calculationColumnSymbol,
  calculationColumnUnitLabel,
  TEMPERATURE_UNIT_TYPE,
} from "../lib/calculationColumnHeader";

import {
  calculationCellInDisplayUnit,
  calculationCellModeClass,
  calculationCellModeTitle,
  formatCalculationCell,
} from "../lib/formatCalculationCell";

import type { CalculationColumnSourceRef } from "../lib/calculationColumnSources";

import { AcceptanceIndicator } from "./AcceptanceIndicator";

import { ColumnUnitContextMenu } from "./ColumnUnitContextMenu";

import { TempCommentIndicator } from "./TempCommentIndicator";

import { formatScientificPlain, ScientificText } from "../lib/scientificNotation";
import { useResizableTableHeaders } from "../hooks/useResizableTableHeaders";
import {
  sortCalculationRows,
  type CalculationSortColumn,
  type CalculationSortState,
} from "../lib/sortCalculationRows";
import { toggleSortDirection } from "../lib/sortSelectionRows";
import { renderSortIndicator, sortableHeaderProps } from "../lib/tableSortHeader";



type UnitMenuState = {

  col: SingleCalculationColumn;

  x: number;

  y: number;

};



type CalculationTableProps = {

  columns: SingleCalculationColumn[];

  dbRows: SingleCalculationRow[];

  customRows?: SingleCalculationRow[];

  columnComments?: Record<string, string>;

  columnSourceRefs?: Record<string, CalculationColumnSourceRef>;

  onSourceRefClick?: (ref: CalculationColumnSourceRef) => void;

  columnAcceptance?: Set<string>;

  columnUnits?: Record<string, string>;

  unitConfigs?: Record<string, UnitResponse>;

  onColumnUnitChange?: (columnKey: string, unit: string) => void;

  selectedCustomRowIndex?: number | null;

  onCustomRowClick?: (index: number) => void;

  scrollToCustomRowIndex?: number | null;

  onScrollToCustomRowComplete?: () => void;

};



function CalculationCellValue({

  cell,

  baseUnit,

  displayUnit,

  unitConfig,

}: {

  cell?: CalculationCell;

  baseUnit: string;

  displayUnit: string;

  unitConfig?: UnitResponse;

}) {

  const displayCell = calculationCellInDisplayUnit(cell, {
    baseUnit,
    displayUnit,
    unitConfig,
  });

  const text = formatCalculationCell(displayCell);

  const isEmpty = !displayCell || displayCell.value === null;
  const modeClass = isEmpty
    ? ""
    : calculationCellModeClass(displayCell?.mode);
  const modeTitle = isEmpty
    ? undefined
    : calculationCellModeTitle(displayCell?.mode);
  const title = isEmpty
    ? undefined
    : modeTitle
      ? `${text} (${modeTitle})`
      : text;

  return (
    <span
      className={[
        "calculation-cell",
        modeClass,
        isEmpty ? "calculation-cell--empty" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={title}
    >
      {text}
    </span>
  );

}

/** Индекс строки в исходном списке. Сортировка не копирует объекты, поэтому ссылка стабильна. */
export function calculationRowSourceIndex<T>(source: readonly T[], row: T): number {
  return source.indexOf(row);
}

/** Ключ строки не зависит от температуры и от места в отсортированном списке. */
export function calculationRowKey(
  section: "db" | "custom",
  sourceIndex: number,
): string {
  return `${section}-${sourceIndex}`;
}

export function CalculationTable({

  columns,

  dbRows,

  customRows = [],

  columnComments = {},

  columnSourceRefs = {},

  onSourceRefClick,

  columnAcceptance = new Set(),

  columnUnits = {},

  unitConfigs = {},

  onColumnUnitChange,

  selectedCustomRowIndex = null,

  onCustomRowClick,

  scrollToCustomRowIndex = null,

  onScrollToCustomRowComplete,

}: CalculationTableProps) {

  const [unitMenu, setUnitMenu] = useState<UnitMenuState | null>(null);
  const [sortState, setSortState] = useState<CalculationSortState>(null);

  const tableRef = useRef<HTMLTableElement>(null);
  useResizableTableHeaders(tableRef);

  const handleSortColumn = (column: CalculationSortColumn) => {
    setSortState((prev) => {
      if (prev?.column === column) {
        return { column, direction: toggleSortDirection(prev.direction) };
      }
      return { column, direction: "asc" };
    });
  };

  const sortUnits = {
    columns,
    columnUnits,
    unitConfigs,
  };

  const sortedDbRows = useMemo(
    () =>
      sortState
        ? sortCalculationRows(
            dbRows,
            sortState.column,
            sortState.direction,
            sortUnits,
          )
        : dbRows,
    [dbRows, sortState, columns, columnUnits, unitConfigs],
  );

  const sortedCustomRows = useMemo(
    () =>
      sortState
        ? sortCalculationRows(
            customRows,
            sortState.column,
            sortState.direction,
            sortUnits,
          )
        : customRows,
    [customRows, sortState, columns, columnUnits, unitConfigs],
  );

  const customRowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const temperatureUnitConfig = unitConfigs[TEMPERATURE_UNIT_TYPE];
  const temperatureUnitLabel = calculationColumnUnitLabel(
    temperatureUnitConfig?.system_unit ?? "C",
    temperatureUnitConfig,
  );
  const temperatureHeaderTitle = temperatureUnitLabel
    ? `T, ${temperatureUnitLabel}`
    : "T";
  const temperatureHeader = sortableHeaderProps(
    () => handleSortColumn("temperature"),
    temperatureHeaderTitle,
  );

  useEffect(() => {
    customRowRefs.current.length = customRows.length;
  }, [customRows.length]);

  useEffect(() => {
    if (scrollToCustomRowIndex == null || customRows.length === 0) {
      return;
    }

    if (
      scrollToCustomRowIndex < 0 ||
      scrollToCustomRowIndex >= customRows.length
    ) {
      return;
    }

    const row = customRowRefs.current[scrollToCustomRowIndex];
    if (!row) {
      return;
    }

    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    onScrollToCustomRowComplete?.();
  }, [
    scrollToCustomRowIndex,
    customRows,
    onScrollToCustomRowComplete,
  ]);



  return (

    <>

      <div className="selection-table-scroll selection-table-scroll--header-tooltips calculation-table-scroll">

        <table
          ref={tableRef}
          className="data-table selection-table calculation-table"
        >

          <colgroup>
            <col className="calculation-table-col--temp" />
            {columns.map((col) => (
              <col key={col.key} className="calculation-table-col--value" />
            ))}
          </colgroup>

          <thead>

            <tr>

              <th
                className={[
                  "selection-table-col",
                  "selection-table-col--temp",
                  "calculation-table-col--temp",
                  temperatureHeader.className,
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={temperatureHeader.title}
                onClick={temperatureHeader.onClick}
              >

                <span className="calculation-table-header">

                  <span className="calculation-table-header__text">

                    <span className="calculation-table-header__symbol">T</span>

                    <span className="calculation-table-header__unit">

                      <ScientificText>{temperatureUnitLabel || "°C"}</ScientificText>

                    </span>

                  </span>

                  <span

                    className="calculation-table-header__badges"

                    aria-hidden="true"

                  />

                </span>

                {renderSortIndicator("temperature", sortState)}

              </th>

              {columns.map((col) => {

                const comment = columnComments[col.key];

                const sourceRef = columnSourceRefs[col.key];

                const isAcceptance = columnAcceptance.has(col.key);

                const symbol = calculationColumnSymbol(col);

                const displayUnit = columnUnits[col.key] ?? col.unit ?? "";

                const unitConfig = col.unit_type

                  ? unitConfigs[col.unit_type]

                  : undefined;

                const unitLabel = calculationColumnUnitLabel(

                  displayUnit,

                  unitConfig,

                );

                const headerTitle = unitLabel ? `${symbol}, ${unitLabel}` : symbol;
                const header = sortableHeaderProps(
                  () => handleSortColumn(col.key),
                  headerTitle,
                );

                const canChangeUnit = Boolean(

                  col.unit_type && unitConfig && onColumnUnitChange,

                );



                return (

                  <th

                    key={col.key}
                    data-col-key={col.key}

                    className={[

                      "selection-table-col",

                      "selection-table-col--value",

                      "calculation-table-col--value",

                      header.className,

                      canChangeUnit ? "calculation-table-col--unit-switch" : "",

                    ]

                      .filter(Boolean)

                      .join(" ")}

                    onContextMenu={(event) => {

                      if (!canChangeUnit || !unitConfig) {

                        return;

                      }

                      event.preventDefault();

                      setUnitMenu({

                        col,

                        x: event.clientX,

                        y: event.clientY,

                      });

                    }}

                    onClick={header.onClick}
                  >

                    <span className="calculation-table-header">

                      <span
                        className="calculation-table-header__text"
                        title={
                          canChangeUnit
                            ? `${formatScientificPlain(header.title ?? headerTitle)}. ПКМ — смена единицы измерения`
                            : formatScientificPlain(header.title ?? headerTitle)
                        }
                      >

                        <span className="calculation-table-header__symbol">

                          <ScientificText>{symbol}</ScientificText>

                        </span>

                        {unitLabel && (

                          <span className="calculation-table-header__unit">

                            <ScientificText>{unitLabel}</ScientificText>

                          </span>

                        )}

                      </span>

                      <span className="calculation-table-header__badges">

                        {isAcceptance && (

                          <AcceptanceIndicator className="temp-comment-indicator--header" />

                        )}

                        {comment && (

                          <TempCommentIndicator

                            comment={comment}

                            ariaLabel={`Комментарий к свойству ${col.label}`}

                            className="temp-comment-indicator--header"

                          />

                        )}

                        {sourceRef && (

                          <button

                            type="button"

                            className="calculation-source-ref"

                            title={

                              sourceRef.sourceId

                                ? `Перейти к источнику ${sourceRef.label}`

                                : `Источник ${sourceRef.label}`

                            }

                            disabled={!sourceRef.sourceId || !onSourceRefClick}

                            onClick={(event) => {

                              event.stopPropagation();

                              if (sourceRef.sourceId && onSourceRefClick) {

                                onSourceRefClick(sourceRef);

                              }

                            }}

                          >

                            {sourceRef.label}

                          </button>

                        )}

                      </span>

                      {renderSortIndicator(col.key, sortState)}

                    </span>

                  </th>

                );

              })}

            </tr>

          </thead>

          <tbody>

            {sortedDbRows.map((row) => (

              <tr key={calculationRowKey("db", calculationRowSourceIndex(dbRows, row))}>

                <td className="selection-table-col--temp calculation-table-col--temp">

                  {row.temperature}

                </td>

                {columns.map((col) => {

                  const unitConfig = col.unit_type

                    ? unitConfigs[col.unit_type]

                    : undefined;



                  return (

                    <td

                      key={col.key}
                      data-col-key={col.key}

                      className="selection-table-col--value calculation-table-col--value"

                    >

                      <CalculationCellValue

                        cell={row.values[col.key]}

                        baseUnit={col.unit}

                        displayUnit={columnUnits[col.key] ?? col.unit}

                        unitConfig={unitConfig}

                      />

                    </td>

                  );

                })}

              </tr>

            ))}



            {customRows.length > 0 && (

              <tr className="calculation-table-separator">

                <td colSpan={columns.length + 1}>РАСЧЁТ</td>

              </tr>

            )}



            {sortedCustomRows.map((row) => {
              const sourceIndex = calculationRowSourceIndex(customRows, row);

              return (
              <tr

                key={calculationRowKey("custom", sourceIndex)}

                ref={(element) => {
                  if (sourceIndex >= 0) {
                    customRowRefs.current[sourceIndex] = element;
                  }
                }}

                className={[

                  "calculation-table-row--custom",

                  selectedCustomRowIndex === sourceIndex

                    ? "calculation-table-row--custom-selected"

                    : "",

                ]

                  .filter(Boolean)

                  .join(" ")}

                onClick={() => {
                  if (sourceIndex >= 0) {
                    onCustomRowClick?.(sourceIndex);
                  }
                }}

              >

                <td className="selection-table-col--temp calculation-table-col--temp">

                  {row.temperature}

                </td>

                {columns.map((col) => {

                  const unitConfig = col.unit_type

                    ? unitConfigs[col.unit_type]

                    : undefined;



                  return (

                    <td

                      key={col.key}
                      data-col-key={col.key}

                      className="selection-table-col--value calculation-table-col--value"

                    >

                      <CalculationCellValue

                        cell={row.values[col.key]}

                        baseUnit={col.unit}

                        displayUnit={columnUnits[col.key] ?? col.unit}

                        unitConfig={unitConfig}

                      />

                    </td>

                  );

                })}

              </tr>
              );
            })}

          </tbody>

        </table>

      </div>



      {unitMenu && unitMenu.col.unit_type && (

        <ColumnUnitContextMenu

          x={unitMenu.x}

          y={unitMenu.y}

          columnLabel={calculationColumnSymbol(unitMenu.col)}

          units={unitConfigs[unitMenu.col.unit_type]?.units ?? []}

          currentUnit={columnUnits[unitMenu.col.key] ?? unitMenu.col.unit}

          displayLabels={

            unitConfigs[unitMenu.col.unit_type]?.display_labels

          }

          onSelect={(unit) => onColumnUnitChange?.(unitMenu.col.key, unit)}

          onClose={() => setUnitMenu(null)}

        />

      )}

    </>

  );

}

