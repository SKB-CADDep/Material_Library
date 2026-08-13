import { useEffect, useRef, useState } from "react";

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

import { formatCalculationCell } from "../lib/formatCalculationCell";

import type { CalculationColumnSourceRef } from "../lib/calculationColumnSources";

import { convertBetweenUnits } from "../lib/unitConversion";

import { AcceptanceIndicator } from "./AcceptanceIndicator";

import { ColumnUnitContextMenu } from "./ColumnUnitContextMenu";

import { TempCommentIndicator } from "./TempCommentIndicator";



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

  let displayCell = cell;

  if (
    cell?.value != null &&
    unitConfig &&
    baseUnit &&
    displayUnit &&
    baseUnit !== displayUnit
  ) {
    const numeric =
      typeof cell.value === "number" ? cell.value : Number(cell.value);

    if (Number.isFinite(numeric)) {
      try {
        const converted = convertBetweenUnits(
          numeric,
          baseUnit,
          displayUnit,
          unitConfig,
        );
        displayCell = { ...cell, value: converted };
      } catch {
        displayCell = cell;
      }
    }
  }



  const text = formatCalculationCell(displayCell);

  const isEmpty = !cell || cell.value === null;



  const modeClass =

    cell?.mode === "interp"

      ? "calculation-cell--interp"

      : cell?.mode === "approx"

        ? "calculation-cell--approx"

        : cell?.mode === "scalar"

          ? "calculation-cell--scalar"

          : "";



  return (

    <span

      className={[

        "calculation-cell",

        modeClass,

        isEmpty ? "calculation-cell--empty" : "",

      ]

        .filter(Boolean)

        .join(" ")}

    >

      {text}

    </span>

  );

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

  const customRowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const temperatureUnitConfig = unitConfigs[TEMPERATURE_UNIT_TYPE];
  const temperatureUnitLabel = calculationColumnUnitLabel(
    temperatureUnitConfig?.system_unit ?? "C",
    temperatureUnitConfig,
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

        <table className="data-table selection-table calculation-table">

          <thead>

            <tr>

              <th className="selection-table-col selection-table-col--temp calculation-table-col--temp">

                <span className="calculation-table-header">

                  <span className="calculation-table-header__text">

                    <span className="calculation-table-header__symbol">T</span>

                    <span className="calculation-table-header__unit">

                      {temperatureUnitLabel || "°C"}

                    </span>

                  </span>

                  <span

                    className="calculation-table-header__badges"

                    aria-hidden="true"

                  />

                </span>

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

                  >

                    <span className="calculation-table-header">

                      <span
                        className="calculation-table-header__text"
                        title={
                          canChangeUnit
                            ? "ПКМ — смена единицы измерения"
                            : undefined
                        }
                      >

                        <span className="calculation-table-header__symbol">

                          {symbol}

                        </span>

                        {unitLabel && (

                          <span className="calculation-table-header__unit">

                            {unitLabel}

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

                    </span>

                  </th>

                );

              })}

            </tr>

          </thead>

          <tbody>

            {dbRows.map((row, rowIndex) => (

              <tr key={`db-${row.temperature}-${rowIndex}`}>

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



            {customRows.map((row, rowIndex) => (

              <tr

                key={`custom-${row.temperature}-${rowIndex}`}

                ref={(element) => {
                  customRowRefs.current[rowIndex] = element;
                }}

                className={[

                  "calculation-table-row--custom",

                  selectedCustomRowIndex === rowIndex

                    ? "calculation-table-row--custom-selected"

                    : "",

                ]

                  .filter(Boolean)

                  .join(" ")}

                onClick={() => onCustomRowClick?.(rowIndex)}

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

