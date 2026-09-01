import { describe, expect, it } from "vitest";
import {
  larsonMillerChartEmptyMessage,
  resolveLarsonMillerChartEmptyReason,
} from "./larsonMillerStatus";

describe("resolveLarsonMillerChartEmptyReason", () => {
  it("возвращает null, если кривая построена", () => {
    expect(
      resolveLarsonMillerChartEmptyReason(
        {
          table_points: [{}],
          chart_curve: [{ p: 15, stress: 200 }],
        },
        true,
      ),
    ).toBeNull();
  });

  it("различает отсутствие C, таблицы и обоих", () => {
    const empty = { table_points: [], chart_curve: [] };
    expect(resolveLarsonMillerChartEmptyReason(empty, false)).toBe(
      "missing-both",
    );
    expect(
      resolveLarsonMillerChartEmptyReason(
        { table_points: [{}], chart_curve: [] },
        false,
      ),
    ).toBe("missing-c");
    expect(resolveLarsonMillerChartEmptyReason(empty, true)).toBe(
      "missing-table",
    );
  });
});

describe("larsonMillerChartEmptyMessage", () => {
  it("возвращает текст для каждой причины", () => {
    expect(larsonMillerChartEmptyMessage("missing-c")).toContain("константа C");
    expect(larsonMillerChartEmptyMessage("missing-table")).toContain(
      "табличных данных",
    );
  });
});
