import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMaterials, getMaterial, saveMaterial } from "../api/materials";
import { useState, useEffect } from "react";
import { AddRedactor } from "./AddRedactor";
import { PhysicalPropertiesTab } from "./PhysicalPropertiesTab";
import { MechanicalPropertiesTab } from "./MechaicalPropertiesTab";

function editorSubtabClass({ isActive }: { isActive: boolean }) {
  return isActive ? "editor-subtab active" : "editor-subtab";
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
  useEffect(() => {
    if (!selectedId || !detail.data) {
      setDraft(null);
      return;
    }
    setDraft(structuredClone(detail.data));
  }, [selectedId, detail.data]);
  const queryClient = useQueryClient();
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

  return (
    <div className="editor-page">
      <div className="editor-toolbar">
        <div className="material-select">
          <label htmlFor="material-select">Выберите материал:</label>
          <select
            id="material-select"
            className="input"
            value={selectedId ?? ""}
            onChange={(event) => setSelectedId(event.target.value || null)}
          >
            <option value="">— не выбран —</option>
            {result.data.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name}
              </option>
            ))}
          </select>
        </div>
        <div className="button-group">
          <button type="button" className="button-secondary" disabled>
            Создать новый
          </button>
          <button
            type="button"
            disabled={!selectedId || !draft || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Сохранение…" : "Сохранить"}
          </button>
          <button type="button" className="button-secondary" disabled>
            Сохранить как…
          </button>
          <button type="button" className="button-secondary" disabled>
            Отменить изменения
          </button>
        </div>
      </div>

      {save.isError && <p className="editor-feedback error">{save.error.message}</p>}
      {save.isSuccess && (
        <p className="editor-feedback success-message">
          Материал {save.data.filename} успешно сохранён
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
              element={<p className="tab-placeholder">Химический состав — в разработке</p>}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}
