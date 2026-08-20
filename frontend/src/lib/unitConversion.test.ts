import { describe, expect, it } from "vitest";
import {
  convertBetweenUnits,
  fromSystem,
  toSystem,
  type UnitConfig,
} from "./unitConversion";

const tempConfig: UnitConfig = {
  system_unit: "C",
  factors: { C: 1, K: "offset_k", F: "offset_f" },
};

const pressureConfig: UnitConfig = {
  system_unit: "кгс/см2",
  factors: { "кгс/см2": 1, МПа: 10.197162 },
};

describe("toSystem / fromSystem", () => {
  it("converts Celsius via identity", () => {
    expect(toSystem(100, "C", tempConfig)).toBe(100);
    expect(fromSystem(100, "C", tempConfig)).toBe(100);
  });

  it("converts Kelvin offset to Celsius", () => {
    expect(toSystem(273.15, "K", tempConfig)).toBeCloseTo(0);
    expect(fromSystem(0, "K", tempConfig)).toBeCloseTo(273.15);
  });

  it("converts Fahrenheit offset to Celsius", () => {
    expect(toSystem(32, "F", tempConfig)).toBeCloseTo(0);
    expect(fromSystem(0, "F", tempConfig)).toBeCloseTo(32);
  });

  it("returns value unchanged for unknown unit", () => {
    expect(toSystem(5, "X", tempConfig)).toBe(5);
    expect(fromSystem(5, "X", tempConfig)).toBe(5);
  });

  it("multiplies by factor for linear units", () => {
    expect(toSystem(1, "МПа", pressureConfig)).toBeCloseTo(10.197162);
    expect(fromSystem(10.197162, "МПа", pressureConfig)).toBeCloseTo(1);
  });
});

describe("convertBetweenUnits", () => {
  it("returns same value for identical units", () => {
    expect(convertBetweenUnits(50, "C", "C", tempConfig)).toBe(50);
  });

  it("converts K to F through system unit", () => {
    const celsius = convertBetweenUnits(373.15, "K", "C", tempConfig);
    expect(celsius).toBeCloseTo(100);
    const fahrenheit = convertBetweenUnits(100, "C", "F", tempConfig);
    expect(fahrenheit).toBeCloseTo(212);
  });
});
