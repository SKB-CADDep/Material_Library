import { describe, expect, it } from "vitest";
import { formatChemElementValue } from "./formatChemElementValue";

describe("formatChemElementValue", () => {
  it("returns dash for missing data", () => {
    expect(formatChemElementValue(null)).toBe("-");
    expect(formatChemElementValue({})).toBe("-");
  });

  it("formats min-max range with tolerances", () => {
    expect(
      formatChemElementValue({
        min_value: 0.17,
        max_value: 0.24,
        min_value_tolerance: 0.15,
        max_value_tolerance: 0.26,
      }),
    ).toBe("(0.15) 0.17 - 0.24 (0.26)");
  });

  it("formats one-sided bounds", () => {
    expect(formatChemElementValue({ max_value: 0.3 })).toBe("≤ 0.3");
    expect(formatChemElementValue({ min_value: 0.1 })).toBe("≥ 0.1");
  });

  it("treats zero bounds as empty", () => {
    expect(formatChemElementValue({ min_value: 0, max_value: 0.2 })).toBe(
      "≤ 0.2",
    );
  });
});
