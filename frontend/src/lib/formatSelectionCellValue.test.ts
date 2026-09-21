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

  it("keeps full modulus of elasticity magnitude (no /100)", () => {
    const modulusConfig: UnitResponse = {
      unit_type: "Модуль упругости",
      system_unit: "МПа",
      units: ["МПа", "ГПа"],
      factors: { МПа: 1, ГПа: 1000 },
      display_labels: {},
    };
    expect(
      formatSelectionCellValue(199500, {
        columnKey: "modulus_elasticity",
        baseUnit: "МПа",
        displayUnit: "МПа",
        unitConfig: modulusConfig,
      }),
    ).toBe("199500.00");
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

  it("converts linear expansion from 10^-6/C to 1/C", () => {
    const expansionConfig: UnitResponse = {
      unit_type: "Коэффициент линейного расширения",
      system_unit: "10^-6/C",
      units: ["10^-6/C", "1/С"],
      factors: { "10^-6/C": 1, "1/С": 1e6 },
      display_labels: {},
    };
    expect(
      formatSelectionCellValue(10.5, {
        columnKey: "coefficient_linear_expansion",
        baseUnit: "10^-6/C",
        displayUnit: "1/С",
        unitConfig: expansionConfig,
      }),
    ).toBe("1.05e-5");
  });

  it("converts hardness via table instead of NaN", () => {
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
    expect(
      formatSelectionCellValue(653, {
        columnKey: "min_value",
        baseUnit: "HB",
        displayUnit: "HRC",
        unitConfig: hardnessConfig,
        rowSourceUnit: "HB",
      }),
    ).toBe("62.90");
  });

  it("keeps source hardness when table conversion is out of range", () => {
    const hardnessConfig: UnitResponse = {
      unit_type: "Твердость",
      system_unit: "HB",
      units: ["HB", "HRC"],
      factors: { HB: 1, HRC: "table" },
      display_labels: {},
    };
    expect(
      formatSelectionCellValue(74, {
        columnKey: "min_value",
        baseUnit: "HB",
        displayUnit: "HRC",
        unitConfig: hardnessConfig,
        rowSourceUnit: "HB",
      }),
    ).toBe("74.00");
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
