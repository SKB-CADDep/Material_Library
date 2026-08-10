import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listMaterials,
  getMaterial,
  saveMaterial,
  saveNewMaterial,
  materialDraftFilename,
  normalizeMaterialFilename,
  validateMaterialDraftForSave,
} from "../api/materials";
import { useEffect } from "react";
import { AddRedactor } from "./AddRedactor";
import { PhysicalPropertiesTab } from "./PhysicalPropertiesTab";
import { MechanicalPropertiesTab } from "./MechaicalPropertiesTab";
import { ChemicalProperties } from "./ChemicalProperties";
import { showToastWithOK } from "../lib/toast";
import { useEditor } from "../context/EditorContext";

function editorSubtabClass({ isActive }: { isActive: boolean }) {
  return isActive ? "editor-subtab active" : "editor-subtab";
}

function createEmptyMaterialDraft(): Record<string, unknown> {
  return {
    material_id: crypto.randomUUID(),
    metadata: {
      name_material_standard: "",
      name_material_alternative: [],
      application_area: [],
      comment: "",
      classification: {
        classification_category: "",
        classification_class: "",
        classification_subclass: "",
      },
    },
    physical_properties: {
      properties: [],
    },
    mechanical_properties: {
      strength_category: [
        {
          value_strength_category: "Новая КП 1",
          source_strength_category: "",
          source_ref_id: "",
          hardness: [],
          hardness_unit: "",
          properties: [],
        },
      ],
    },
    chemical_properties: {
      composition: [
        {
          composition_source: "",
          other_elements: [],
          comment: "",
          base_element: "Fe",
        },
      ],
    },
  };
}

function promptFilename(draft: Record<string, unknown>): string | null {
  let defaultName: string;
  try {
    defaultName = materialDraftFilename(draft);
  } catch {
    defaultName = "Новыйматериал.json";
  }
  const input = window.prompt("Имя файла для сохранения", defaultName);
  if (input === null) {
    return null;
  }
  try {
    return normalizeMaterialFilename(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неверное имя файла";
    showToastWithOK(message, 'error');
    return null;
  }
}

function draftCopyAsNewFile(draft: Record<string, unknown>): Record<string, unknown> {
  const copy = structuredClone(draft);
  copy.material_id = crypto.randomUUID();
  return copy;
}

export function EditorPage() {
  const result = useQuery({
    queryKey: ["materials"],
    queryFn: listMaterials,
  });
  const { draft, setDraft, selectedId, setSelectedId, isNewMaterial, setIsNewMaterial } = useEditor()
  const detail = useQuery({
    queryKey: ["material", selectedId],
    queryFn: () => getMaterial(selectedId!),
    enabled: selectedId !== null,
  });
  
  useEffect(() => {
    if (isNewMaterial) {
      return;
    }
    if (!selectedId) {
      setDraft(null);
      return;
    }
    if (detail.data) {
      setDraft(draft => {
        if (draft?.material_id === detail.data.material_id) return draft;
        return structuredClone(detail.data);
      });
      
    }
  }, [selectedId, detail.data, isNewMaterial]);

  const hasFileOnDisk = selectedId !== null && !isNewMaterial;
  const queryClient = useQueryClient();

  const newSave = useMutation({
    mutationFn: ({ body, filename }: { body: Record<string, unknown>; filename: string }) =>
      saveNewMaterial(body, filename),
    onSuccess: (_data, variables) => {
      const id = variables.body.material_id as string;
      queryClient.setQueryData(["material", id], variables.body);
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["selection"] });
      setIsNewMaterial(false);
      setSelectedId(id);
      setDraft(structuredClone(variables.body));

      showToastWithOK(`Материал "${variables.filename}" успешно сохранён`, 'success');
    },
    onError: (error: Error) => {
      showToastWithOK(`Ошибка сохранения: ${error.message}`, 'error');
    },
  });

  const save = useMutation({
    mutationFn: () => saveMaterial(selectedId!, draft!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["material", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["selection"] });

      showToastWithOK(`Материал "${data.filename}" успешно сохранён`, 'success');
    },
    onError: (error: Error) => {
      showToastWithOK(`Ошибка сохранения: ${error.message}`, 'error');
    },
  });

  const saveBusy = save.isPending || newSave.isPending;

  function handleDraftChange(next: Record<string, unknown>) {
    setDraft(next);
    save.reset();
    newSave.reset();
  }

  if (result.isLoading) {
    return <p className="status-message">Загрузка…</p>;
  }
  if (result.isError) {
    return <p className="status-message error">Ошибка загрузки списка материалов</p>;
  }

  const materials = result.data ?? [];

  function handleCreateNew() {
    setSelectedId(null);
    setIsNewMaterial(true);
    setDraft(createEmptyMaterialDraft());
  }

  function runSaveFlow() {
    if (!draft) return;
    const error = validateMaterialDraftForSave(draft);
    if (error) {
      showToastWithOK(error, 'warning');
      return;
    }
    if (hasFileOnDisk) {
      save.mutate();
      return;
    }
    const filename = promptFilename(draft);
    if (!filename) return;
    newSave.mutate({ body: draft, filename });
  }

  function runSaveAsFlow() {
    if (!draft) return;
    const error = validateMaterialDraftForSave(draft);
    if (error) {
      showToastWithOK(error, 'warning');
      return;
    }
    const filename = promptFilename(draft);
    if (!filename) return;
    const body = hasFileOnDisk ? draftCopyAsNewFile(draft) : draft;
    newSave.mutate({ body, filename });
  }

  async function handleRevertChanges() {
    if (!draft) return;

    if (isNewMaterial) {
      if (
        !window.confirm("Сбросить создание нового материала?")
      ) {
        return;
      }
      handleCreateNew();
      return;
    }

    if (!selectedId) return;

    if (
      !window.confirm("Отменить все несохранённые изменения?")
    ) {
      return;
    }

    await queryClient.refetchQueries({ queryKey: ["material", selectedId] });
    const fresh = queryClient.getQueryData<Record<string, unknown>>([
      "material",
      selectedId,
    ]);
    if (fresh) {
      setDraft(structuredClone(fresh));
    }
  }

  return (
    <div className="editor-page">
      <div className="editor-toolbar">
        <div className="material-select">
          <label htmlFor="material-select">Выберите материал:</label>
          <select
            id="material-select"
            className="input"
            value={selectedId ?? ""}
            onChange={(event) => {
              setIsNewMaterial(false);
              setSelectedId(event.target.value || null);
            }}
          >
            <option value="">— не выбран —</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name}
              </option>
            ))}
          </select>
        </div>
        <div className="button-group">
          <button
            type="button"
            className="button-secondary"
            onClick={handleCreateNew}
          >
            Создать новый
          </button>
          <button
            type="button"
            disabled={!draft || saveBusy}
            onClick={runSaveFlow}
          >
            {save.isPending ? "Сохранение…" : "Сохранить"}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={!draft || saveBusy}
            onClick={runSaveAsFlow}
          >
            {newSave.isPending ? "Сохранение…" : "Сохранить как…"}
          </button>
          <button type="button" className="button-secondary" disabled={!draft||saveBusy} onClick={handleRevertChanges}>
            Отменить изменения
          </button>
        </div>
      </div>

      <div className="editor-body">
        <nav className="editor-subtabs">
          <NavLink to="/editor/general" className={editorSubtabClass}>
            Общие данные
          </NavLink>
          <NavLink to="/editor/physical" className={editorSubtabClass}>
            Физические свойства
          </NavLink>
          <NavLink to="/editor/mechanical" className={editorSubtabClass}>
            Механические свойства
          </NavLink>
          <NavLink to="/editor/chemical" className={editorSubtabClass}>
            Химический состав
          </NavLink>
        </nav>

        <div className="editor-tab-panel">
          <Routes>
            <Route index element={<Navigate to="general" replace />} />
            <Route
              path="general"
              element={
                <AddRedactor material={draft ?? undefined} onDraftChange={handleDraftChange} />
              }
            />
            <Route
              path="physical"
              element={<PhysicalPropertiesTab material={draft ?? undefined} onDraftChange={setDraft} />}
            />
            <Route
              path="mechanical"
              element={<MechanicalPropertiesTab material={draft ?? undefined} onDraftChange={setDraft} />}
            />
            <Route
              path="chemical"
              element={<ChemicalProperties material={draft ?? undefined} onDraftChange={setDraft} />}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}