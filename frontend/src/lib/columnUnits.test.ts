import { describe, expect, it } from "vitest";
import type { UnitResponse } from "../types/api";
import {
  mergeColumnUnits,
  resolveDefaultColumnUnit,
  unitDisplayText,
} from "./columnUnits";

const tempConfig: UnitResponse = {
  system_unit: "C",
  units: ["C", "K", "F"],
  factors: { C: 1, K: "offset_k", F: "offset_f" },
  display_labels: { C: "°C", K: "K" },
};

describe("resolveDefaultColumnUnit", () => {
  it("returns column unit when no unit_type config", () => {
    expect(resolveDefaultColumnUnit({ key: "x", unit: "МПа" })).toBe("МПа");
  });

  it("prefers column unit when listed in config", () => {
    expect(
      resolveDefaultColumnUnit(
        { key: "t", unit: "K", unit_type: "Температура" },
        tempConfig,
      ),
    ).toBe("K");
  });

  it("falls back to system_unit when column unit invalid", () => {
    expect(
      resolveDefaultColumnUnit(
        { key: "t", unit: "unknown", unit_type: "Температура" },
        tempConfig,
      ),
    ).toBe("C");
  });
});

describe("mergeColumnUnits", () => {
  it("adds defaults for new columns", () => {
    const next = mergeColumnUnits(
      [{ key: "temp", unit: "C", unit_type: "Температура" }],
      {},
      { Температура: tempConfig },
    );
    expect(next).toEqual({ temp: "C" });
  });

  it("keeps prev reference when nothing changed", () => {
    const prev = { temp: "C" };
    const next = mergeColumnUnits(
      [{ key: "temp", unit: "C", unit_type: "Температура" }],
      prev,
      { Температура: tempConfig },
    );
    expect(next).toBe(prev);
  });

  it("resets invalid stored unit to default", () => {
    const next = mergeColumnUnits(
      [{ key: "temp", unit: "C", unit_type: "Температура" }],
      { temp: "invalid" },
      { Температура: tempConfig },
    );
    expect(next.temp).toBe("C");
  });
});

describe("unitDisplayText", () => {
  it("uses display label when provided", () => {
    expect(unitDisplayText("C", tempConfig.display_labels)).toBe("°C");
  });

  it("returns raw unit or empty string", () => {
    expect(unitDisplayText("K")).toBe("K");
    expect(unitDisplayText("")).toBe("");
  });
});
