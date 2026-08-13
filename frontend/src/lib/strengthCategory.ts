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
  "hardness_is_acceptance",
  "properties",
  "comment",
  "source_strength_category",
  "property_source",
  "property_subsource",
  "metadata",
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

/** Уникальные имена КП в порядке первого появления. */
export function uniqueStrengthCategoryNames(
  categories: StrengthCategoryFields[],
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (let index = 0; index < categories.length; index += 1) {
    const name = categoryDisplayName(categories[index], index);
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/** Индексы категорий с заданным отображаемым именем КП. */
export function indicesForStrengthCategoryName(
  categories: StrengthCategoryFields[],
  name: string,
): number[] {
  return categories.reduce<number[]>((acc, cat, index) => {
    if (categoryDisplayName(cat, index) === name) {
      acc.push(index);
    }
    return acc;
  }, []);
}

export type StrengthCategoryNtdOption = {
  index: number;
  label: string;
};

/** Варианты НТД для выбранного имени КП (модель «пара КП × источник»). */
export function buildStrengthCategoryNtdOptions(
  categories: StrengthCategoryFields[],
  categoryName: string,
  strengthSources: SourceItem[],
): StrengthCategoryNtdOption[] {
  const indices = indicesForStrengthCategoryName(categories, categoryName);
  const rawLabels = indices.map(
    (index) =>
      resolveCategorySourceName(categories[index], strengthSources).trim() ||
      "— без НТД —",
  );
  const hasDuplicateLabels = rawLabels.some(
    (label, pos) => rawLabels.indexOf(label) !== pos,
  );

  return indices.map((index) => {
    const base =
      resolveCategorySourceName(categories[index], strengthSources).trim() ||
      "— без НТД —";
    const label = hasDuplicateLabels ? `${base} (#${index + 1})` : base;
    return { index, label };
  });
}
