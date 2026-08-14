import type { SourceItem } from "../types/api";

export type CompositionSourceFields = {
  composition_source?: string | null;
  source_ref_id?: string | null;
  composition_subsource?: string | null;
};


export function resolveCompositionSourceLabel(
  entry: CompositionSourceFields | undefined,
  chemicalSources: SourceItem[],
): string {
  const refId = String(entry?.source_ref_id ?? "").trim();
  let sourceName: string;

  if (refId) {
    sourceName =
      chemicalSources.find((src) => src.id_source === refId)?.name_source ??
      refId;
  } else {
    sourceName = String(entry?.composition_source ?? "").trim() || "-";
  }

  const subsource = String(entry?.composition_subsource ?? "").trim();
  if (subsource) {
    return `${sourceName} (${subsource})`;
  }

  return sourceName;
}
