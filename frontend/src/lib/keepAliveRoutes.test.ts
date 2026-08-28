import { describe, expect, it } from "vitest";
import {
  editorTabKeyFromPath,
  isEditorIndexPath,
  isSelectionIndexPath,
  mainPageKeyFromPath,
  selectionTabKeyFromPath,
} from "./keepAliveRoutes";

describe("keepAliveRoutes", () => {
  it("maps main pages from pathname", () => {
    expect(mainPageKeyFromPath("/selection/temperature")).toBe("selection");
    expect(mainPageKeyFromPath("/editor/general")).toBe("editor");
    expect(mainPageKeyFromPath("/sources")).toBe("sources");
  });

  it("maps selection subtabs and ignores editor paths", () => {
    expect(selectionTabKeyFromPath("/selection/temperature")).toBe("temperature");
    expect(selectionTabKeyFromPath("/selection/calc")).toBe("calc");
    expect(selectionTabKeyFromPath("/selection/compare-chem")).toBe(
      "compare-chem",
    );
    expect(selectionTabKeyFromPath("/selection")).toBe("temperature");
    expect(selectionTabKeyFromPath("/editor/general")).toBeNull();
  });

  it("maps editor subtabs and ignores selection paths", () => {
    expect(editorTabKeyFromPath("/editor")).toBe("general");
    expect(editorTabKeyFromPath("/editor/physical")).toBe("physical");
    expect(editorTabKeyFromPath("/selection/calc")).toBeNull();
  });

  it("detects index redirects", () => {
    expect(isSelectionIndexPath("/selection")).toBe(true);
    expect(isSelectionIndexPath("/selection/temperature")).toBe(false);
    expect(isEditorIndexPath("/editor/")).toBe(true);
    expect(isEditorIndexPath("/editor/chemical")).toBe(false);
  });
});
