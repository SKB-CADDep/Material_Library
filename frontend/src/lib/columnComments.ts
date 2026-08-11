import { resolvePropertyFromContainers } from "./namedProperties";

function readPropertyComment(container: unknown): string {
  if (!container || typeof container !== "object") {
    return "";
  }
  const comment = (container as { comment?: string }).comment;
  return typeof comment === "string" ? comment.trim() : "";
}

export function buildColumnComments(
  columns: { key: string }[],
  physicalProperties: Record<string, unknown> | undefined,
  category: Record<string, unknown> | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const col of columns) {
    const comment = readPropertyComment(
      resolvePropertyFromContainers(col.key, physicalProperties, category),
    );
    if (comment) {
      map[col.key] = comment;
    }
  }

  return map;
}
