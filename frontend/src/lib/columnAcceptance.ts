type PropertyContainer = {
  is_acceptance?: boolean;
};

function readIsAcceptance(container: unknown): boolean {
  if (!container || typeof container !== "object") {
    return false;
  }
  return Boolean((container as PropertyContainer).is_acceptance);
}

export function buildColumnAcceptance(
  columns: { key: string }[],
  category: Record<string, unknown> | undefined,
): Set<string> {
  const cat = category ?? {};
  const keys = new Set<string>();

  for (const col of columns) {
    if (readIsAcceptance(cat[col.key])) {
      keys.add(col.key);
    }
  }

  return keys;
}
