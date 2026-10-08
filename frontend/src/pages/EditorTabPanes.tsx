import { memo, useRef } from "react";
import { KeepAlivePanes } from "../components/KeepAlivePanes";
import {
  useEditorTabPane,
  type EditorTabPaneContextValue,
} from "../context/EditorTabPaneContext";
import { useKeepAlivePaneActive } from "../context/KeepAlivePaneContext";
import { AddRedactor } from "./AddRedactor";
import { PhysicalPropertiesTab } from "./PhysicalPropertiesTab";
import { MechanicalPropertiesTab } from "./MechaicalPropertiesTab";
import { ChemicalProperties } from "./ChemicalProperties";

/**
 * Неактивные keep-alive вкладки всё равно подписаны на draft-context.
 * Замораживаем value, чтобы memo-обёртки табов не перерисовывались
 * на каждый keystroke соседней вкладки (особенно Recharts).
 */
function useEditorTabPaneFrozenWhenInactive(): EditorTabPaneContextValue {
  const live = useEditorTabPane();
  const active = useKeepAlivePaneActive();
  const frozenRef = useRef(live);
  if (active) {
    frozenRef.current = live;
  }
  return active ? live : frozenRef.current;
}

const AddRedactorMemo = memo(AddRedactor);

function EditorGeneralPane() {
  const { draft, onDraftChange, readOnly } = useEditorTabPaneFrozenWhenInactive();
  return (
    <AddRedactorMemo
      material={draft ?? undefined}
      onDraftChange={onDraftChange}
      readOnly={readOnly}
    />
  );
}

function EditorPhysicalPane() {
  const { draft, onDraftChange, readOnly } = useEditorTabPaneFrozenWhenInactive();
  return (
    <PhysicalPropertiesTab
      material={draft ?? undefined}
      onDraftChange={onDraftChange}
      readOnly={readOnly}
    />
  );
}

function EditorMechanicalPane() {
  const { draft, onDraftChange, readOnly } = useEditorTabPaneFrozenWhenInactive();
  return (
    <MechanicalPropertiesTab
      material={draft ?? undefined}
      onDraftChange={onDraftChange}
      readOnly={readOnly}
    />
  );
}

function EditorChemicalPane() {
  const { draft, onDraftChange, readOnly } = useEditorTabPaneFrozenWhenInactive();
  return (
    <ChemicalProperties
      material={draft ?? undefined}
      onDraftChange={onDraftChange}
      readOnly={readOnly}
    />
  );
}

const EDITOR_KEEP_ALIVE_PANES = [
  { key: "general", node: <EditorGeneralPane /> },
  { key: "physical", node: <EditorPhysicalPane /> },
  { key: "mechanical", node: <EditorMechanicalPane /> },
  { key: "chemical", node: <EditorChemicalPane /> },
];

export const EditorTabPanes = memo(function EditorTabPanes({
  activeKey,
}: {
  activeKey: string;
}) {
  return <KeepAlivePanes activeKey={activeKey} panes={EDITOR_KEEP_ALIVE_PANES} />;
});
