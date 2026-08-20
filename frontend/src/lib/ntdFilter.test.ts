import { describe, expect, it } from "vitest";
import type { TemperatureSelectionRow } from "../types/api";
import {
  collectNtdFilterOptions,
  filterRowsByNtd,
  normalizeNtdLabel,
  rowMatchesNtdFilter,
} from "./ntdFilter";

function row(source: string | null): TemperatureSelectionRow {
  return {
    material_id: "id",
    material_name: "Steel",
    strength_category: "КП1",
    source,
    values: {},
  };
}

describe("normalizeNtdLabel", () => {
  it("trims and uses em dash for empty", () => {
    expect(normalizeNtdLabel("  GOST  ")).toBe("GOST");
    expect(normalizeNtdLabel(null)).toBe("—");
  });
});

describe("collectNtdFilterOptions", () => {
  it("returns unique sorted labels", () => {
    const options = collectNtdFilterOptions([
      row("GOST B"),
      row("GOST A"),
      row("GOST A"),
      row(null),
    ]);
    expect(options).toEqual(["—", "GOST A", "GOST B"]);
  });
});

describe("rowMatchesNtdFilter", () => {
  it("matches all rows when filter empty", () => {
    expect(rowMatchesNtdFilter(row("X"), "")).toBe(true);
  });

  it("matches normalized source label", () => {
    expect(rowMatchesNtdFilter(row("  GOST  "), "GOST")).toBe(true);
    expect(rowMatchesNtdFilter(row("Other"), "GOST")).toBe(false);
  });
});

describe("filterRowsByNtd", () => {
  it("filters rows by selected NTD", () => {
    const rows = [row("A"), row("B")];
    expect(filterRowsByNtd(rows, "A")).toEqual([row("A")]);
    expect(filterRowsByNtd(rows, "")).toBe(rows);
  });
});
