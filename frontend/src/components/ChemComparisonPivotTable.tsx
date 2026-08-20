import { useLayoutEffect, useRef } from "react";

import {
  syncChemPivotStickyColumns,
  useResizableTableHeaders,
} from "../hooks/useResizableTableHeaders";
import type {
  ChemComparisonView,
  ChemPivotRow,
  ChemSourceColumn,
} from "../lib/chemComparisonPivot";

type ChemComparisonPivotTableProps = {
  columns: ChemSourceColumn[];
  rows: ChemPivotRow[];
};

export function ChemComparisonPivotTable({
  columns,
  rows,
}: ChemComparisonPivotTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useResizableTableHeaders(tableRef, {
    disabled: columns.length === 0 || rows.length === 0,
    eventRootRef: scrollRef,
    headerStructureKey: columns.map((column) => column.key).join("|"),
    onLayoutChange: () => {
      if (tableRef.current) {
        syncChemPivotStickyColumns(tableRef.current);
      }
    },
  });

  useLayoutEffect(() => {
    if (tableRef.current) {
      syncChemPivotStickyColumns(tableRef.current);
    }
  }, [columns, rows]);

  if (columns.length === 0) {
    return (
      <p className="tab-placeholder tab-placeholder--inline">
        Нет источников для сравнения
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="tab-placeholder tab-placeholder--inline">
        В источниках нет элементов для сравнения
      </p>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="chem-comparison-pivot-scroll"
    >
      <table ref={tableRef} className="data-table chem-comparison-pivot-table">
        <colgroup>
          <col className="chem-comparison-pivot-col--element" />
          <col className="chem-comparison-pivot-col--name" />
          {columns.map((column) => (
            <col key={column.key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              scope="col"
              className="chem-comparison-pivot-col chem-comparison-pivot-col--element"
            >
              Элемент
            </th>
            <th
              scope="col"
              className="chem-comparison-pivot-col chem-comparison-pivot-col--name"
            >
              Название
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="chem-comparison-pivot-col chem-comparison-pivot-col--source"
                title={column.label}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.symbol}
              className={
                row.hasDiff ? "chem-comparison-pivot-row--diff" : undefined
              }
            >
              <td className="chem-comparison-pivot-col chem-comparison-pivot-col--element">
                {row.symbol}
              </td>
              <td className="chem-comparison-pivot-col chem-comparison-pivot-col--name">
                {row.name.trim() ? row.name : "—"}
              </td>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="chem-comparison-pivot-col chem-comparison-pivot-col--value"
                >
                  {row.cells[column.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChemComparisonPivotPanel({ view }: { view: ChemComparisonView }) {
  return (
    <section
      className="chem-comparison-panel chem-comparison-panel--pivot"
      aria-labelledby="chem-comparison-pivot-title"
    >
      <h3
        id="chem-comparison-pivot-title"
        className="chem-comparison-panel-title"
      >
        Сравнение хим. состава по элементам
      </h3>
      <ChemComparisonPivotTable columns={view.columns} rows={view.rows} />
    </section>
  );
}
