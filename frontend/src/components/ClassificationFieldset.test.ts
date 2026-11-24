import { describe, expect, it } from "vitest";
import type { ClassificationResponse } from "../types/api";
import {
  classificationClassOptions,
  isOrphanClassificationValue,
  matchClassificationOption,
  normalizeClassificationSelection,
} from "./ClassificationFieldset";

const catalog: ClassificationResponse = {
  categories: [
    {
      name: "Жаропрочная, низколегированная",
      classes: [{ name: "Перлитный", subclasses: [] }],
    },
    {
      name: "Жаропрочная, высоколегированная",
      classes: [
        { name: "Мартенситный", subclasses: [] },
        { name: "Мартенситно-ферритный", subclasses: [] },
      ],
    },
  ],
};

describe("classification matching ignores commas", () => {
  it("maps a grade category onto the catalog spelling", () => {
    expect(
      matchClassificationOption("Жаропрочная низколегированная", [
        "Жаропрочная, низколегированная",
      ]),
    ).toBe("Жаропрочная, низколегированная");
  });

  it("loads classes for a category that differs only by commas", () => {
    expect(classificationClassOptions(catalog, "Жаропрочная низколегированная")).toEqual([
      "Перлитный",
    ]);
  });

  it("does not treat a comma difference as an unknown value", () => {
    expect(
      isOrphanClassificationValue("Жаропрочная низколегированная", [
        "Жаропрочная, низколегированная",
      ]),
    ).toBe(false);
  });

  it("keeps a real mismatch", () => {
    expect(
      isOrphanClassificationValue("Мартенсито - ферритный", ["Мартенситно-ферритный"]),
    ).toBe(true);
  });

  it("keeps the structural class when the category is chosen from the catalog", () => {
    const next = normalizeClassificationSelection(
      catalog,
      {
        classification_category: "Жаропрочная низколегированная",
        classification_class: "Перлитный",
        classification_subclass: "",
      },
      { classification_category: "Жаропрочная, низколегированная" },
    );
    expect(next.classification_class).toBe("Перлитный");
  });
});
