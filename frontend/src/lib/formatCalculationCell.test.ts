import { describe, expect, it } from "vitest";
import {
  CALCULATION_CELL_TITLES,
  calculationCellModeClass,
  calculationCellModeTitle,
  formatCalculationCell,
} from "./formatCalculationCell";

describe("formatCalculationCell", () => {
  it("returns an em dash for a missing value", () => {
    expect(formatCalculationCell(undefined)).toBe("—");
    expect(formatCalculationCell({ value: null, mode: "exact" })).toBe("—");
  });

  it("formats a DB value without brackets", () => {
    expect(formatCalculationCell({ value: 330, mode: "exact" })).toBe("330.0");
  });

  it("formats interpolation without parentheses", () => {
    expect(formatCalculationCell({ value: 218.5, mode: "interp" })).toBe("218.5");
  });

  it("formats extrapolation without square brackets", () => {
    expect(formatCalculationCell({ value: 410.2, mode: "approx" })).toBe("410.2");
  });
});

describe("calculationCellModeClass", () => {
  it("maps interp and approx to CSS modifiers", () => {
    expect(calculationCellModeClass("interp")).toBe("calculation-cell--interp");
    expect(calculationCellModeClass("approx")).toBe("calculation-cell--approx");
    expect(calculationCellModeClass("exact")).toBe("");
  });
});

describe("calculationCellModeTitle", () => {
  it("describes the value type for the cell tooltip", () => {
    expect(calculationCellModeTitle("exact")).toBe(CALCULATION_CELL_TITLES.exact);
    expect(calculationCellModeTitle("interp")).toBe(CALCULATION_CELL_TITLES.interp);
    expect(calculationCellModeTitle("approx")).toBe(CALCULATION_CELL_TITLES.approx);
  });
});
