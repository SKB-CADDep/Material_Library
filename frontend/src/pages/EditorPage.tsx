import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMaterials, getMaterial, saveMaterial, saveNewMaterial } from "../api/materials";
import { useState, useEffect } from "react";
import { AddRedactor } from "./AddRedactor";
import { PhysicalPropertiesTab } from "./PhysicalPropertiesTab";
import { MechanicalPropertiesTab } from "./MechaicalPropertiesTab";
import { ChemicalProperties } from "./ChemicalProperties"

function editorSubtabClass({ isActive }: { isActive: boolean }) {
  return isActive ? "editor-subtab active" : "editor-subtab";
}
type ChemicalPropertiesSlice = {
  composition?: Array<{ composition_source?: string }>;
};

type MechanicalPropertiesSlice = {
  strength_category?: Array<{
    value_strength_category?: string;
    source_strength_category?: string | null;
    source_ref_id?: string | null;
  }>;
};

function hasKpSource(cat: {
  source_strength_category?: string | null;
  source_ref_id?: string | null;
}): boolean {
  return (
    Boolean((cat.source_strength_category ?? "").trim()) ||
    Boolean((cat.source_ref_id ?? "").trim())
  );
}

function validateDraftForSave(draft: Record<string, unknown>): string | null {
  const categories =
    (draft.mechanical_properties as MechanicalPropertiesSlice | undefined)
      ?.strength_category ?? [];
  for (const [i, cat] of categories.entries()) {
    if (!hasKpSource(cat)) {
      const name =
        (cat.value_strength_category ?? "").trim() || `КП #${i + 1}`;
      return `Укажите источник КП для категории «${name}»`;
    }
  }

  const compositions =
    (draft.chemical_properties as ChemicalPropertiesSlice | undefined)
      ?.composition ?? [];
  for (const [i, entry] of compositions.entries()) {
    if (!(entry.composition_source ?? "").trim()) {
      return `Укажите источник для набора состава #${i + 1}`;
    }
  }
  return null;
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
      modulus_elasticity: {
        property_name: "Модуль упругости",
        property_unit: "МПа",
        property_source: "",
        property_subsource: "",
        comment: "",
        temperature_value_pairs: [],
        property_last_updated: "",
      },
      coefficient_linear_expansion: {
        property_name: "Коэффициент линейного расширения",
        property_unit: "1/°С",
        property_source: "",
        property_subsource: "",
        comment: "",
        temperature_value_pairs: [],
        property_last_updated: "",
      },
      coefficient_thermal_conductivity: {
        property_name: "Коэффициент теплопроводности",
        property_unit: "Вт/(м·°С)",
        property_source: "",
        property_subsource: "",
        comment: "",
        temperature_value_pairs: [],
        property_last_updated: "",
      },
      density: {
        property_name: "Плотность",
        property_unit: "кг/м³",
        property_source: "",
        property_subsource: "",
        comment: "",
        temperature_value_pairs: [],
        property_last_updated: "",
      },
    },
    mechanical_properties: { strength_category: [] },
    chemical_properties: { composition: [] },
  };
}

export function EditorPage() {
  const result = useQuery({
    queryKey: ["materials"],
    queryFn: listMaterials,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["material", selectedId],
    queryFn: () => getMaterial(selectedId!),
    enabled: selectedId !== null,
  });
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null)
  const [isNewMaterial, setIsNewMaterial] = useState(false)
  useEffect(() => {
    if (isNewMaterial) {
      return;
    }
    if (!selectedId) {
      setDraft(null);
      return;
    }
    if (detail.data) {
      setDraft(structuredClone(detail.data));
    }
  }, [selectedId, detail.data, isNewMaterial]);
  const hasFileOnDisk = selectedId !== null && !isNewMaterial;
  const queryClient = useQueryClient();
  const newSave = useMutation({
    mutationFn: () => saveNewMaterial(draft!),
    onSuccess: () => {queryClient.invalidateQueries({ queryKey: ["material"] }); const id = draft?.material_id as string ;setIsNewMaterial(false); setSelectedId(id)}
  })
  const save = useMutation({
    mutationFn: () => saveMaterial(selectedId!, draft!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["material"] }),
  });

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
    setSaveValidationError(null);
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
            disabled={!selectedId || !draft || save.isPending || isNewMaterial}
            onClick={() => {
              if (!draft) return;
              const error = validateDraftForSave(draft);
              if (error) {
                setSaveValidationError(error);
                return;
              }
              setSaveValidationError(null);
              save.mutate();
            }}
          >
            {save.isPending ? "Сохранение…" : "Сохранить"}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={!draft || newSave.isPending || !isNewMaterial}
            onClick={() => {
              if (!draft) return;
              const error = validateDraftForSave(draft);
              if (error) {
                setSaveValidationError(error);
                return;
              }
              setSaveValidationError(null);
              newSave.mutate();
            }}
          >
            {newSave.isPending ? "Сохранение…" : "Сохранить как…"}
          </button>
          <button type="button" className="button-secondary" disabled>
            Отменить изменения
          </button>
        </div>
      </div>
      {saveValidationError && (
  <p className="editor-feedback error">{saveValidationError}</p>
)}
      {newSave.isError && <p className="editor-feedback-error">{newSave.error.message}</p>}
      {save.isError && <p className="editor-feedback error">{save.error.message}</p>}
      {save.isSuccess && (
        <p className="editor-feedback success-message">
          Материал {save.data.filename} успешно сохранён
        </p>
      )}
       {newSave.isSuccess && (
        <p className="editor-feedback success-message">
          Материал {newSave.data.filename} успешно сохранён
        </p>
      )}
      

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
                <AddRedactor material={draft ?? undefined} onDraftChange={setDraft} />
              }
            />
            <Route
              path="physical"
              element={<PhysicalPropertiesTab material={draft ?? undefined}  onDraftChange={setDraft}/>}
            />
            <Route
              path="mechanical"
              element={<MechanicalPropertiesTab material={draft ?? undefined}  onDraftChange={setDraft}/>}
            />
            <Route
              path="chemical"
              element={<ChemicalProperties material={draft ?? undefined}  onDraftChange={setDraft}/>}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}
