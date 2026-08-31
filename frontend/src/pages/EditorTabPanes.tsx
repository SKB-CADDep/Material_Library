import { memo } from "react";
import { KeepAlivePanes } from "../components/KeepAlivePanes";
import { useEditorTabPane } from "../context/EditorTabPaneContext";
import { AddRedactor } from "./AddRedactor";
import { PhysicalPropertiesTab } from "./PhysicalPropertiesTab";
import { MechanicalPropertiesTab } from "./MechaicalPropertiesTab";
import { ChemicalProperties } from "./ChemicalProperties";

function EditorGeneralPane() {
  const { draft, onDraftChange, readOnly } = useEditorTabPane();
  return (
    <AddRedactor
      material={draft ?? undefined}
      onDraftChange={onDraftChange}
      readOnly={readOnly}
    />
  );
}

function EditorPhysicalPane() {
  const { draft, onDraftChange, readOnly } = useEditorTabPane();
  return (
    <PhysicalPropertiesTab
      material={draft ?? undefined}
      onDraftChange={onDraftChange}
      readOnly={readOnly}
    />
  );
}

function EditorMechanicalPane() {
  const { draft, onDraftChange, readOnly } = useEditorTabPane();
  return (
    <MechanicalPropertiesTab
      material={draft ?? undefined}
      onDraftChange={onDraftChange}
      readOnly={readOnly}
    />
  );
}

function EditorChemicalPane() {
  const { draft, onDraftChange, readOnly } = useEditorTabPane();
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
