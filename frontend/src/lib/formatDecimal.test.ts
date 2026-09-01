import { describe, expect, it } from "vitest";
import { formatDecimal, parseDecimalInput } from "./formatDecimal";

describe("formatDecimal", () => {
  it("uses a dot and two fraction digits for ordinary values", () => {
    expect(formatDecimal(10.5)).toBe("10.50");
  });

  it("does not round a converted 1/C value to zero", () => {
    expect(formatDecimal(1.05e-5)).toBe("1.05e-5");
  });
});

describe("parseDecimalInput", () => {
  it("accepts a comma as decimal separator", () => {
    expect(parseDecimalInput("10,5")).toBe(10.5);
  });

  it("accepts a dot as decimal separator", () => {
    expect(parseDecimalInput("10.5")).toBe(10.5);
  });
});
