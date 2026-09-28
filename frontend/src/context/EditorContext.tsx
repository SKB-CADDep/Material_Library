import { createContext, useContext, type ReactNode } from "react";
import { useState, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

export const UNSAVED_EDITOR_LEAVE_MESSAGE =
  "Есть несохранённые изменения. Продолжить без сохранения?";

type EditorContextValue = {
  draft: Record<string, unknown> | null;
  setDraft: Dispatch<SetStateAction<Record<string, unknown> | null>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  isNewMaterial: boolean;
  setIsNewMaterial: (next: boolean) => void;
  isEditing: boolean;
  setIsEditing: (next: boolean) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (next: boolean) => void;
  /** false — пользователь отменил уход */
  confirmDiscardUnsavedChanges: () => boolean;
  resetEditor: () => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewMaterial, setIsNewMaterial] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const confirmDiscardUnsavedChanges = useCallback(() => {
    if (!hasUnsavedChanges) {
      return true;
    }
    return window.confirm(UNSAVED_EDITOR_LEAVE_MESSAGE);
  }, [hasUnsavedChanges]);

  function resetEditor() {
    setDraft(null);
    setSelectedId(null);
    setIsNewMaterial(false);
    setIsEditing(false);
    setHasUnsavedChanges(false);
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
    hasUnsavedChanges,
    setHasUnsavedChanges,
    confirmDiscardUnsavedChanges,
    resetEditor,
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor вне EditorProvider");
  return ctx;
}
