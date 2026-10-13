import { describe, expect, it } from "vitest";
import type { SingleCalculationRow } from "../types/api";
import {
  calculationRowKey,
  calculationRowSourceIndex,
} from "./CalculationTable";

function row(temperature: number): SingleCalculationRow {
  return { temperature, values: {} };
}

describe("calculation row identity", () => {
  it("keeps the source index when two rows share a temperature", () => {
    const first = row(100);
    const second = row(100);
    const source = [first, second];
    const sorted = [second, first];

    expect(calculationRowSourceIndex(source, sorted[0])).toBe(1);
    expect(calculationRowSourceIndex(source, sorted[1])).toBe(0);
    expect(calculationRowKey("custom", 1)).toBe("custom-1");
    expect(calculationRowKey("db", 0)).toBe("db-0");
    expect(calculationRowKey("db", 0)).not.toBe(calculationRowKey("db", 1));
  });
});
