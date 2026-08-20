import { describe, expect, it } from "vitest";
import {
  chemicalEffectiveBounds,
  safeFloat,
  type ToleranceType,
} from "./chemicalEffectiveBounds";
import type { ChemElementValueEntry } from "./chemComparisonPivot";

describe("safeFloat", () => {
  it("parses comma decimals and trims strings", () => {
    expect(safeFloat("0,17")).toBe(0.17);
    expect(safeFloat("  1.5  ")).toBe(1.5);
  });

  it("returns default for empty or invalid input", () => {
    expect(safeFloat("")).toBeNull();
    expect(safeFloat("abc", 0)).toBe(0);
    expect(safeFloat(null)).toBeNull();
  });
});

describe("chemicalEffectiveBounds", () => {
  const baseElem: ChemElementValueEntry = {
    element: "C",
    min_value: 0.2,
    max_value: 0.3,
  };

  it("uses absolute tolerance fields as effective bounds", () => {
    const elem: ChemElementValueEntry = {
      ...baseElem,
      min_value_tolerance: 0.15,
      max_value_tolerance: 0.35,
    };
    const [lower, upper, minTol, maxTol] = chemicalEffectiveBounds(
      elem,
      "absolute",
    );
    expect(lower).toBe(0.15);
    expect(upper).toBe(0.35);
    expect(minTol).toBe(0.15);
    expect(maxTol).toBe(0.35);
  });

  it("falls back to nominal min/max when tolerance missing (absolute)", () => {
    const [lower, upper] = chemicalEffectiveBounds(baseElem, "absolute");
    expect(lower).toBe(0.2);
    expect(upper).toBe(0.3);
  });

  it("expands bounds with relative tolerance percent", () => {
    const elem: ChemElementValueEntry = {
      ...baseElem,
      min_value_tolerance_relative: 10,
      max_value_tolerance_relative: 10,
    };
    const [lower, upper] = chemicalEffectiveBounds(elem, "relative");
    expect(lower).toBeCloseTo(0.18);
    expect(upper).toBeCloseTo(0.33);
  });

  it("uses infinities when bounds are completely open", () => {
    const elem: ChemElementValueEntry = { element: "N" };
    const [lower, upper] = chemicalEffectiveBounds(
      elem,
      "absolute" as ToleranceType,
    );
    expect(lower).toBe(Number.NEGATIVE_INFINITY);
    expect(upper).toBe(Number.POSITIVE_INFINITY);
  });
});
