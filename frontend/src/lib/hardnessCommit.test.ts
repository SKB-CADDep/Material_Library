import { describe, expect, it } from "vitest";
import {
  commitHardnessInMaterial,
  isEmptyHardnessRow,
  validateHardnessRanges,
} from "./hardnessCommit";

describe("isEmptyHardnessRow", () => {
  it("treats missing bounds as empty", () => {
    expect(isEmptyHardnessRow({ unit_value: "HB" })).toBe(true);
    expect(isEmptyHardnessRow({ unit_value: "HB", min_value: 100 })).toBe(
      false,
    );
  });
});

describe("commitHardnessInMaterial", () => {
  it("strips empty hardness rows and keeps partial/full", () => {
    const body = {
      mechanical_properties: {
        strength_category: [
          {
            value_strength_category: "КП1",
            hardness_unit: "HB",
            hardness: [
              { unit_value: "HB" },
              { unit_value: "HB", min_value: 120 },
              { unit_value: "HB", min_value: 100, max_value: 200 },
            ],
          },
        ],
      },
    };

    const next = commitHardnessInMaterial(body);
    const rows = (
      next.mechanical_properties as {
        strength_category: Array<{ hardness: unknown[] }>;
      }
    ).strength_category[0]!.hardness;

    expect(rows).toEqual([
      { unit_value: "HB", min_value: 120 },
      { unit_value: "HB", min_value: 100, max_value: 200 },
    ]);
  });
});

describe("validateHardnessRanges", () => {
  it("rejects min > max", () => {
    const error = validateHardnessRanges({
      mechanical_properties: {
        strength_category: [
          {
            value_strength_category: "КП1",
            hardness: [{ unit_value: "HB", min_value: 200, max_value: 100 }],
          },
        ],
      },
    });
    expect(error).toMatch(/минимум не может быть больше максимума/);
  });

  it("allows empty rows and valid ranges", () => {
    expect(
      validateHardnessRanges({
        mechanical_properties: {
          strength_category: [
            {
              value_strength_category: "КП1",
              hardness: [
                { unit_value: "HB" },
                { unit_value: "HB", min_value: 100, max_value: 200 },
              ],
            },
          ],
        },
      }),
    ).toBeNull();
  });
});
