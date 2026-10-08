import {
  categoryDisplayName,
  type StrengthCategoryFields,
} from "./strengthCategory";

export type HardnessRow = {
  unit_value?: string;
  /** number в JSON; string — незавершённый ввод в UI («2.»). */
  min_value?: number | string | null;
  max_value?: number | string | null;
};

type MechanicalPropsSlice = {
  strength_category?: StrengthCategoryFields[];
};

function asOptionalFinite(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function isEmptyHardnessRow(row: HardnessRow | null | undefined): boolean {
  if (!row) return true;
  return (
    asOptionalFinite(row.min_value) === undefined &&
    asOptionalFinite(row.max_value) === undefined
  );
}

export function commitHardnessRow(
  row: HardnessRow,
  fallbackUnit: string,
): HardnessRow {
  const min = asOptionalFinite(row.min_value);
  const max = asOptionalFinite(row.max_value);
  const unit =
    String(row.unit_value ?? "").trim() || fallbackUnit || "HB";
  return {
    unit_value: unit,
    ...(min !== undefined ? { min_value: min } : {}),
    ...(max !== undefined ? { max_value: max } : {}),
  };
}

/** Пустые строки hardness не пишем в JSON. */
export function commitHardnessInMaterial(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const mechanical = body.mechanical_properties as MechanicalPropsSlice | undefined;
  const categories = mechanical?.strength_category;
  if (!Array.isArray(categories)) {
    return body;
  }

  for (const cat of categories) {
    if (!cat || !Array.isArray(cat.hardness)) {
      continue;
    }
    const fallbackUnit = String(cat.hardness_unit ?? "").trim() || "HB";
    cat.hardness = (cat.hardness as HardnessRow[])
      .filter((row) => !isEmptyHardnessRow(row))
      .map((row) => commitHardnessRow(row, fallbackUnit));
  }
  return body;
}

/** min ≤ max для заполненных пар; пустые строки не считаем ошибкой (их срежет commit). */
export function validateHardnessRanges(
  body: Record<string, unknown>,
): string | null {
  const categories =
    (body.mechanical_properties as MechanicalPropsSlice | undefined)
      ?.strength_category ?? [];

  for (const [i, cat] of categories.entries()) {
    const rows = (cat.hardness as HardnessRow[] | undefined) ?? [];
    for (const [j, row] of rows.entries()) {
      if (isEmptyHardnessRow(row)) continue;
      const min = asOptionalFinite(row.min_value);
      const max = asOptionalFinite(row.max_value);
      if (min !== undefined && max !== undefined && min > max) {
        const label = categoryDisplayName(cat, i);
        return `В твёрдости КП «${label}»: минимум не может быть больше максимума (строка ${j + 1})`;
      }
    }
  }
  return null;
}
