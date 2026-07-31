import { useState } from "react";
import type {
  CalculationCell,
  SingleCalculationColumn,
  SingleCalculationRow,
  UnitResponse,
} from "../types/api";
import { splitCalculationColumnHeader } from "../lib/calculationColumnHeader";
import { unitDisplayText } from "../lib/columnUnits";
import { formatCalculationCell } from "../lib/formatCalculationCell";
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
  columnAcceptance?: Set<string>;
  columnUnits?: Record<string, string>;
  unitConfigs?: Record<string, UnitResponse>;
  onColumnUnitChange?: (columnKey: string, unit: string) => void;
  selectedCustomRowIndex?: number | null;
  onCustomRowClick?: (index: number) => void;
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
    const converted = convertBetweenUnits(
      cell.value,
      baseUnit,
      displayUnit,
      unitConfig,
    );
    displayCell = { ...cell, value: converted };
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
  columnAcceptance = new Set(),
  columnUnits = {},
  unitConfigs = {},
  onColumnUnitChange,
  selectedCustomRowIndex = null,
  onCustomRowClick,
}: CalculationTableProps) {
  const [unitMenu, setUnitMenu] = useState<UnitMenuState | null>(null);

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
                    <span className="calculation-table-header__unit">°C</span>
                  </span>
                  <span
                    className="calculation-table-header__badges"
                    aria-hidden="true"
                  />
                </span>
              </th>
              {columns.map((col) => {
                const comment = columnComments[col.key];
                const isAcceptance = columnAcceptance.has(col.key);
                const { symbol } = splitCalculationColumnHeader(col);
                const displayUnit = columnUnits[col.key] ?? col.unit ?? "";
                const unitConfig = col.unit_type
                  ? unitConfigs[col.unit_type]
                  : undefined;
                const unitLabel = unitDisplayText(
                  displayUnit,
                  unitConfig?.display_labels,
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
                    title={
                      canChangeUnit
                        ? "ПКМ — смена единицы измерения"
                        : undefined
                    }
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
                      <span className="calculation-table-header__text">
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
          columnLabel={splitCalculationColumnHeader(unitMenu.col).symbol}
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
