import { useRef } from "react";

import { BlurCommitTextInput } from "./BlurCommitTextInput";
import { useResizableTableHeaders } from "../hooks/useResizableTableHeaders";
import { useKeepAlivePaneActive } from "../context/KeepAlivePaneContext";

function formatPairNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}
export type TemperatureValueTableProps = {
  pairs: Array<[number, number]> | undefined;
  onChangeValue?: (rowIndex: number, raw: string) => void;
  onChangeTemperature?: (rowIndex: number, raw: string) => void;
  selectedRowIndex?: number | null;
  onRowSelect?: (index: number) => void;
  onAddRow?: () => void;
  onDeleteRow?: () => void;
};

export function TemperatureValueTable({
  pairs,
  onChangeValue,
  onChangeTemperature,
  selectedRowIndex,
  onRowSelect,
  onAddRow,
  onDeleteRow,
}: TemperatureValueTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const paneActive = useKeepAlivePaneActive();
  useResizableTableHeaders(tableRef, { disabled: !paneActive });

  const isRowSelectionEnabled = Boolean(onRowSelect);
  const tableClassName = isRowSelectionEnabled
    ? "data-table data-table--temperature-pairs data-table--selectable-rows"
    : "data-table data-table--temperature-pairs";

  return (
    <div className="table-wrapper table-wrapper--temperature-pairs">
      <div className="data-table-container">
        <table ref={tableRef} className={tableClassName}>
          <colgroup>
            <col className="data-table__col-temperature" />
            <col className="data-table__col-value" />
          </colgroup>
          <thead>
            <tr>
              <th>T, °C</th>
              <th>Значение</th>
            </tr>
          </thead>
          <tbody>
            {(pairs ?? []).length === 0 ? (
              <tr>
                <td colSpan={2} className="table-empty">
                  Нет точек — нажмите «+», чтобы добавить пару T–значение
                </td>
              </tr>
            ) : (
              (pairs ?? []).map(([temperature, value], index) => (
                <tr
                  key={index}
                  className={
                    selectedRowIndex === index ? "table-row-selected" : ""
                  }
                >
                  <td
                    className={
                      isRowSelectionEnabled
                        ? "data-table-select-cell"
                        : undefined
                    }
                    onClick={
                      isRowSelectionEnabled
                        ? () => onRowSelect?.(index)
                        : undefined
                    }
                  >
                    <BlurCommitTextInput
                      readOnly={!onChangeTemperature}
                      value={formatPairNumber(temperature)}
                      commitWhenUnchanged={false}
                      onCommit={
                        onChangeTemperature
                          ? (raw) => onChangeTemperature(index, raw)
                          : () => undefined
                      }
                      onMouseDown={(e) => {
                        if (isRowSelectionEnabled) {
                          onRowSelect?.(index);
                        }
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="table-cell-input"
                      inputMode="decimal"
                    />
                  </td>
                  <td
                    className={
                      isRowSelectionEnabled
                        ? "data-table-select-cell"
                        : undefined
                    }
                    onClick={
                      isRowSelectionEnabled
                        ? () => onRowSelect?.(index)
                        : undefined
                    }
                  >
                    <BlurCommitTextInput
                      readOnly={!onChangeValue}
                      commitWhenUnchanged={false}
                      onCommit={
                        onChangeValue
                          ? (raw) => onChangeValue(index, raw)
                          : () => undefined
                      }
                      value={formatPairNumber(value)}
                      className="table-cell-input"
                      inputMode="decimal"
                      onMouseDown={(e) => {
                        if (isRowSelectionEnabled) {
                          onRowSelect?.(index);
                        }
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="table-controls">
        <button
          type="button"
          className="table-control-btn"
          title="Добавить пару"
          onClick={() => onAddRow?.()}
          disabled={!onAddRow}
        >
          +
        </button>
        <button
          type="button"
          className="table-control-btn"
          title={
            selectedRowIndex == null ? "Сначала выберите строку" : "Удалить пару"
          }
          disabled={selectedRowIndex == null || !onDeleteRow}
          onClick={() => onDeleteRow?.()}
        >
          −
        </button>
      </div>
    </div>
  );
}
