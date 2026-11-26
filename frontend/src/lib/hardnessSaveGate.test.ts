import { describe, expect, it } from "vitest";
import {
  prepareMaterialPayloadForSave,
  validateMaterialDraftForSave,
} from "../api/materials";

function baseDraft(
  hardness: Array<{
    unit_value?: string;
    min_value?: number;
    max_value?: number;
  }>,
): Record<string, unknown> {
  return {
    material_id: "m-hard",
    metadata: { name_material_standard: "Hard" },
    chemical_properties: {
      composition: [{ composition_source: "ГОСТ", other_elements: [] }],
    },
    mechanical_properties: {
      strength_category: [
        {
          value_strength_category: "КП1",
          source_ref_id: "src-1",
          hardness_unit: "HB",
          hardness,
        },
      ],
    },
  };
}

describe("hardness commit on save payload", () => {
  it("strips empty hardness rows from payload", () => {
    const next = prepareMaterialPayloadForSave(
      baseDraft([
        { unit_value: "HB" },
        { unit_value: "HB", min_value: 100, max_value: 200 },
      ]),
    );
    const rows = (
      next.mechanical_properties as {
        strength_category: Array<{ hardness: unknown[] }>;
      }
    ).strength_category[0]!.hardness;
    expect(rows).toEqual([
      { unit_value: "HB", min_value: 100, max_value: 200 },
    ]);
  });

  it("blocks save when min > max", () => {
    const error = validateMaterialDraftForSave(
      baseDraft([{ unit_value: "HB", min_value: 220, max_value: 100 }]),
    );
    expect(error).toMatch(/минимум не может быть больше максимума/);
  });
});
