import { createContext, useContext, type ReactNode } from "react";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type EditorContextValue = {
    draft: Record<string, unknown> | null;
    setDraft: Dispatch<SetStateAction<Record<string, unknown> | null>>;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    isNewMaterial: boolean;
    setIsNewMaterial: (next: boolean) => void;
    isEditing: boolean;
    setIsEditing: (next: boolean) => void;
    resetEditor:() => void;
}
const EditorContext = createContext<EditorContextValue | null>(null);
export function EditorProvider({ children }: { children: ReactNode }) {
    const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isNewMaterial, setIsNewMaterial] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    function resetEditor() {
        setDraft(null);
        setSelectedId(null);
        setIsNewMaterial(false);
        setIsEditing(false);
      }
    const value: EditorContextValue = {
        draft,
        setDraft,
        selectedId,
        setSelectedId,
        isNewMaterial,
        setIsNewMaterial,
        isEditing,
        setIsEditing,
        resetEditor
    }
  
    return (
      <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
    );
  }
  
  export function useEditor() {
    const ctx = useContext(EditorContext);
    if (!ctx) throw new Error("useEditor вне EditorProvider");
    return ctx;
  }