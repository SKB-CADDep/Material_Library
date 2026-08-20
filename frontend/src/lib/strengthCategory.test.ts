import { describe, expect, it } from "vitest";
import type { SourceItem } from "../types/api";
import {
  buildStrengthCategoryNtdOptions,
  categoryDisplayName,
  formatCategoryOptionLabel,
  hasCategorySource,
  indicesForStrengthCategoryName,
  resolveCategorySourceName,
  uniqueStrengthCategoryNames,
} from "./strengthCategory";

function strengthSource(id: string, name: string): SourceItem {
  return {
    id_source: id,
    name_source: name,
    description: "",
    hyperlink: "",
    user_name_change: "",
    data_change: "",
    user_name_found: "",
    data_found: "",
  };
}

describe("strengthCategory helpers", () => {
  it("categoryDisplayName uses value or fallback index", () => {
    expect(categoryDisplayName({ value_strength_category: "КП23" }, 0)).toBe(
      "КП23",
    );
    expect(categoryDisplayName({}, 2)).toBe("КП #3");
  });

  it("resolveCategorySourceName prefers ref id", () => {
    const cat = { source_ref_id: "src-1", source_strength_category: "Legacy" };
    expect(
      resolveCategorySourceName(cat, [strengthSource("src-1", "GOST 19281")]),
    ).toBe("GOST 19281");
  });

  it("hasCategorySource detects ref, legacy, or property source", () => {
    expect(hasCategorySource({ source_ref_id: "x" })).toBe(true);
    expect(hasCategorySource({ source_strength_category: "NTD" })).toBe(true);
    expect(
      hasCategorySource({
        yield_strength: { property_source: "Book" },
      }),
    ).toBe(true);
    expect(hasCategorySource({})).toBe(false);
  });

  it("formatCategoryOptionLabel joins name and NTD", () => {
    const label = formatCategoryOptionLabel(
      { value_strength_category: "КП360", source_ref_id: "src-1" },
      0,
      [strengthSource("src-1", "GOST")],
    );
    expect(label).toBe("КП360 — GOST");
  });

  it("uniqueStrengthCategoryNames preserves first-seen order", () => {
    const names = uniqueStrengthCategoryNames([
      { value_strength_category: "КП23" },
      { value_strength_category: "КП360" },
      { value_strength_category: "КП23" },
    ]);
    expect(names).toEqual(["КП23", "КП360"]);
  });

  it("indicesForStrengthCategoryName returns all matching indices", () => {
    const categories = [
      { value_strength_category: "КП23" },
      { value_strength_category: "КП360" },
      { value_strength_category: "КП23" },
    ];
    expect(indicesForStrengthCategoryName(categories, "КП23")).toEqual([0, 2]);
  });

  it("buildStrengthCategoryNtdOptions disambiguates duplicate labels", () => {
    const categories = [
      {
        value_strength_category: "КП23",
        source_strength_category: "Same",
      },
      {
        value_strength_category: "КП23",
        source_strength_category: "Same",
      },
    ];
    const options = buildStrengthCategoryNtdOptions(
      categories,
      "КП23",
      [],
    );
    expect(options).toEqual([
      { index: 0, label: "Same (#1)" },
      { index: 1, label: "Same (#2)" },
    ]);
  });
});
