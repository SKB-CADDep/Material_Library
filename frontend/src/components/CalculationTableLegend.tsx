import type { ReactNode } from "react";
import {
  TABLE_SORT_HINT,
  TableSortHint,
} from "../lib/tableSortHeader";
import { AcceptanceIndicator } from "./AcceptanceIndicator";
import { TempCommentIndicator } from "./TempCommentIndicator";

export type CalculationTableLegendProps = {
  showAcceptance?: boolean;
  showComments?: boolean;
  showSourceRefs?: boolean;
};

function LegendItem({
  sample,
  label,
  title,
}: {
  sample: ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <span className="calculation-table-legend__item" title={title ?? label}>
      <span className="calculation-table-legend__sample">{sample}</span>
      <span className="calculation-table-legend__label">{label}</span>
    </span>
  );
}

export function CalculationTableLegend({
  showAcceptance = false,
  showComments = false,
  showSourceRefs = false,
}: CalculationTableLegendProps) {
  return (
    <div
      className="calculation-table-legend"
      role="note"
      aria-label="Обозначения таблицы расчёта"
    >
      <span className="calculation-table-legend__title">Обозначения:</span>
      <LegendItem
        sample={
          <span className="calculation-cell calculation-table-legend__cell">330.0</span>
        }
        label="из БД"
        title="Точное значение из базы данных"
      />
      <LegendItem
        sample={
          <span className="calculation-cell calculation-cell--interp calculation-table-legend__cell">
            (330.0)
          </span>
        }
        label="интерполяция"
        title="Рассчитано интерполяцией между точками"
      />
      <LegendItem
        sample={
          <span className="calculation-cell calculation-cell--approx calculation-table-legend__cell">
            [330.0]
          </span>
        }
        label="экстраполяция"
        title="Рассчитано экстраполяцией за пределы диапазона"
      />

      {(showAcceptance || showComments || showSourceRefs) && (
        <span className="calculation-table-legend__sep" aria-hidden="true" />
      )}

      {showAcceptance && (
        <LegendItem
          sample={<AcceptanceIndicator className="acceptance-indicator--legend" />}
          label="сдаточная"
          title="Сдаточная характеристика"
        />
      )}
      {showComments && (
        <LegendItem
          sample={
            <TempCommentIndicator
              comment="Комментарий к свойству"
              ariaLabel="Пример индикатора комментария"
              className="temp-comment-indicator--legend"
            />
          }
          label="комментарий"
          title="Комментарий к свойству — наведите для текста"
        />
      )}
      {showSourceRefs && (
        <LegendItem
          sample={
            <span
              className="calculation-source-ref calculation-source-ref--legend-sample"
              aria-hidden="true"
            >
              [1]
            </span>
          }
          label="источник"
          title="Ссылка на источник в заголовке — клик открывает «Источники»"
        />
      )}

      <span className="calculation-table-legend__sep" aria-hidden="true" />

      <span className="calculation-table-legend__hint" title={TABLE_SORT_HINT}>
        <TableSortHint />
      </span>
    </div>
  );
}
