import { describe, expect, it } from "vitest";
import {
  buildEditorMaterialUrl,
  readEditorMaterialSearchParams,
} from "./editorNavigation";

describe("editorNavigation", () => {
  it("buildEditorMaterialUrl включает material, edit и hash", () => {
    expect(
      buildEditorMaterialUrl("abc-123", "general", {
        edit: true,
        hash: "larson-miller-constant-c",
      }),
    ).toBe(
      "/editor/general?material=abc-123&edit=1#larson-miller-constant-c",
    );
  });

  it("readEditorMaterialSearchParams читает query", () => {
    const params = new URLSearchParams("material=m1&edit=1");
    expect(readEditorMaterialSearchParams(params)).toEqual({
      materialId: "m1",
      edit: true,
    });
  });
});
