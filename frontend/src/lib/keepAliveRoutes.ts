export type MainPageKey = "selection" | "editor" | "sources";

export type SelectionTabKey =
  | "temperature"
  | "calc"
  | "compare-props"
  | "compare-chem"
  | "ashby"
  | "larson-miller";

export type EditorTabKey = "general" | "physical" | "mechanical" | "chemical";

export function mainPageKeyFromPath(pathname: string): MainPageKey {
  if (pathname.startsWith("/editor")) {
    return "editor";
  }
  if (pathname.startsWith("/sources")) {
    return "sources";
  }
  return "selection";
}

export function selectionTabKeyFromPath(pathname: string): SelectionTabKey | null {
  if (!pathname.startsWith("/selection")) {
    return null;
  }
  if (pathname.includes("/selection/calc")) {
    return "calc";
  }
  if (pathname.includes("/selection/compare-props")) {
    return "compare-props";
  }
  if (pathname.includes("/selection/compare-chem")) {
    return "compare-chem";
  }
  if (pathname.includes("/selection/ashby")) {
    return "ashby";
  }
  if (pathname.includes("/selection/larson-miller")) {
    return "larson-miller";
  }
  return "temperature";
}

export function editorTabKeyFromPath(pathname: string): EditorTabKey | null {
  if (!pathname.startsWith("/editor")) {
    return null;
  }
  if (pathname.includes("/editor/physical")) {
    return "physical";
  }
  if (pathname.includes("/editor/mechanical")) {
    return "mechanical";
  }
  if (pathname.includes("/editor/chemical")) {
    return "chemical";
  }
  return "general";
}

export function isSelectionIndexPath(pathname: string): boolean {
  return pathname === "/selection" || pathname === "/selection/";
}

export function isEditorIndexPath(pathname: string): boolean {
  return pathname === "/editor" || pathname === "/editor/";
}
