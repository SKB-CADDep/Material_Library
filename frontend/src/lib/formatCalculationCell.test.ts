import { describe, expect, it } from "vitest";
import type { UnitResponse } from "../types/api";
import {
  CALCULATION_CELL_TITLES,
  calculationCellInDisplayUnit,
  calculationCellModeClass,
  calculationCellModeTitle,
  formatCalculationCell,
} from "./formatCalculationCell";

const hardnessConfig: UnitResponse = {
  unit_type: "Твердость",
  system_unit: "HB",
  units: ["HB", "HRC", "d10"],
  factors: {
    HB: 1,
    HRA: "table",
    HRC: "table",
    d10: "table",
  },
  display_labels: {},
};

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

describe("calculationCellInDisplayUnit", () => {
  it("converts hardness that is inside the table", () => {
    const shown = calculationCellInDisplayUnit(
      { value: 653, mode: "exact" },
      { baseUnit: "HB", displayUnit: "HRC", unitConfig: hardnessConfig },
    );
    expect(shown?.value).toBe(62.9);
    expect(formatCalculationCell(shown)).toBe("62.9");
  });

  it("shows an empty cell when hardness is outside the table", () => {
    const shown = calculationCellInDisplayUnit(
      { value: 74, mode: "exact" },
      { baseUnit: "HB", displayUnit: "HRC", unitConfig: hardnessConfig },
    );
    expect(shown?.value).toBeNull();
    expect(formatCalculationCell(shown)).toBe("—");
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
