import { describe, expect, it } from "vitest";
import type { SourceItem } from "../types/api";
import {
  getSourceOpenHref,
  isExternalSourceLink,
  validateSourceHyperlink,
} from "./sourceLink";

function source(hyperlink: string, id = "src-1"): SourceItem {
  return {
    id_source: id,
    name_source: "Source",
    description: "",
    hyperlink,
    user_name_change: "",
    data_change: "",
    user_name_found: "",
    data_found: "",
  };
}

describe("isExternalSourceLink", () => {
  it("detects external URL schemes", () => {
    expect(isExternalSourceLink("https://example.com")).toBe(true);
    expect(isExternalSourceLink("file:///C:/docs.pdf")).toBe(true);
    expect(isExternalSourceLink("local/path.pdf")).toBe(false);
  });
});

describe("getSourceOpenHref", () => {
  it("returns external link as-is", () => {
    expect(getSourceOpenHref(source("https://example.com"))).toBe(
      "https://example.com",
    );
  });

  it("returns API open-link for local paths", () => {
    expect(getSourceOpenHref(source("C:\\docs\\gost.pdf", "abc"))).toBe(
      "/api/sources/abc/open-link",
    );
  });

  it("returns null for empty hyperlink", () => {
    expect(getSourceOpenHref(source("  "))).toBeNull();
  });
});

describe("validateSourceHyperlink", () => {
  it("accepts empty and valid http(s) links", () => {
    expect(validateSourceHyperlink("")).toBeNull();
    expect(validateSourceHyperlink("https://example.com/doc")).toBeNull();
  });

  it("rejects bare http(s) without host", () => {
    expect(validateSourceHyperlink("https://")).toBe(
      "Ссылка должна начинаться с http:// или https://",
    );
  });
});
