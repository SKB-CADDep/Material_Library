import {
  categoryDisplayName,
  type StrengthCategoryFields,
} from "./strengthCategory";
import { findNamedProp, type NamedProperty } from "./namedProperties";

/** Скалярные мех. свойства (независимые от T): значение в min_value. */
export const SCALAR_MECH_PROPERTY_KEYS = [
  "relative_elongation",
  "relative_contraction",
  "angle_of_bend",
] as const;

export type ScalarMechPropertyKey = (typeof SCALAR_MECH_PROPERTY_KEYS)[number];

export const SCALAR_MECH_PROPERTY_LABELS: Record<ScalarMechPropertyKey, string> =
  {
    relative_elongation: "Относительное удлинение",
    relative_contraction: "Относительное сужение",
    angle_of_bend: "Угол изгиба",
  };

type MechanicalPropsSlice = {
  strength_category?: StrengthCategoryFields[];
};

/** Пустое значение допустимо; иначе — только конечное число. */
export function isValidScalarMechValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim().replace(",", ".");
    if (!trimmed) {
      return true;
    }
    // Без «2.» / «abc» — только законченное число.
    if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      return false;
    }
    return Number.isFinite(Number(trimmed));
  }
  return false;
}

export function validateScalarMechValues(
  body: Record<string, unknown>,
): string | null {
  const categories =
    (body.mechanical_properties as MechanicalPropsSlice | undefined)
      ?.strength_category ?? [];

  for (const [i, cat] of categories.entries()) {
    if (!cat) continue;
    const kpLabel = categoryDisplayName(cat, i);
    for (const key of SCALAR_MECH_PROPERTY_KEYS) {
      const prop = findNamedProp(cat, key) as NamedProperty | undefined;
      if (!prop) continue;
      if (isValidScalarMechValue(prop.min_value)) continue;
      const name = SCALAR_MECH_PROPERTY_LABELS[key];
      return `В поле «${name}» (КП «${kpLabel}») должно быть число, а не текст`;
    }
  }
  return null;
}
