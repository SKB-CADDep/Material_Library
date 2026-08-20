import { describe, expect, it } from "vitest";
import {
  buildChemComparisonView,
  elementCatalogName,
  type CompositionEntry,
} from "./chemComparisonPivot";
import type { SourceItem } from "../types/api";

const chemicalSources: SourceItem[] = [
  {
    id_source: "src-1",
    name_source: "GOST 123",
    description: "",
    hyperlink: "",
    user_name_change: "",
    data_change: "",
    user_name_found: "",
    data_found: "",
  },
];

describe("elementCatalogName", () => {
  it("returns Russian name from catalog for known symbol", () => {
    expect(elementCatalogName("C")).toBe("Углерод");
  });

  it("returns empty string for blank symbol", () => {
    expect(elementCatalogName("  ")).toBe("");
  });
});

describe("buildChemComparisonView", () => {
  it("returns empty view for no composition entries", () => {
    expect(buildChemComparisonView([], chemicalSources)).toEqual({
      columns: [],
      rows: [],
    });
  });

  it("marks row hasDiff when formatted values differ across sources", () => {
    const composition: CompositionEntry[] = [
      {
        composition_source: "Source A",
        base_element: "Fe",
        other_elements: [
          { element: "C", unit_value: "%", min_value: 0.17, max_value: 0.24 },
          { element: "Mn", unit_value: "%", min_value: 0.35, max_value: 0.65 },
        ],
      },
      {
        composition_source: "Source B",
        base_element: "Fe",
        other_elements: [
          { element: "C", unit_value: "%", min_value: 0.20, max_value: 0.25 },
          { element: "Mn", unit_value: "%", min_value: 0.35, max_value: 0.65 },
        ],
      },
    ];

    const view = buildChemComparisonView(composition, chemicalSources);
    expect(view.columns).toHaveLength(2);
    expect(view.rows).toHaveLength(2);

    const carbon = view.rows.find((row) => row.symbol === "C");
    const manganese = view.rows.find((row) => row.symbol === "Mn");

    expect(carbon?.hasDiff).toBe(true);
    expect(manganese?.hasDiff).toBe(false);
    expect(view.columns[0]?.baseElement).toBe("Fe");
    expect(view.columns[0]?.unit).toBe("%");
  });

  it("resolves source label from chemical_sources by ref id", () => {
    const composition: CompositionEntry[] = [
      {
        source_ref_id: "src-1",
        composition_subsource: "вариант 1",
        base_element: "Fe",
        other_elements: [
          { element: "C", unit_value: "%", min_value: 0.1, max_value: 0.2 },
        ],
      },
    ];

    const view = buildChemComparisonView(composition, chemicalSources);
    expect(view.columns[0]?.label).toBe("GOST 123 (вариант 1)");
  });
});
