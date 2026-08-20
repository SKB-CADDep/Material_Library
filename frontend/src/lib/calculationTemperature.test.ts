import { describe, expect, it } from "vitest";
import type { SingleCalculationRow } from "../types/api";
import {
  formatCalculationTemperature,
  isDuplicateCalculationTemperature,
  parseCalculationTemperature,
  temperaturesEqual,
} from "./calculationTemperature";

describe("parseCalculationTemperature", () => {
  it("parses comma decimal and trims", () => {
    expect(parseCalculationTemperature(" 100,5 ")).toBe(100.5);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseCalculationTemperature("")).toBeNull();
    expect(parseCalculationTemperature("abc")).toBeNull();
  });
});

describe("temperaturesEqual", () => {
  it("compares with epsilon tolerance", () => {
    expect(temperaturesEqual(100, 100.0000005)).toBe(true);
    expect(temperaturesEqual(100, 100.01)).toBe(false);
  });
});

describe("isDuplicateCalculationTemperature", () => {
  const dbRows: SingleCalculationRow[] = [
    { temperature: 20, values: {} },
    { temperature: "200", values: {} },
  ];

  it("detects duplicates in custom temps and db rows", () => {
    expect(isDuplicateCalculationTemperature(20, [], dbRows)).toBe(true);
    expect(isDuplicateCalculationTemperature(200, [150], dbRows)).toBe(true);
    expect(isDuplicateCalculationTemperature(300, [150], dbRows)).toBe(false);
    expect(isDuplicateCalculationTemperature(150, [150.0000001], [])).toBe(
      true,
    );
  });
});

describe("formatCalculationTemperature", () => {
  it("stringifies temperature", () => {
    expect(formatCalculationTemperature(20)).toBe("20");
    expect(formatCalculationTemperature(20.5)).toBe("20.5");
  });
});
