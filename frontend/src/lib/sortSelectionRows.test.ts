import { describe, expect, it } from "vitest";
import type { TemperatureSelectionRow } from "../types/api";
import {
  getSelectionRowSortValue,
  sortRowsByValue,
  sortSelectionRows,
  toggleSortDirection,
} from "./sortSelectionRows";

function row(
  overrides: Partial<TemperatureSelectionRow> & Pick<TemperatureSelectionRow, "material_name">,
): TemperatureSelectionRow {
  return {
    material_id: "id",
    strength_category: "КП1",
    source: "GOST",
    values: {},
    ...overrides,
  };
}

describe("sortSelectionRows", () => {
  it("sorts numbers before strings and empty values last (asc)", () => {
    const rows = [
      row({ material_name: "C", max_temp: "—" }),
      row({ material_name: "A", max_temp: 100 }),
      row({ material_name: "B", max_temp: "50" }),
    ];

    const sorted = sortSelectionRows(rows, "max_temp", "asc");
    expect(sorted.map((r) => r.material_name)).toEqual(["B", "A", "C"]);
  });

  it("reverses order for desc", () => {
    const rows = [
      row({ material_name: "A", values: { density: 7800 } }),
      row({ material_name: "B", values: { density: 7850 } }),
    ];

    const sorted = sortSelectionRows(rows, "density", "desc");
    expect(sorted.map((r) => r.material_name)).toEqual(["B", "A"]);
  });

  it("sorts material_name case-insensitively", () => {
    const rows = [
      row({ material_name: "beta" }),
      row({ material_name: "Alpha" }),
    ];
    const sorted = sortSelectionRows(rows, "material_name", "asc");
    expect(sorted.map((r) => r.material_name)).toEqual(["Alpha", "beta"]);
  });

  it("returns same array reference for 0-1 rows", () => {
    const single = [row({ material_name: "Only" })];
    expect(sortSelectionRows(single, "material_name", "asc")).toBe(single);
    expect(sortSelectionRows([], "material_name", "asc")).toEqual([]);
  });
});

describe("getSelectionRowSortValue", () => {
  it("reads fixed and dynamic columns", () => {
    const sample = row({
      material_name: "Steel",
      source: "NTD",
      values: { yield_strength: 360 },
    });
    expect(getSelectionRowSortValue(sample, "source")).toBe("NTD");
    expect(getSelectionRowSortValue(sample, "yield_strength")).toBe(360);
    expect(getSelectionRowSortValue(sample, "missing")).toBeNull();
  });
});

describe("sortRowsByValue", () => {
  it("sorts generic rows via accessor", () => {
    const items = [{ v: "2" }, { v: 10 }, { v: null }];
    const sorted = sortRowsByValue(items, (item) => item.v, "asc");
    expect(sorted.map((item) => item.v)).toEqual(["2", 10, null]);
  });
});

describe("toggleSortDirection", () => {
  it("toggles asc/desc and defaults to asc from undefined", () => {
    expect(toggleSortDirection("asc")).toBe("desc");
    expect(toggleSortDirection("desc")).toBe("asc");
    expect(toggleSortDirection(undefined)).toBe("asc");
  });
});
