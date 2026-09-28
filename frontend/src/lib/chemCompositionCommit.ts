import {
  coerceChemNumber,
  coerceChemToleranceInput,
  chemFieldDisplay,
} from "./chemElementNormalize";
import {
  applyChemToleranceSync,
  fillMissingChemTolerances,
  type ChemToleranceFields,
} from "./chemToleranceSync";

type ChemFormFields = ChemToleranceFields & {
  element?: string;
  unit_value?: string;
};

export type StoredChemicalElement = {
  element: string;
  unit_value: string;
  min_value: number;
  max_value: number;
  min_value_tolerance: number;
  max_value_tolerance: number;
  min_value_tolerance_relative: number;
  max_value_tolerance_relative: number;
};

function toFormFields(raw: Partial<ChemFormFields>): ChemFormFields & {
  element: string;
  unit_value: string;
} {
  const el = {
    element: String(raw.element ?? ""),
    unit_value: String(raw.unit_value ?? "%"),
    min_value: chemFieldDisplay(raw.min_value),
    max_value: chemFieldDisplay(raw.max_value),
    min_value_tolerance: chemFieldDisplay(raw.min_value_tolerance),
    max_value_tolerance: chemFieldDisplay(raw.max_value_tolerance),
    min_value_tolerance_relative: chemFieldDisplay(
      raw.min_value_tolerance_relative,
    ),
    max_value_tolerance_relative: chemFieldDisplay(
      raw.max_value_tolerance_relative,
    ),
  };
  const relAbsent =
    raw.min_value_tolerance_relative == null &&
    raw.max_value_tolerance_relative == null;
  const absAbsent =
    raw.min_value_tolerance == null && raw.max_value_tolerance == null;
  if (relAbsent || absAbsent) {
    return fillMissingChemTolerances(el);
  }
  return el;
}

function commitFormFields<T extends ChemToleranceFields>(el: T): T {
  return {
    ...el,
    min_value: coerceChemToleranceInput(el.min_value),
    max_value: coerceChemToleranceInput(el.max_value),
    min_value_tolerance: coerceChemToleranceInput(el.min_value_tolerance),
    max_value_tolerance: coerceChemToleranceInput(el.max_value_tolerance),
    min_value_tolerance_relative: coerceChemToleranceInput(
      el.min_value_tolerance_relative,
    ),
    max_value_tolerance_relative: coerceChemToleranceInput(
      el.max_value_tolerance_relative,
    ),
  };
}

function toStoredElement(el: ChemFormFields & { element: string; unit_value: string }): StoredChemicalElement {
  return {
    element: el.element,
    unit_value: el.unit_value,
    min_value: coerceChemNumber(el.min_value),
    max_value: coerceChemNumber(el.max_value),
    min_value_tolerance: coerceChemNumber(el.min_value_tolerance),
    max_value_tolerance: coerceChemNumber(el.max_value_tolerance),
    min_value_tolerance_relative: coerceChemNumber(
      el.min_value_tolerance_relative,
    ),
    max_value_tolerance_relative: coerceChemNumber(
      el.max_value_tolerance_relative,
    ),
  };
}

/** Как blur+commit: пустые/недописанные → числа, ABS↔REL согласованы. */
export function commitChemicalElementForSave(
  raw: Partial<ChemFormFields>,
): StoredChemicalElement {
  let el = toFormFields(raw);
  el = commitFormFields(el);
  el = applyChemToleranceSync(el, "bounds");
  return toStoredElement(el);
}

/**
 * Перед записью на диск: все other_elements во всех наборах состава → числа.
 * Не меняет остальные поля материала (мутирует копию caller'а или исходный объект).
 */
export function commitChemicalCompositionInMaterial(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const chemical = body.chemical_properties as
    | { composition?: Array<{ other_elements?: unknown[] }> }
    | undefined;
  if (!chemical || !Array.isArray(chemical.composition)) {
    return body;
  }

  for (const entry of chemical.composition) {
    if (!entry || !Array.isArray(entry.other_elements)) {
      continue;
    }
    entry.other_elements = entry.other_elements.map((row) =>
      commitChemicalElementForSave(
        (row ?? {}) as Partial<ChemFormFields>,
      ),
    );
  }
  return body;
}
