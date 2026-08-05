type PropertyContainer = {
  comment?: string;
};

function readPropertyComment(container: unknown): string {
  if (!container || typeof container !== "object") {
    return "";
  }
  const comment = (container as PropertyContainer).comment;
  return typeof comment === "string" ? comment.trim() : "";
}

export function buildColumnComments(
  columns: { key: string }[],
  physicalProperties: Record<string, unknown> | undefined,
  category: Record<string, unknown> | undefined,
): Record<string, string> {
  const physical = physicalProperties ?? {};
  const cat = category ?? {};
  const map: Record<string, string> = {};

  for (const col of columns) {
    const comment =
      readPropertyComment(physical[col.key]) ||
      readPropertyComment(cat[col.key]);
    if (comment) {
      map[col.key] = comment;
    }
  }

  return map;
}
