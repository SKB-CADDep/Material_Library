import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listMaterials,
  getMaterial,
  saveNewMaterial,
  materialDraftFilename,
  normalizeMaterialFilename,
  nextVersionedMaterialFilename,
  validateMaterialDraftForSave,
} from "../api/materials";
import { syncMaterialsAfterSave, normalizeMaterialDraft } from "../lib/materialDraft";
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

function promptFilename(draft: Record<string, unknown>, defaultName?: string): string | null {
  let suggested = defaultName;
  if (!suggested) {
    try {
      suggested = materialDraftFilename(draft);
    } catch {
      suggested = "Новыйматериал.json";
    }
  }
  const input = window.prompt("Имя файла для сохранения", suggested);
  if (input === null) {
    return null;
  }
  const effective = input.trim() === "" ? suggested : input;
  try {
    return normalizeMaterialFilename(effective);
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
  const {
    draft,
    setDraft,
    selectedId,
    setSelectedId,
    isNewMaterial,
    setIsNewMaterial,
    isEditing,
    setIsEditing,
  } = useEditor();
  const detail = useQuery({
    queryKey: ["material", selectedId],
    queryFn: () => getMaterial(selectedId!),
    enabled: selectedId !== null && !isNewMaterial,
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
  const canEdit = isNewMaterial || isEditing;
  const readOnly = hasFileOnDisk && !canEdit;
  const materialLoading = selectedId !== null && !isNewMaterial && detail.isLoading;
  const materialLoadError = selectedId !== null && !isNewMaterial && detail.isError;
  const showEmptyPanel = !draft && !materialLoading && !materialLoadError
  const queryClient = useQueryClient();

  const newSave = useMutation({
    mutationFn: ({ body, filename }: { body: Record<string, unknown>; filename: string }) =>
      saveNewMaterial(normalizeMaterialDraft(body), filename),
    onSuccess: async (data, variables) => {
      const normalized = normalizeMaterialDraft(variables.body);
      const id = normalized.material_id as string;
      await syncMaterialsAfterSave(queryClient, normalized, data.filename);
      setIsNewMaterial(false);
      setIsEditing(false);
      setSelectedId(id);
      setDraft(normalized);

      showToastWithOK(`Материал "${data.filename}" успешно сохранён`, 'success');
    },
    onError: (error: Error) => {
      showToastWithOK(`Ошибка сохранения: ${error.message}`, 'error');
    },
  });

  const saveBusy = newSave.isPending;

  function handleDraftChange(next: Record<string, unknown>) {
    if (readOnly) {
      return;
    }
    setDraft(next);
    newSave.reset();
  }

  if (result.isLoading) {
    return (
      <div className="editor-page editor-page--centered">
        <h1 className="editor-page__header">Добавление / редактирование</h1>
        <div className="loading-container">
          <p className="tab-placeholder">Загрузка списка материалов…</p>
        </div>
      </div>
    );
  }
  if (result.isError) {
    const errorMessage = result.error instanceof Error ? result.error.message : "Неизвестная ошибка";
    return (
      <div className="editor-page editor-page--centered">
        <h1 className="editor-page__header">Добавление / редактирование</h1>
        <div className="error-container">
          <div className="error-card">
            <h2>Ошибка загрузки списка материалов</h2>
            <p className="error-message">{errorMessage}</p>
            <button type="button" className="retry-button" onClick={() => void result.refetch()}>
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }


  const materials = result.data ?? [];

  function handleCreateNew() {
    setSelectedId(null);
    setIsNewMaterial(true);
    setIsEditing(true);
    setDraft(createEmptyMaterialDraft());
  }

  function handleStartEditing() {
    setIsEditing(true);
  }

  function pickSaveFilename(): string | null {
    if (!draft) return null;
    const existingFilenames = materials.map((material) => material.filename);
    const originalFilename = hasFileOnDisk
      ? materials.find((material) => material.id === selectedId)?.filename
      : undefined;
    const suggested =
      hasFileOnDisk && originalFilename
        ? nextVersionedMaterialFilename(originalFilename, existingFilenames)
        : undefined;
    return promptFilename(draft, suggested);
  }

  function runSaveFlow() {
    if (!draft) return;
    const error = validateMaterialDraftForSave(draft);
    if (error) {
      showToastWithOK(error, 'warning');
      return;
    }
    const filename = pickSaveFilename();
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
    setIsEditing(false);
  }

  const detailErrorMessage = detail.error instanceof Error ? detail.error.message: "Неизвестная ошибка";

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
              setIsEditing(false);
              const nextId = event.target.value || null;
              setSelectedId(nextId);
              if (!nextId) {
                setDraft(null);
              }
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
        {readOnly && (
          <span className="editor-mode-badge" aria-live="polite">
            Только просмотр
          </span>
        )}
        <div className="button-group">
          {hasFileOnDisk && !isEditing && (
            <button type="button" onClick={handleStartEditing}>
              Редактировать
            </button>
          )}
          <button
            type="button"
            className="button-secondary"
            onClick={handleCreateNew}
          >
            Создать новый
          </button>
          <button
            type="button"
            disabled={!draft || saveBusy || readOnly}
            onClick={runSaveFlow}
          >
            {newSave.isPending ? "Сохранение…" : "Сохранить"}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={!draft || saveBusy || readOnly}
            onClick={handleRevertChanges}
          >
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
          {materialLoading ? (
            <div className="editor-panel-state">
              <p className="tab-placeholder">Загрузка материала…</p>
            </div>
          ) : materialLoadError ? (
            <div className="editor-panel-state">
              <div className="error-card">
                <h2>Не удалось загрузить материал</h2>
                <p className="error-message">{detailErrorMessage}</p>
                <button type="button" className="retry-button" onClick={() => void detail.refetch()}>
                  Повторить
                </button>
              </div>
            </div>
          ) : showEmptyPanel ? (
            <div className="editor-panel-state">
              <p className="tab-placeholder">
                Выберите материал в списке выше или создайте новый
              </p>
              <button type="button" className="button-secondary" onClick={handleCreateNew}>
                Создать новый
              </button>
            </div>
          ) : (
            <Routes>
              <Route index element={<Navigate to="general" replace />} />
              <Route
                path="general"
                element={
                  <AddRedactor
                    material={draft ?? undefined}
                    onDraftChange={handleDraftChange}
                    readOnly={readOnly}
                  />
                }
              />
              <Route
                path="physical"
                element={
                  <PhysicalPropertiesTab
                    material={draft ?? undefined}
                    onDraftChange={handleDraftChange}
                    readOnly={readOnly}
                  />
                }
              />
              <Route
                path="mechanical"
                element={
                  <MechanicalPropertiesTab
                    material={draft ?? undefined}
                    onDraftChange={handleDraftChange}
                    readOnly={readOnly}
                  />
                }
              />
              <Route
                path="chemical"
                element={
                  <ChemicalProperties
                    material={draft ?? undefined}
                    onDraftChange={handleDraftChange}
                    readOnly={readOnly}
                  />
                }
              />
            </Routes>
          )}
        </div>
      </div>
    </div>
  );
}