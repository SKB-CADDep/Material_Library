export function mergeColumnVisibility(
  columns: { key: string }[],
  prev: Record<string, boolean>,
): Record<string, boolean> {
  let changed = false;
  const next = { ...prev };

  for (const col of columns) {
    if (!(col.key in next)) {
      next[col.key] = true;
      changed = true;
    }
  }

  return changed ? next : prev;
}

export function filterVisibleColumns<T extends { key: string }>(
  columns: T[],
  visibility: Record<string, boolean>,
): T[] {
  return columns.filter((col) => visibility[col.key] !== false);
}

export function setAllColumnVisibility(
  columns: { key: string }[],
  visible: boolean,
): Record<string, boolean> {
  return Object.fromEntries(columns.map((col) => [col.key, visible]));
}

export function toggleColumnVisibility(
  visibility: Record<string, boolean>,
  key: string,
): Record<string, boolean> {
  const isVisible = visibility[key] !== false;
  return {
    ...visibility,
    [key]: !isVisible,
  };
}
