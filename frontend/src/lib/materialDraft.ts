import type { QueryClient } from "@tanstack/react-query";
import type { MaterialSummary } from "../types/api";

type MaterialMetadata = {
  name_material_standard?: string;
  name_material_alternative?: string | string[];
  application_area?: string[];
};

export function normalizeMaterialAlternatives(
  metadata: MaterialMetadata | Record<string, unknown>,
): string[] {
  const raw = (metadata as MaterialMetadata).name_material_alternative;
  if (Array.isArray(raw)) {
    return raw.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function materialDisplayName(metadata: MaterialMetadata): string {
  const std = (metadata.name_material_standard ?? "Без имени").trim() || "Без имени";
  const alts = normalizeMaterialAlternatives(metadata);
  return alts.length ? `${std} (${alts.join(", ")})` : std;
}

export function materialListLabel(material: Pick<MaterialSummary, "filename">): string {
  return material.filename.replace(/\.json$/i, "");
}

export function materialSummaryFromDraft(
  draft: Record<string, unknown>,
  filename: string,
): MaterialSummary {
  const meta = (draft.metadata ?? {}) as MaterialMetadata;
  return {
    id: draft.material_id as string,
    name: materialDisplayName(meta),
    areas: meta.application_area ?? [],
    filename,
  };
}

export function normalizeMaterialDraft(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const next = structuredClone(draft);
  const meta = (next.metadata ?? {}) as MaterialMetadata;
  meta.name_material_alternative = normalizeMaterialAlternatives(meta);
  next.metadata = meta;
  return next;
}

type PropertyGroupEntry = {
  property_name?: string;
  data?: Record<string, unknown>;
};

type PropertyGroup = {
  property_type?: string;
  properties?: PropertyGroupEntry[];
  strength_groups?: Array<Record<string, unknown>>;
};

function hasNamedProperties(container: unknown): boolean {
  if (!container || typeof container !== "object") {
    return false;
  }
  const props = (container as { properties?: unknown }).properties;
  return Array.isArray(props) && props.length > 0;
}

function editorUsesLegacyShape(material: Record<string, unknown>): boolean {
  if (hasNamedProperties(material.physical_properties)) {
    return true;
  }
  const mechanical = material.mechanical_properties as
    | { strength_category?: unknown[] }
    | undefined;
  if (
    Array.isArray(mechanical?.strength_category) &&
    mechanical.strength_category.length > 0
  ) {
    return true;
  }
  const chemical = material.chemical_properties as
    | { composition?: unknown[] }
    | undefined;
  if (Array.isArray(chemical?.composition) && chemical.composition.length > 0) {
    return true;
  }
  return false;
}

function flattenGroupEntry(entry: PropertyGroupEntry): Record<string, unknown> | null {
  const name = entry.property_name;
  if (!name) return null;
  const data =
    entry.data && typeof entry.data === "object" ? entry.data : {};
  return { ...structuredClone(data), property_name: name };
}

function physicalPropertiesFromGroups(
  groups: PropertyGroup[],
): Record<string, unknown> {
  const physical = groups.find((group) => group.property_type === "physical");
  const properties: Record<string, unknown>[] = [];
  for (const entry of physical?.properties ?? []) {
    const item = flattenGroupEntry(entry);
    if (item) properties.push(item);
  }
  return { properties };
}

function mechanicalPropertiesFromGroups(
  groups: PropertyGroup[],
): Record<string, unknown> {
  const mechanical = groups.find((group) => group.property_type === "mechanical");
  const strength_category = (mechanical?.strength_groups ?? []).map((group) => {
    const properties: Record<string, unknown>[] = [];
    const category: Record<string, unknown> = {
      value_strength_category: group.strength_category ?? "",
      comment: group.comment ?? "",
      properties,
      hardness: [],
    };
    if (group.source_ref_id != null) {
      category.source_ref_id = group.source_ref_id;
    }
    if (group.property_subsource != null) {
      category.property_subsource = group.property_subsource;
    }
    if (group.property_source != null) {
      category.property_source = group.property_source;
    }

    for (const entry of (group.properties as PropertyGroupEntry[] | undefined) ?? []) {
      const name = entry.property_name;
      const data = entry.data ?? {};
      if (!name) continue;
      if (name === "hardness") {
        category.hardness = data.hardness_values ?? [];
        category.hardness_unit = data.hardness_unit ?? "HB";
        continue;
      }
      const item = flattenGroupEntry(entry);
      if (item) properties.push(item);
    }
    return category;
  });
  return { strength_category };
}

function chemicalPropertiesFromGroups(
  groups: PropertyGroup[],
): Record<string, unknown> {
  const chemical = groups.find((group) => group.property_type === "chemical");
  const composition = (chemical?.properties ?? [])
    .filter((entry) => entry.property_name === "composition")
    .map((entry) => structuredClone(entry.data ?? {}));
  return { composition };
}

/** API хранит property_groups; вкладки редактора — legacy physical/mechanical/chemical. */
export function materialForEditor(
  material: Record<string, unknown>,
): Record<string, unknown> {
  if (editorUsesLegacyShape(material)) {
    return normalizeMaterialDraft(material);
  }
  const groups = material.property_groups;
  if (!Array.isArray(groups)) {
    return normalizeMaterialDraft(material);
  }

  const next = structuredClone(material) as Record<string, unknown>;
  next.physical_properties = physicalPropertiesFromGroups(groups);
  next.mechanical_properties = mechanicalPropertiesFromGroups(groups);
  next.chemical_properties = chemicalPropertiesFromGroups(groups);
  return normalizeMaterialDraft(next);
}

export async function syncMaterialsAfterSave(
  queryClient: QueryClient,
  draft: Record<string, unknown>,
  filename: string,
): Promise<void> {
  const normalized = normalizeMaterialDraft(draft);
  const id = normalized.material_id as string;
  const summary = materialSummaryFromDraft(normalized, filename);

  queryClient.setQueryData(["material", id], normalized);
  queryClient.setQueryData<MaterialSummary[]>(["materials"], (current) => {
    const list = current ?? [];
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) {
      const next = [...list];
      next[index] = summary;
      return next.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }
    return [...list, summary].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  });

  await Promise.all([
    queryClient.refetchQueries({ queryKey: ["materials"] }),
    queryClient.refetchQueries({ queryKey: ["workspace"] }),
    queryClient.refetchQueries({ queryKey: ["selection"] }),
  ]);
}
