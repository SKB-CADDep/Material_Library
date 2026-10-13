import { describe, expect, it } from "vitest";
import type { SingleCalculationRow, UnitResponse } from "../types/api";
import {
  getCalculationRowSortValue,
  sortCalculationRows,
} from "./sortCalculationRows";

const hardnessConfig: UnitResponse = {
  unit_type: "Твердость",
  system_unit: "HB",
  units: ["HB", "HRC", "d10"],
  factors: { HB: 1, HRC: "table", d10: "table" },
  display_labels: {},
};

function calcRow(
  temperature: number | string,
  values: Record<string, { value: number | null; mode: string | null }> = {},
): SingleCalculationRow {
  return { temperature, values };
}

describe("sortCalculationRows", () => {
  it("sorts by temperature numerically", () => {
    const rows = [
      calcRow(200),
      calcRow(20),
      calcRow("100"),
    ];
    const sorted = sortCalculationRows(rows, "temperature", "asc");
    expect(sorted.map((r) => r.temperature)).toEqual([20, "100", 200]);
  });

  it("sorts dynamic property columns by cell value", () => {
    const rows = [
      calcRow(20, {
        yield_strength: { value: 420, mode: "interp" },
      }),
      calcRow(100, {
        yield_strength: { value: 360, mode: "interp" },
      }),
    ];
    const sorted = sortCalculationRows(rows, "yield_strength", "asc");
    expect(sorted.map((r) => r.temperature)).toEqual([100, 20]);
  });

  it("sorts hardness by the unit selected in the column header", () => {
    const rows = [
      calcRow(20, { hardness: { value: 653, mode: "exact" } }),
      calcRow(100, { hardness: { value: 712, mode: "exact" } }),
    ];
    const sorted = sortCalculationRows(rows, "hardness", "asc", {
      columns: [{ key: "hardness", unit: "HB", unit_type: "Твердость" }],
      columnUnits: { hardness: "d10" },
      unitConfigs: { Твердость: hardnessConfig },
    });
    expect(sorted.map((r) => r.temperature)).toEqual([100, 20]);
  });

  it("puts hardness outside the table after real values", () => {
    const rows = [
      calcRow(20, { hardness: { value: 74, mode: "exact" } }),
      calcRow(100, { hardness: { value: 653, mode: "exact" } }),
    ];
    const sorted = sortCalculationRows(rows, "hardness", "asc", {
      columns: [{ key: "hardness", unit: "HB", unit_type: "Твердость" }],
      columnUnits: { hardness: "HRC" },
      unitConfigs: { Твердость: hardnessConfig },
    });
    expect(sorted.map((r) => r.temperature)).toEqual([100, 20]);
  });
});

describe("getCalculationRowSortValue", () => {
  it("returns temperature or nested value", () => {
    const sample = calcRow(50, {
      density: { value: 7850, mode: null },
    });
    expect(getCalculationRowSortValue(sample, "temperature")).toBe(50);
    expect(getCalculationRowSortValue(sample, "density")).toBe(7850);
    expect(getCalculationRowSortValue(sample, "missing")).toBeNull();
  });
});
