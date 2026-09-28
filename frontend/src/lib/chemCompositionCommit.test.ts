import { describe, expect, it } from "vitest";
import {
  commitChemicalElementForSave,
  commitChemicalCompositionInMaterial,
} from "./chemCompositionCommit";

describe("commitChemicalElementForSave", () => {
  it("turns typing strings into numbers", () => {
    const stored = commitChemicalElementForSave({
      element: "C",
      unit_value: "%",
      min_value: "0.",
      max_value: "",
      min_value_tolerance: "0.01",
      max_value_tolerance: "0.02",
      min_value_tolerance_relative: "",
      max_value_tolerance_relative: "",
    });
    expect(stored.min_value).toBe(0);
    expect(stored.max_value).toBe(0);
    expect(typeof stored.min_value_tolerance).toBe("number");
    expect(typeof stored.min_value_tolerance_relative).toBe("number");
  });
});

describe("commitChemicalCompositionInMaterial", () => {
  it("commits all other_elements before save", () => {
    const body = {
      material_id: "m1",
      chemical_properties: {
        composition: [
          {
            composition_source: "ГОСТ",
            other_elements: [
              {
                element: "Cr",
                unit_value: "%",
                min_value: "12",
                max_value: "14",
                min_value_tolerance: "",
                max_value_tolerance: "",
                min_value_tolerance_relative: "0.1",
                max_value_tolerance_relative: "0.2",
              },
            ],
          },
        ],
      },
    };
    const next = commitChemicalCompositionInMaterial(
      structuredClone(body) as Record<string, unknown>,
    );
    const el = (
      next.chemical_properties as {
        composition: Array<{ other_elements: Array<Record<string, unknown>> }>;
      }
    ).composition[0].other_elements[0];
    expect(el.min_value).toBe(12);
    expect(el.max_value).toBe(14);
    expect(typeof el.min_value_tolerance).toBe("number");
    expect(typeof el.min_value_tolerance_relative).toBe("number");
  });
});
