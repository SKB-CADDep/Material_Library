import type { EditorTabKey } from "./keepAliveRoutes";

export function buildEditorMaterialUrl(
  materialId: string,
  tab: EditorTabKey = "general",
  options?: { edit?: boolean; hash?: string },
): string {
  const params = new URLSearchParams({ material: materialId });
  if (options?.edit) {
    params.set("edit", "1");
  }
  const hash = options?.hash?.replace(/^#/, "") ?? "";
  return `/editor/${tab}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

export function readEditorMaterialSearchParams(searchParams: URLSearchParams): {
  materialId: string | null;
  edit: boolean;
} {
  const materialId = searchParams.get("material")?.trim() || null;
  return {
    materialId,
    edit: searchParams.get("edit") === "1",
  };
}
