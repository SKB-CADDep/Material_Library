import type { SortDirection } from "./sortSelectionRows";

export const TABLE_SORT_HINT =
  "Клик по заголовку столбца — сортировка. Правый клик по заголовку — смена единицы измерения.";

export const TABLE_SORT_HINT_SORT = "Клик по заголовку — сортировка";
export const TABLE_SORT_HINT_UNIT = "ПКМ — смена ед.из.";


export const TABLE_SORT_HINT_SHORT = `${TABLE_SORT_HINT_SORT} · ${TABLE_SORT_HINT_UNIT}`;

export function TableSortHint() {
  return (
    <span className="table-header-hint">
      <span>{TABLE_SORT_HINT_SORT}</span>
      <span className="table-header-hint__sep" aria-hidden="true" />
      <span>{TABLE_SORT_HINT_UNIT}</span>
    </span>
  );
}

export function sortableHeaderProps(
  onSort: (() => void) | undefined,
  defaultTitle?: string,
) {
  if (!onSort) {
    return {
      className: "",
      title: defaultTitle,
      onClick: undefined,
    };
  }

  const sortTitle = "Клик — сортировка по столбцу";
  return {
    className: "sortable",
    title: defaultTitle ? `${defaultTitle}. ${sortTitle}` : sortTitle,
    onClick: onSort,
  };
}

export function renderSortIndicator<T extends string>(
  column: T,
  sortState: { column: T; direction: SortDirection } | null | undefined,
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
