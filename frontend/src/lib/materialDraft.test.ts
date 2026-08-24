import { describe, expect, it } from "vitest";
import { materialForEditor } from "./materialDraft";

describe("materialForEditor", () => {
  it("expands property_groups when physical_properties is an empty shell", () => {
    const material = materialForEditor({
      material_id: "id-1",
      metadata: { name_material_standard: "08Х13", name_material_alternative: [] },
      physical_properties: { properties: [] },
      mechanical_properties: { strength_category: [] },
      property_groups: [
        {
          property_type: "physical",
          properties: [
            {
              property_name: "density",
              data: { temperature_value_pairs: [[20, 7760]], value_unit: "кг/м3" },
            },
          ],
        },
        {
          property_type: "mechanical",
          strength_groups: [
            {
              strength_category: "КП40",
              properties: [
                {
                  property_name: "yield_strength",
                  data: { temperature_value_pairs: [[20, 392]] },
                },
              ],
            },
          ],
        },
        {
          property_type: "chemical",
          properties: [
            {
              property_name: "composition",
              data: { base_element: "Fe" },
            },
          ],
        },
      ],
    });

    const physical = material.physical_properties as {
      properties: Array<{ property_name: string; temperature_value_pairs: unknown }>;
    };
    expect(physical.properties[0]?.property_name).toBe("density");
    expect(physical.properties[0]?.temperature_value_pairs).toEqual([[20, 7760]]);

    const mechanical = material.mechanical_properties as {
      strength_category: Array<{
        value_strength_category: string;
        properties: Array<{ property_name: string }>;
      }>;
    };
    expect(mechanical.strength_category[0]?.value_strength_category).toBe("КП40");
    expect(mechanical.strength_category[0]?.properties[0]?.property_name).toBe(
      "yield_strength",
    );

    const chemical = material.chemical_properties as {
      composition: Array<{ base_element: string }>;
    };
    expect(chemical.composition[0]?.base_element).toBe("Fe");
  });
});
