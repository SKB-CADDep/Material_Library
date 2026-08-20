import { describe, expect, it } from "vitest";
import type { UnitResponse } from "../types/api";
import {
  formatSelectionCellValue,
  formatSelectionFrozenValue,
  syncHardnessColumnUnits,
} from "./formatSelectionCellValue";

const tempConfig: UnitResponse = {
  system_unit: "C",
  units: ["C", "K"],
  factors: { C: 1, K: "offset_k" },
};

describe("formatSelectionFrozenValue", () => {
  it("formats null as dash", () => {
    expect(formatSelectionFrozenValue(null)).toBe("-");
    expect(formatSelectionFrozenValue("Steel")).toBe("Steel");
  });
});

describe("formatSelectionCellValue", () => {
  it("returns display unit for unit_value column", () => {
    expect(
      formatSelectionCellValue("HB", {
        columnKey: "unit_value",
        baseUnit: "",
        displayUnit: "HB",
      }),
    ).toBe("HB");
  });

  it("formats numeric values with two decimals", () => {
    expect(
      formatSelectionCellValue(360.456, {
        columnKey: "yield_strength",
        baseUnit: "МПа",
        displayUnit: "МПа",
      }),
    ).toBe("360.46");
  });

  it("converts units when config provided", () => {
    expect(
      formatSelectionCellValue(273.15, {
        columnKey: "temperature",
        baseUnit: "K",
        displayUnit: "C",
        unitConfig: tempConfig,
      }),
    ).toBe("0.00");
  });

  it("uses row hardness unit for min/max columns", () => {
    expect(
      formatSelectionCellValue(120, {
        columnKey: "min_value",
        baseUnit: "HB",
        displayUnit: "HB",
        rowSourceUnit: "HRC",
      }),
    ).toBe("120.00");
  });
});

describe("syncHardnessColumnUnits", () => {
  it("syncs all hardness keys together", () => {
    expect(
      syncHardnessColumnUnits("min_value", "HRC", {
        min_value: "HB",
        max_value: "HB",
        unit_value: "HB",
        density: "кг/м3",
      }),
    ).toEqual({
      min_value: "HRC",
      max_value: "HRC",
      unit_value: "HRC",
      density: "кг/м3",
    });
  });

  it("updates only target column for non-hardness keys", () => {
    expect(syncHardnessColumnUnits("density", "г/см3", {})).toEqual({
      density: "г/см3",
    });
  });
});
