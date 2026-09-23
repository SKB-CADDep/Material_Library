import { describe, expect, it } from "vitest";
import {
  coerceChemNumber,
  coerceChemToleranceInput,
  chemToleranceDisplay,
} from "./chemElementNormalize";

describe("coerceChemNumber", () => {
  it("maps empty/null/NaN to 0", () => {
    expect(coerceChemNumber(null)).toBe(0);
    expect(coerceChemNumber(undefined)).toBe(0);
    expect(coerceChemNumber("")).toBe(0);
    expect(coerceChemNumber(Number.NaN)).toBe(0);
  });

  it("keeps values greater than zero", () => {
    expect(coerceChemNumber(0.08)).toBe(0.08);
    expect(coerceChemNumber("0,15")).toBe(0.15);
  });

  it("keeps explicit zero", () => {
    expect(coerceChemNumber(0)).toBe(0);
    expect(coerceChemNumber("0.0")).toBe(0);
  });
});

describe("coerceChemToleranceInput", () => {
  it("maps empty and zero to 0.0 string", () => {
    expect(coerceChemToleranceInput("")).toBe("0.0");
    expect(coerceChemToleranceInput(null)).toBe("0.0");
    expect(coerceChemToleranceInput(0)).toBe("0.0");
    expect(coerceChemToleranceInput("0")).toBe("0.0");
  });

  it("preserves entered positive strings", () => {
    expect(coerceChemToleranceInput("0.09")).toBe("0.09");
    expect(coerceChemToleranceInput("0,15")).toBe("0.15");
  });
});

describe("chemToleranceDisplay", () => {
  it("keeps in-progress decimal strings", () => {
    expect(chemToleranceDisplay("0.")).toBe("0.");
    expect(chemToleranceDisplay("0.0")).toBe("0.0");
  });

  it("maps null and numeric zero to 0.0", () => {
    expect(chemToleranceDisplay(null)).toBe("0.0");
    expect(chemToleranceDisplay(0)).toBe("0.0");
  });
});
