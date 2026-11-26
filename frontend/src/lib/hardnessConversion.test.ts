import { describe, expect, it } from "vitest";
import { convertHardness } from "./hardnessConversion";

describe("convertHardness", () => {
  it("keeps identity", () => {
    expect(convertHardness(200, "HB", "HB")).toBe(200);
  });

  it("converts HB to HRC from table row", () => {
    expect(convertHardness(653, "HB", "HRC")).toBe(62.9);
  });

  it("converts HB to HV from table row", () => {
    expect(convertHardness(653, "HB", "HV")).toBe(866);
  });

  it("converts HRC back to HB", () => {
    expect(convertHardness(62.9, "HRC", "HB")).toBe(653);
  });

  it("returns null out of range", () => {
    expect(convertHardness(74, "HB", "HRC")).toBeNull();
    expect(convertHardness(800, "HB", "HRC")).toBeNull();
  });

  it("returns null for unknown units", () => {
    expect(convertHardness(200, "XXX", "HRC")).toBeNull();
  });

  it("converts HB to d10", () => {
    expect(convertHardness(653, "HB", "d10")).toBe(2.4);
  });
});
