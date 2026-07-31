import type { SourceItem } from "../types/api";

export type StrengthCategoryFields = {
  value_strength_category?: string;
  source_strength_category?: string | null;
  source_ref_id?: string | null;
  [key: string]: unknown;
};

const CATEGORY_RESERVED_KEYS = new Set([
  "strength_category",
  "value_strength_category",
  "source_ref_id",
  "hardness",
  "hardness_unit",
  "comment",
  "source_strength_category",
  "property_source",
  "property_subsource",
]);

function firstPropertySourceInCategory(cat: StrengthCategoryFields): string {
  for (const [key, val] of Object.entries(cat)) {
    if (CATEGORY_RESERVED_KEYS.has(key) || !val || typeof val !== "object") {
      continue;
    }
    const prop = val as {
      property_source?: string;
      property_subsource?: string | number | readonly string[];
    };
    const raw = String(prop.property_source ?? "").trim();
    if (!raw) {
      continue;
    }
    const sub = prop.property_subsource;
    if (sub !== undefined && sub !== null && String(sub).trim() !== "") {
      const subStr = String(sub);
      return raw ? `${raw} (${subStr})` : `(${subStr})`;
    }
    return raw;
  }
  return "";
}

/** НТД категории: source_ref_id → source_strength_category → property_source свойства. */
export function resolveCategorySourceName(
  cat: StrengthCategoryFields | undefined,
  strengthSources: SourceItem[],
): string {
  if (!cat) {
    return "";
  }
  const refId = String(cat.source_ref_id ?? "").trim();
  if (refId) {
    return (
      strengthSources.find((src) => src.id_source === refId)?.name_source ??
      refId
    );
  }
  const legacy = String(cat.source_strength_category ?? "").trim();
  if (legacy) {
    return legacy;
  }
  return firstPropertySourceInCategory(cat);
}

export function categoryDisplayName(
  cat: StrengthCategoryFields | undefined,
  index: number,
): string {
  return (
    String(cat?.value_strength_category ?? "").trim() || `КП #${index + 1}`
  );
}

/** Подпись пары КП + НТД для combobox и сообщений валидации. */
export function formatCategoryOptionLabel(
  cat: StrengthCategoryFields | undefined,
  index: number,
  strengthSources: SourceItem[],
): string {
  const name = categoryDisplayName(cat, index);
  const ntd = resolveCategorySourceName(cat, strengthSources);
  if (ntd) {
    return `${name} — ${ntd}`;
  }
  return name;
}

export function hasCategorySource(cat: StrengthCategoryFields): boolean {
  if (String(cat.source_ref_id ?? "").trim()) {
    return true;
  }
  if (String(cat.source_strength_category ?? "").trim()) {
    return true;
  }
  return Boolean(firstPropertySourceInCategory(cat));
}
