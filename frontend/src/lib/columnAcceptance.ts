import { findNamedProp } from "./namedProperties";

function readIsAcceptance(container: unknown): boolean {
  if (!container || typeof container !== "object") {
    return false;
  }
  return Boolean((container as { is_acceptance?: boolean }).is_acceptance);
}

export function buildColumnAcceptance(
  columns: { key: string }[],
  category: Record<string, unknown> | undefined,
): Set<string> {
  const keys = new Set<string>();

  for (const col of columns) {
    if (readIsAcceptance(findNamedProp(category, col.key))) {
      keys.add(col.key);
    }
  }

  return keys;
}
