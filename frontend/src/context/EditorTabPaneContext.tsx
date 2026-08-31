import { createContext, useContext, type ReactNode } from "react";

export type EditorTabPaneContextValue = {
  draft: Record<string, unknown> | null;
  onDraftChange: (next: Record<string, unknown>) => void;
  readOnly: boolean;
};

const EditorTabPaneContext = createContext<EditorTabPaneContextValue | null>(
  null,
);

export function EditorTabPaneProvider({
  value,
  children,
}: {
  value: EditorTabPaneContextValue;
  children: ReactNode;
}) {
  return (
    <EditorTabPaneContext.Provider value={value}>
      {children}
    </EditorTabPaneContext.Provider>
  );
}

export function useEditorTabPane(): EditorTabPaneContextValue {
  const ctx = useContext(EditorTabPaneContext);
  if (!ctx) {
    throw new Error("useEditorTabPane используется вне EditorTabPaneProvider");
  }
  return ctx;
}
