import { describe, expect, it } from "vitest";
import {
  applyChemToleranceSync,
  chemToleranceNegativeWarning,
  chemToleranceSyncSource,
  clampNegativeChemTolerances,
  fillMissingChemTolerances,
  isChemInputReadyToSync,
  sanitizeChemTolerancePatch,
  syncAbsFromRel,
  syncRelFromAbs,
} from "./chemToleranceSync";

const sulfurBase = {
  min_value: 5,
  max_value: 10,
  min_value_tolerance: "0.0",
  max_value_tolerance: "0.0",
  min_value_tolerance_relative: "0.0",
  max_value_tolerance_relative: "0.0",
};

describe("syncAbsFromRel", () => {
  it("builds ABS from REL for S 5–10 ±0.25", () => {
    const next = syncAbsFromRel({
      ...sulfurBase,
      min_value_tolerance_relative: "0.25",
      max_value_tolerance_relative: "0.25",
    });
    expect(next.min_value_tolerance).toBe("4.75");
    expect(next.max_value_tolerance).toBe("10.25");
  });
});

describe("syncRelFromAbs", () => {
  it("builds REL from ABS for S 5–10 with ABS 4.75–10.25", () => {
    const next = syncRelFromAbs({
      ...sulfurBase,
      min_value_tolerance: "4.75",
      max_value_tolerance: "10.25",
    });
    expect(next.min_value_tolerance_relative).toBe("0.25");
    expect(next.max_value_tolerance_relative).toBe("0.25");
  });
});

describe("applyChemToleranceSync", () => {
  it("on bounds change keeps REL and updates ABS", () => {
    const next = applyChemToleranceSync(
      {
        ...sulfurBase,
        min_value: 6,
        min_value_tolerance_relative: "0.25",
        max_value_tolerance_relative: "0.25",
      },
      "bounds",
    );
    expect(next.min_value_tolerance).toBe("5.75");
    expect(next.max_value_tolerance).toBe("10.25");
  });

  it("on bounds change with only ABS (legacy rows) updates REL", () => {
    const next = applyChemToleranceSync(
      {
        ...sulfurBase,
        min_value: 6,
        max_value: 10,
        min_value_tolerance: "4.75",
        max_value_tolerance: "10.25",
      },
      "bounds",
    );
    expect(next.min_value_tolerance_relative).toBe("1.25");
    expect(next.max_value_tolerance_relative).toBe("0.25");
  });

  it("keeps ABS/REL at 0.0 when the paired side is 0", () => {
    expect(
      syncAbsFromRel({
        ...sulfurBase,
        min_value: 5,
        max_value: 10,
      }).min_value_tolerance,
    ).toBe("0.0");
    expect(
      syncRelFromAbs({
        ...sulfurBase,
        min_value: 5,
        max_value: 10,
        min_value_tolerance: "0.0",
        max_value_tolerance: "0.0",
      }).min_value_tolerance_relative,
    ).toBe("0.0");
  });

  it("does not produce negative ABS/REL when min is 0", () => {
    const fromRel = syncAbsFromRel({
      ...sulfurBase,
      min_value: 0,
      max_value: 0.03,
      min_value_tolerance_relative: "0.25",
      max_value_tolerance_relative: "0.01",
    });
    expect(Number(fromRel.min_value_tolerance)).toBeGreaterThanOrEqual(0);
    expect(Number(fromRel.min_value_tolerance_relative)).toBe(0);
    expect(Number(fromRel.max_value_tolerance)).toBeGreaterThanOrEqual(0);
    expect(Number(fromRel.max_value_tolerance_relative)).toBeGreaterThanOrEqual(
      0,
    );

    const fromAbs = syncRelFromAbs({
      ...sulfurBase,
      min_value: 0,
      max_value: 0.03,
      min_value_tolerance: "0.05",
      max_value_tolerance: "0.01",
    });
    expect(Number(fromAbs.min_value_tolerance)).toBe(0);
    expect(Number(fromAbs.min_value_tolerance_relative)).toBeGreaterThanOrEqual(
      0,
    );
    expect(Number(fromAbs.max_value_tolerance)).toBeGreaterThanOrEqual(0);
    expect(
      Number(fromAbs.max_value_tolerance_relative),
    ).toBeGreaterThanOrEqual(0);
  });

  it("does not produce negative REL when max is 0 and ABS below max", () => {
    const next = syncRelFromAbs({
      ...sulfurBase,
      min_value: 0,
      max_value: 0,
      min_value_tolerance: "0.0",
      max_value_tolerance: "-0.1",
    });
    expect(Number(next.max_value_tolerance)).toBeGreaterThanOrEqual(0);
    expect(Number(next.max_value_tolerance_relative)).toBeGreaterThanOrEqual(0);
  });

  it("clampNegativeChemTolerances clears ready negatives", () => {
    const clamped = clampNegativeChemTolerances({
      ...sulfurBase,
      min_value_tolerance_relative: "-10",
      max_value_tolerance: "-0.5",
    });
    expect(clamped.min_value_tolerance_relative).toBe("0.0");
    expect(clamped.max_value_tolerance).toBe("0.0");
    expect(
      sanitizeChemTolerancePatch({ min_value_tolerance_relative: "-10" })
        .min_value_tolerance_relative,
    ).toBe("0.0");
  });

  it("detects patch source", () => {
    expect(chemToleranceSyncSource({ min_value_tolerance: "4.75" })).toBe("abs");
    expect(
      chemToleranceSyncSource({ min_value_tolerance_relative: "0.25" }),
    ).toBe("rel");
    expect(chemToleranceSyncSource({ min_value: 5 })).toBe("bounds");
  });
});

describe("fillMissingChemTolerances", () => {
  it("fills REL from ABS for legacy rows", () => {
    const next = fillMissingChemTolerances({
      ...sulfurBase,
      min_value_tolerance: "4.75",
      max_value_tolerance: "10.25",
    });
    expect(next.min_value_tolerance_relative).toBe("0.25");
    expect(next.max_value_tolerance_relative).toBe("0.25");
  });
});

describe("isChemInputReadyToSync", () => {
  it("does not sync empty or incomplete decimals while typing", () => {
    expect(isChemInputReadyToSync("")).toBe(false);
    expect(isChemInputReadyToSync("0.")).toBe(false);
    expect(isChemInputReadyToSync(".")).toBe(false);
  });

  it("syncs complete numbers", () => {
    expect(isChemInputReadyToSync("0")).toBe(true);
    expect(isChemInputReadyToSync("0.08")).toBe(true);
  });
});

describe("chemToleranceNegativeWarning", () => {
  it("warns when ABS Min is above Min", () => {
    const msg = chemToleranceNegativeWarning(
      {
        ...sulfurBase,
        min_value: "5",
        min_value_tolerance: "10",
      },
      "abs",
    );
    expect(msg).toMatch(/отрицательным/i);
  });

  it("warns when REL Min would make ABS negative", () => {
    const msg = chemToleranceNegativeWarning(
      {
        ...sulfurBase,
        min_value: "0",
        min_value_tolerance_relative: "0.1",
      },
      "rel",
    );
    expect(msg).toMatch(/отрицательным/i);
  });

  it("warns on direct negative tolerance", () => {
    const msg = chemToleranceNegativeWarning(
      {
        ...sulfurBase,
        min_value_tolerance: "-1",
      },
      "abs",
    );
    expect(msg).toMatch(/отрицательным/i);
  });

  it("returns null for valid pair", () => {
    expect(
      chemToleranceNegativeWarning(
        {
          ...sulfurBase,
          min_value: "5",
          max_value: "10",
          min_value_tolerance: "4.75",
          max_value_tolerance: "10.25",
          min_value_tolerance_relative: "0.25",
          max_value_tolerance_relative: "0.25",
        },
        "abs",
      ),
    ).toBeNull();
  });
});
