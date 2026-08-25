import { describe, expect, it } from "vitest";
import { resolveLinearExpansionUnit } from "./linearExpansionUnit";

describe("resolveLinearExpansionUnit", () => {
  it("defaults empty and 10e-6 aliases to catalog unit", () => {
    expect(resolveLinearExpansionUnit("", [10.5])).toBe("10^-6/C");
    expect(resolveLinearExpansionUnit("10e-6/C", [10.5])).toBe("10^-6/C");
  });

  it("treats mislabeled 1/С with scaled values as 10^-6/C", () => {
    expect(resolveLinearExpansionUnit("1/С", [10.5, 11.1])).toBe("10^-6/C");
  });

  it("keeps true 1/С after conversion to ~1e-5", () => {
    expect(resolveLinearExpansionUnit("1/С", [1.05e-5])).toBe("1/С");
  });

  it("keeps already canonical unit", () => {
    expect(resolveLinearExpansionUnit("10^-6/C", [10.5])).toBe("10^-6/C");
  });
});
