import { describe, expect, it } from "vitest";
import {
  buildChemCompositionCache,
  collectTargets,
  evaluateAllCandidates,
  evaluateCandidate,
  type ChemCompositionCacheEntry,
} from "./chemTargetSelection";
import type { ChemCompositionEntryApi } from "./chemTargetSelection";
import type { SourceItem } from "../types/api";

const chemicalSources: SourceItem[] = [];

function cacheEntry(
  overrides: Partial<ChemCompositionCacheEntry> & {
    materialId: string;
    materialName: string;
  },
): ChemCompositionCacheEntry {
  const {
    materialId,
    materialName,
    areas = ["Конструкционные материалы"],
    composition = {
      tolerance_type: "absolute",
      base_element: "Fe",
      other_elements: [
        {
          element: "C",
          unit_value: "%",
          min_value: 0.17,
          max_value: 0.24,
          min_value_tolerance: 0.15,
          max_value_tolerance: 0.26,
        },
        {
          element: "Mn",
          unit_value: "%",
          min_value: 0.35,
          max_value: 0.65,
        },
      ],
    },
    ...rest
  } = overrides;

  const elements = composition.other_elements ?? [];
  const elementsMap = new Map(
    elements
      .filter((e) => e.element)
      .map((e) => [String(e.element).trim(), e]),
  );

  return {
    materialId,
    materialName,
    areas,
    composition,
    sourceLabel: "-",
    baseElement: "Fe",
    unit: "%",
    elementsMap,
    ...rest,
  };
}

describe("collectTargets", () => {
  it("skips blank rows and invalid numbers", () => {
    const targets = collectTargets([
      { element: "C", target: "0.20" },
      { element: "-", target: "0.1" },
      { element: "Mn", target: "" },
      { element: "Si", target: "n/a" },
    ]);
    expect(targets).toEqual({ C: 0.2 });
  });
});

describe("evaluateCandidate", () => {
  it("reports full match when all targets inside effective bounds", () => {
    const cand = cacheEntry({
      materialId: "m1",
      materialName: "Steel A",
    });
    const result = evaluateCandidate(cand, { C: 0.2, Mn: 0.5 });

    expect(result.status).toBe("Полное совпадение");
    expect(result.matched).toBe(2);
    expect(result.missing).toBe(0);
    expect(result.details.C?.state).toBe("in");
    expect(result.details.Mn?.state).toBe("in");
  });

  it("reports partial match when some elements are out of range", () => {
    const cand = cacheEntry({
      materialId: "m2",
      materialName: "Steel B",
    });
    const result = evaluateCandidate(cand, { C: 0.2, Mn: 0.9 });

    expect(result.status).toBe("Частичное совпадение");
    expect(result.matched).toBe(1);
    expect(result.details.Mn?.state).toBe("above");
    expect(result.details.Mn?.delta).toBeCloseTo(0.25);
  });

  it("marks missing element when symbol absent in composition", () => {
    const cand = cacheEntry({
      materialId: "m3",
      materialName: "Steel C",
    });
    const result = evaluateCandidate(cand, { Si: 0.01 });

    expect(result.status).toBe("Нет совпадений");
    expect(result.missing).toBe(1);
    expect(result.details.Si?.state).toBe("missing");
  });

  it("applies relative tolerance from composition block", () => {
    const cand = cacheEntry({
      materialId: "m4",
      materialName: "Steel D",
      composition: {
        tolerance_type: "relative",
        base_element: "Fe",
        other_elements: [
          {
            element: "C",
            unit_value: "%",
            min_value: 0.20,
            max_value: 0.30,
            min_value_tolerance_relative: 10,
            max_value_tolerance_relative: 10,
          },
        ],
      },
    });

    expect(evaluateCandidate(cand, { C: 0.19 }).details.C?.state).toBe("in");
    expect(evaluateCandidate(cand, { C: 0.17 }).details.C?.state).toBe("below");
    expect(evaluateCandidate(cand, { C: 0.34 }).details.C?.state).toBe("above");
  });
});

describe("buildChemCompositionCache", () => {
  it("maps API entries to cache rows with elementsMap", () => {
    const apiEntries: ChemCompositionEntryApi[] = [
      {
        material_id: "id-1",
        material_name: "Test",
        areas: ["A"],
        composition: {
          base_element: "Fe",
          other_elements: [
            { element: "C", unit_value: "%", min_value: 0.1, max_value: 0.2 },
          ],
        },
      },
    ];

    const cache = buildChemCompositionCache(apiEntries, chemicalSources);
    expect(cache).toHaveLength(1);
    expect(cache[0]?.elementsMap.get("C")?.min_value).toBe(0.1);
    expect(cache[0]?.unit).toBe("%");
  });
});

describe("evaluateAllCandidates", () => {
  it("filters by application area and sorts full matches first", () => {
    const cache: ChemCompositionCacheEntry[] = [
      cacheEntry({
        materialId: "partial",
        materialName: "Partial",
        areas: ["Конструкционные материалы"],
      }),
      cacheEntry({
        materialId: "full",
        materialName: "Full",
        areas: ["Конструкционные материалы"],
        composition: {
          tolerance_type: "absolute",
          other_elements: [
            {
              element: "C",
              min_value: 0.18,
              max_value: 0.22,
            },
          ],
        },
      }),
      cacheEntry({
        materialId: "other-area",
        materialName: "Other",
        areas: ["Другая область"],
      }),
    ];

    const results = evaluateAllCandidates(
      cache,
      { C: 0.2 },
      ["Конструкционные материалы"],
    );

    expect(results.map((r) => r.materialId)).toEqual(["full", "partial"]);
    expect(results[0]?.status).toBe("Полное совпадение");
  });

  it("returns empty list when no targets", () => {
    const cache = [
      cacheEntry({ materialId: "m1", materialName: "A" }),
    ];
    expect(evaluateAllCandidates(cache, {}, [])).toEqual([]);
  });
});
