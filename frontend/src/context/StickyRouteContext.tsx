import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  editorTabPathFromKey,
  selectionTabPathFromKey,
  type EditorTabKey,
  type SelectionTabKey,
} from "../lib/keepAliveRoutes";

type StickyRouteContextValue = {
  rememberSelectionTab: (key: SelectionTabKey) => void;
  rememberEditorTab: (key: EditorTabKey) => void;
  selectionMainPath: string;
  editorMainPath: string;
};

const StickyRouteContext = createContext<StickyRouteContextValue | null>(null);

export function StickyRouteProvider({ children }: { children: ReactNode }) {
  const [selectionTab, setSelectionTab] = useState<SelectionTabKey>("temperature");
  const [editorTab, setEditorTab] = useState<EditorTabKey>("general");

  const rememberSelectionTab = useCallback((key: SelectionTabKey) => {
    setSelectionTab((prev) => (prev === key ? prev : key));
  }, []);

  const rememberEditorTab = useCallback((key: EditorTabKey) => {
    setEditorTab((prev) => (prev === key ? prev : key));
  }, []);

  const value = useMemo(
    () => ({
      rememberSelectionTab,
      rememberEditorTab,
      selectionMainPath: selectionTabPathFromKey(selectionTab),
      editorMainPath: editorTabPathFromKey(editorTab),
    }),
    [editorTab, rememberEditorTab, rememberSelectionTab, selectionTab],
  );

  return (
    <StickyRouteContext.Provider value={value}>{children}</StickyRouteContext.Provider>
  );
}

export function useStickyRoutes(): StickyRouteContextValue {
  const context = useContext(StickyRouteContext);
  if (!context) {
    throw new Error("useStickyRoutes must be used within StickyRouteProvider");
  }
  return context;
}

export function useRememberStickySelectionTab(key: SelectionTabKey | null): void {
  const { rememberSelectionTab } = useStickyRoutes();

  useEffect(() => {
    if (key) {
      rememberSelectionTab(key);
    }
  }, [key, rememberSelectionTab]);
}

export function useRememberStickyEditorTab(key: EditorTabKey | null): void {
  const { rememberEditorTab } = useStickyRoutes();

  useEffect(() => {
    if (key) {
      rememberEditorTab(key);
    }
  }, [key, rememberEditorTab]);
}
