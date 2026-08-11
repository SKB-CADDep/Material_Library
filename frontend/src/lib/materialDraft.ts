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

function editorUsesLegacyShape(material: Record<string, unknown>): boolean {
  return (
    material.physical_properties != null ||
    material.mechanical_properties != null ||
    material.chemical_properties != null
  );
}

function physicalPropertiesFromGroups(
  groups: PropertyGroup[],
): Record<string, unknown> {
  const physical = groups.find((group) => group.property_type === "physical");
  const result: Record<string, unknown> = {};
  for (const entry of physical?.properties ?? []) {
    const name = entry.property_name;
    if (!name) continue;
    result[name] = structuredClone(entry.data ?? {});
  }
  return result;
}

function mechanicalPropertiesFromGroups(
  groups: PropertyGroup[],
): Record<string, unknown> {
  const mechanical = groups.find((group) => group.property_type === "mechanical");
  const strength_category = (mechanical?.strength_groups ?? []).map((group) => {
    const category: Record<string, unknown> = {
      value_strength_category: group.strength_category ?? "",
      comment: group.comment ?? "",
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
      category[name] = structuredClone(data);
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
