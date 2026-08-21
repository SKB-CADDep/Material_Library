import { describe, expect, it } from "vitest";
import {
  ELEMENTS_MAP,
  elementDisplayName,
  parseElementInfluence,
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
});
