import { describe, expect, it } from "vitest";
import { materialMatchesApplicationAreas } from "./applicationAreaFilter";

describe("materialMatchesApplicationAreas", () => {
  it("matches any material when no areas selected", () => {
    expect(materialMatchesApplicationAreas(["A"], [])).toBe(true);
    expect(materialMatchesApplicationAreas(undefined, [])).toBe(true);
  });

  it("matches when at least one area intersects", () => {
    expect(
      materialMatchesApplicationAreas(
        ["Конструкционные материалы", "Сварные конструкции"],
        ["Сварные конструкции"],
      ),
    ).toBe(true);
  });

  it("rejects when no intersection", () => {
    expect(
      materialMatchesApplicationAreas(["A"], ["B"]),
    ).toBe(false);
    expect(materialMatchesApplicationAreas(undefined, ["A"])).toBe(false);
  });
});
