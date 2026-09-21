import { describe, expect, it } from "vitest";
import {
  ELEMENTS_MAP,
  elementDisplayName,
  formatInfluenceText,
  parseElementInfluence,
  parseInfluenceText,
} from "./elementsCatalog";

describe("elementsCatalog", () => {
  it("contains known element in map", () => {
    expect(ELEMENTS_MAP.has("C")).toBe(true);
    expect(elementDisplayName("C")).toBe("Углерод");
  });

  it("falls back to symbol for unknown element", () => {
    expect(elementDisplayName("Xy")).toBe("Xy");
  });

  it("parseElementInfluence extracts improves/reduces lines", () => {
    const parsed = parseElementInfluence("C");
    expect(parsed.header).toContain("Углерод");
    expect(parsed.header).toContain("C");
    if (ELEMENTS_MAP.get("C")?.influence) {
      expect(parsed.improves.startsWith("    - Повышает")).toBe(true);
    }
  });

  it("parseInfluenceText and formatInfluenceText round-trip", () => {
    const tip =
      "Углерод.\nПовышает: Твердость, прочность, упругость.\nСнижает: Пластичность, вязкость.";
    const parts = parseInfluenceText(tip);
    expect(parts.improves).toBe("Твердость, прочность, упругость");
    expect(parts.reduces).toBe("Пластичность, вязкость");
    expect(formatInfluenceText("Углерод", parts)).toBe(tip);

    expect(parseInfluenceText(null)).toEqual({ improves: "", reduces: "" });
    expect(formatInfluenceText("Азот", { improves: "", reduces: "" })).toBeNull();
  });
});
