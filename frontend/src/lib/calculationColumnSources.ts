import type { PropertySourceFields } from "../pages/PropertySourceSelect";
import type { SourceItem, SourcesTabType } from "../types/api";

export type CalculationColumnSourceRef = {
  label: string;
  sourceId: string | null;
  tab: SourcesTabType;
};

const BRACKET_SOURCE_ID = /^\[(\d+)\]$/;

function readPropertyContainer(
  key: string,
  physicalProperties: Record<string, unknown> | undefined,
  category: Record<string, unknown> | undefined,
): PropertySourceFields | undefined {
  const physical = physicalProperties?.[key];
  if (physical && typeof physical === "object") {
    return physical as PropertySourceFields;
  }
  const mechanical = category?.[key];
  if (mechanical && typeof mechanical === "object") {
    return mechanical as PropertySourceFields;
  }
  return undefined;
}

function indexInSources(sourceId: string, sources: SourceItem[]): number {
  return sources.findIndex((item) => item.id_source === sourceId);
}

function refFromSourceId(
  sourceId: string,
  sources: SourceItem[],
  tab: SourcesTabType,
): CalculationColumnSourceRef {
  const index = indexInSources(sourceId, sources);
  return {
    label: index >= 0 ? `[${index + 1}]` : "[?]",
    sourceId,
    tab,
  };
}

function resolvePropertySourceRef(
  prop: PropertySourceFields | undefined,
  propertySources: SourceItem[],
): CalculationColumnSourceRef | null {
  if (!prop) {
    return null;
  }

  const refId = String(prop.source_ref_id ?? "").trim();
  if (refId) {
    return refFromSourceId(refId, propertySources, "property_sources");
  }

  const sub = String(prop.property_subsource ?? "").trim();
  if (!sub) {
    return null;
  }

  const bracketMatch = sub.match(BRACKET_SOURCE_ID);
  if (bracketMatch) {
    const index = Number(bracketMatch[1]);
    const source = propertySources[index - 1];
    return {
      label: `[${index}]`,
      sourceId: source?.id_source ?? null,
      tab: "property_sources",
    };
  }

  const byName = propertySources.find((item) => item.name_source === sub);
  if (byName?.id_source) {
    return refFromSourceId(byName.id_source, propertySources, "property_sources");
  }

  return null;
}

export function buildColumnSourceRefs(
  columns: { key: string }[],
  physicalProperties: Record<string, unknown> | undefined,
  category: Record<string, unknown> | undefined,
  propertySources: SourceItem[],
  strengthSources: SourceItem[],
): Record<string, CalculationColumnSourceRef> {
  const map: Record<string, CalculationColumnSourceRef> = {};

  for (const col of columns) {
    const prop = readPropertyContainer(col.key, physicalProperties, category);
    const propertyRef = resolvePropertySourceRef(prop, propertySources);
    if (propertyRef) {
      map[col.key] = propertyRef;
      continue;
    }

    const categoryRefId = String(category?.source_ref_id ?? "").trim();
    if (categoryRefId && !physicalProperties?.[col.key]) {
      map[col.key] = refFromSourceId(
        categoryRefId,
        strengthSources,
        "strength_sources",
      );
    }
  }

  return map;
}
