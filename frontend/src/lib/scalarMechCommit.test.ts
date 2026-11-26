import { describe, expect, it } from "vitest";
import { validateMaterialDraftForSave } from "../api/materials";
import {
  isValidScalarMechValue,
  validateScalarMechValues,
} from "./scalarMechCommit";

describe("isValidScalarMechValue", () => {
  it("allows empty and finite numbers", () => {
    expect(isValidScalarMechValue(undefined)).toBe(true);
    expect(isValidScalarMechValue("")).toBe(true);
    expect(isValidScalarMechValue(12.5)).toBe(true);
    expect(isValidScalarMechValue("12,5")).toBe(true);
  });

  it("rejects text and incomplete decimals", () => {
    expect(isValidScalarMechValue("abc")).toBe(false);
    expect(isValidScalarMechValue("12a")).toBe(false);
    expect(isValidScalarMechValue("2.")).toBe(false);
  });
});

describe("validateScalarMechValues", () => {
  it("blocks non-numeric scalar mech value", () => {
    const error = validateScalarMechValues({
      mechanical_properties: {
        strength_category: [
          {
            value_strength_category: "КП1",
            properties: [
              {
                property_name: "relative_elongation",
                min_value: "текст",
              },
            ],
          },
        ],
      },
    });
    expect(error).toMatch(/Относительное удлинение/);
    expect(error).toMatch(/должно быть число/);
  });

  it("allows numeric and empty scalar values", () => {
    expect(
      validateScalarMechValues({
        mechanical_properties: {
          strength_category: [
            {
              value_strength_category: "КП1",
              properties: [
                { property_name: "relative_elongation", min_value: 18 },
                { property_name: "angle_of_bend" },
              ],
            },
          ],
        },
      }),
    ).toBeNull();
  });
});

describe("validateMaterialDraftForSave + scalar mech", () => {
  it("blocks save when scalar mech value is text", () => {
    const error = validateMaterialDraftForSave({
      material_id: "m1",
      chemical_properties: {
        composition: [{ composition_source: "ГОСТ", other_elements: [] }],
      },
      mechanical_properties: {
        strength_category: [
          {
            value_strength_category: "КП1",
            source_ref_id: "src-1",
            properties: [
              {
                property_name: "relative_contraction",
                min_value: "нет",
              },
            ],
          },
        ],
      },
    });
    expect(error).toMatch(/Относительное сужение/);
  });
});
