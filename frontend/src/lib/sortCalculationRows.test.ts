import { describe, expect, it } from "vitest";
import type { SingleCalculationRow } from "../types/api";
import {
  getCalculationRowSortValue,
  sortCalculationRows,
} from "./sortCalculationRows";

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
