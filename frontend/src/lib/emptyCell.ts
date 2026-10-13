/** Единственная подпись пустой ячейки на экране. */
export const EMPTY_CELL = "—";

const EMPTY_MARKERS = new Set(["", "-", "—"]);

/** Пусто в данных: нет значения, дефис API или уже каноническое тире. */
export function isEmptyCellMarker(value: string): boolean {
  return EMPTY_MARKERS.has(value.trim());
}
