import { useRef } from "react";

import { useResizableTableHeaders } from "../hooks/useResizableTableHeaders";
import type { ChemSourceColumn } from "../lib/chemComparisonPivot";

type ChemComparisonSourcesTableProps = {
  columns: ChemSourceColumn[];
};

export function ChemComparisonSourcesTable({
  columns,
}: ChemComparisonSourcesTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useResizableTableHeaders(tableRef, {
    disabled: columns.length === 0,
    eventRootRef: scrollRef,
    headerStructureKey: columns.map((column) => column.key).join("|"),
  });

  return (
    <section
      className="chem-comparison-panel chem-comparison-panel--sources"
      aria-labelledby="chem-comparison-sources-title"
    >
      <h3
        id="chem-comparison-sources-title"
        className="chem-comparison-panel-title"
      >
        Источники состава выбранного материала
      </h3>

      {columns.length === 0 ? (
        <p className="tab-placeholder tab-placeholder--inline">
          Нет источников состава
        </p>
      ) : (
        <div ref={scrollRef} className="chem-comparison-sources-scroll">
          <table ref={tableRef} className="data-table chem-comparison-sources-table">
            <colgroup>
              <col className="chem-comparison-sources-col--label" />
              <col className="chem-comparison-sources-col--comment" />
              <col className="chem-comparison-sources-col--base" />
              <col className="chem-comparison-sources-col--unit" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Источник</th>
                <th scope="col">Комментарий</th>
                <th scope="col">Основа</th>
                <th scope="col">Ед. изм.</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((column) => (
                <tr key={column.key}>
                  <td className="chem-comparison-sources-col--label" title={column.label}>
                    {column.label}
                  </td>
                  <td
                    className="chem-comparison-sources-col--comment"
                    title={column.comment || undefined}
                  >
                    {column.comment.trim() ? column.comment : "—"}
                  </td>
                  <td className="chem-comparison-sources-col--base">
                    {column.baseElement}
                  </td>
                  <td className="chem-comparison-sources-col--unit">{column.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
