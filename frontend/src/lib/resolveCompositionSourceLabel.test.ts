import { describe, expect, it } from "vitest";
import type { SourceItem } from "../types/api";
import { resolveCompositionSourceLabel } from "./resolveCompositionSourceLabel";

function source(id: string, name: string): SourceItem {
  return {
    id_source: id,
    name_source: name,
    description: "",
    hyperlink: "",
    user_name_change: "",
    data_change: "",
    user_name_found: "",
    data_found: "",
  };
}

describe("resolveCompositionSourceLabel", () => {
  it("resolves name by source_ref_id", () => {
    const label = resolveCompositionSourceLabel(
      { source_ref_id: "ref-1" },
      [source("ref-1", "GOST 380")],
    );
    expect(label).toBe("GOST 380");
  });

  it("falls back to ref id or composition_source", () => {
    expect(
      resolveCompositionSourceLabel({ source_ref_id: "missing" }, []),
    ).toBe("missing");
    expect(
      resolveCompositionSourceLabel({ composition_source: "Manual" }, []),
    ).toBe("Manual");
    expect(resolveCompositionSourceLabel({}, [])).toBe("-");
  });

  it("appends subsource in parentheses", () => {
    const label = resolveCompositionSourceLabel(
      {
        composition_source: "GOST",
        composition_subsource: "вариант 2",
      },
      [],
    );
    expect(label).toBe("GOST (вариант 2)");
  });
});
