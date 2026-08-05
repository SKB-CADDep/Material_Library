import type { CalculationColumnSourceRef } from "./calculationColumnSources";

export function buildSourcesNavigatePath(
  ref: Pick<CalculationColumnSourceRef, "sourceId" | "tab">,
): string {
  const params = new URLSearchParams();
  params.set("tab", ref.tab);
  if (ref.sourceId) {
    params.set("source", ref.sourceId);
  }
  return `/sources?${params.toString()}`;
}
