import { describe, expect, it } from "vitest";
import type { TemperatureSelectionRow } from "../types/api";
import { createSelectionRowIds, getSelectionTableRowKey } from "./SelectionTable";

function row(
  overrides: Partial<TemperatureSelectionRow>,
): TemperatureSelectionRow {
  return {
    material_id: "mat-1",
    material_name: "08Х13",
    strength_category: "КП40",
    source: "НТД",
    category_index: 0,
    source_ref_id: "src-1",
    values: {},
    ...overrides,
  };
}

describe("getSelectionTableRowKey", () => {
  it("distinguishes hardness rows in the same strength category", () => {
    const a = row({
      hardness_index: 0,
      values: { min_value: 18.7, max_value: 217, unit_value: "d10" },
    });
    const b = row({
      hardness_index: 1,
      values: { min_value: 5, max_value: 35.8, unit_value: "d10" },
    });
    expect(getSelectionTableRowKey(a, 0)).not.toBe(getSelectionTableRowKey(b, 1));
  });

  it("falls back to values when hardness_index is missing", () => {
    const a = row({
      values: { min_value: 187, max_value: 217, unit_value: "HB" },
    });
    const b = row({
      values: { min_value: 100, max_value: 120, unit_value: "HB" },
    });
    expect(getSelectionTableRowKey(a, 0)).not.toBe(getSelectionTableRowKey(b, 1));
  });

  it("keeps identical hardness rows apart when hardness_index is missing", () => {
    const values = { min_value: 100, max_value: 120, unit_value: "HB" };
    const a = row({ values });
    const b = row({ values });
    expect(getSelectionTableRowKey(a, 0)).not.toBe(getSelectionTableRowKey(b, 1));
  });

  it("keeps the same id when the row object is only reordered", () => {
    const idOf = createSelectionRowIds();
    const a = row({ values: { min_value: 100, max_value: 120, unit_value: "HB" } });
    const b = row({ values: { min_value: 100, max_value: 120, unit_value: "HB" } });
    const first = [a, b];
    const sorted = [b, a];
    const keyA = getSelectionTableRowKey(a, idOf(first[0]));
    const keyB = getSelectionTableRowKey(b, idOf(first[1]));
    expect(getSelectionTableRowKey(sorted[0], idOf(sorted[0]))).toBe(keyB);
    expect(getSelectionTableRowKey(sorted[1], idOf(sorted[1]))).toBe(keyA);
  });
});
