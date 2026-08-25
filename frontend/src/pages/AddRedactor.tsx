import { useState, useMemo, useEffect } from "react";
import { useWorkspace } from "../context/WorkSpaceContext";
import { useClassificationCatalog } from "../hooks/useClassificationCatalog";
import { ClassificationFieldset } from "../components/ClassificationFieldset";
import { parseDecimalInput } from "../lib/formatDecimal";

type AddRedactorProps = {
  material: Record<string, unknown> | undefined;
  onDraftChange: (next: Record<string, unknown>) => void;
  readOnly?: boolean;
};

export function AddRedactor({ material, onDraftChange, readOnly = false }: AddRedactorProps) {
  const [newArea, setNewArea] = useState("");
  const [localAddedAreas, setLocalAddedAreas] = useState<string[]>([]);
  const { workspace } = useWorkspace();
  const classificationQuery = useClassificationCatalog();

  const materialKey =
    (material as { material_id?: string } | undefined)?.material_id ?? null;

  useEffect(() => {
    setLocalAddedAreas([]);
  }, [materialKey]);

  const materialAreas =
    (
      material?.metadata as { application_area?: string[] } | undefined
    )?.application_area ?? [];

  const areas = useMemo(() => {
    const fromWorkspace = workspace?.application_areas ?? [];
    const merged = new Set([
      ...fromWorkspace,
      ...materialAreas,
      ...localAddedAreas,
    ]);
    return [...merged].sort((a, b) => a.localeCompare(b, "ru"));
  }, [workspace?.application_areas, materialAreas, localAddedAreas]);

  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }

  const metadata = material.metadata as {
    name_material_standard?: string;
    name_material_alternative?: string | string[];
    comment?: string;
    larson_miller_constant_c?: number | string;
    classification?: {
      classification_category?: string;
      classification_class?: string;
      classification_subclass?: string;
    };
    application_area: string[];
    temperature_application?: {
      value: number;
      comment: string;
    };
  };

  const alternative = Array.isArray(metadata.name_material_alternative)
    ? metadata.name_material_alternative.join(", ")
    : (metadata.name_material_alternative ?? "");

  return (
    <form
      className="general-form"
      inert={readOnly ? true : undefined}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="form-stack">
        <div className="form-row">
          <label htmlFor="name-standard">Наименование (стандарт):</label>
          <input
            id="name-standard"
            type="text"
            value={metadata.name_material_standard ?? ""}
            className="input"
            onChange={(event) => {
                const text = event.target.value;
                onDraftChange({
                  ...material,
                  metadata: { ...metadata, name_material_standard: text },
                });
              }}
          />
        </div>

        <div className="form-row">
          <label htmlFor="name-alt">Альтернативные названия (через запятую):</label>
          <input
            id="name-alt"
            type="text"
            value={alternative}
            className="input"
            onChange={(event) => {
                const text = event.target.value;
                onDraftChange({
                  ...material,
                  metadata: { ...metadata, name_material_alternative: text.split(",").map(s => s.trim()).filter(Boolean)},
                });
              }}
          />
        </div>

        <div className="form-row">
          <label htmlFor="comment">Общий комментарий:</label>
          <input
            id="comment"
            type="text"
            value={metadata.comment ?? ""}
            className="input"
            onChange={(event) => {
              const text = event.target.value;
              onDraftChange({
                ...material,
                metadata: { ...metadata, comment: text },
              });
            }}
          />
        </div>

        <div className="form-row">
          <label htmlFor="larson-miller-constant-c">
            Константа Ларсона-Миллера C:
          </label>
          <input
            id="larson-miller-constant-c"
            type="text"
            value={
              metadata.larson_miller_constant_c != null
                ? String(metadata.larson_miller_constant_c)
                : ""
            }
            className="input"
            onChange={(event) => {
              const text = event.target.value.trim();
              onDraftChange({
                ...material,
                metadata: {
                  ...metadata,
                  larson_miller_constant_c: text === "" ? undefined : text,
                },
              });
            }}
          />
        </div>

        <ClassificationFieldset
          classification={metadata.classification ?? {}}
          catalog={classificationQuery.data}
          isLoading={classificationQuery.isLoading}
          readOnly={readOnly}
          onChange={(classification) =>
            onDraftChange({
              ...material,
              metadata: { ...metadata, classification },
            })
          }
        />
        <fieldset className="form-section">
          <legend>Области применения</legend>
          {areas.length === 0 && (
            <p className="tab-placeholder tab-placeholder--inline">
              Области не найдены в workspace — добавьте вручную ниже
            </p>
          )}
          <div className="checkbox-list">
            {areas.map((area) => (
              <label key={area} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={metadata.application_area?.includes(area) ?? false}
                  onChange={(event) => {
                    const status = event.target.checked;
                    if (status) {
                      onDraftChange({
                        ...material,
                        metadata: { ...metadata, application_area:[...(metadata.application_area ?? []), area]
                      },});
                    }
                    if (!status) {
                      onDraftChange({
                        ...material,
                        metadata: { ...metadata, application_area:[...(metadata.application_area ?? []).filter(a => a!==area)]
                      },});
                    }
                  }}
                  
                />
                {area}
              </label>
            ))}
          </div>
          <div className="add-row">
            <label htmlFor="new-area">Добавить область применения:</label>
            <input
              id="new-area"
              type="text"
              className="input"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
            />
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                const trimmed = newArea.trim();
                if (!trimmed || areas.includes(trimmed)) return;
                setLocalAddedAreas((prev) =>
                  prev.includes(trimmed) ? prev : [...prev, trimmed],
                );
                onDraftChange({
                  ...material,
                  metadata: {
                    ...metadata,
                    application_area: [
                      ...(metadata.application_area ?? []),
                      trimmed,
                    ],
                  },
                });
                setNewArea("");
              }}
            >
              Добавить
            </button>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Параметры применения</legend>
          <div className="form-row">
            <label htmlFor="temperature">Температура применения ДО, °C:</label>
            <input
              id="temperature"
              type="text"
              inputMode="decimal"
              value={metadata.temperature_application?.value ?? ""}
              className="input"
              onChange={(event) => {
                const raw = event.target.value;
                const parsed = parseDecimalInput(raw);
                const value = raw === "" ? "" : (parsed ?? raw);
                onDraftChange({
                    ...material,
                    metadata: { ...metadata, temperature_application:{...metadata.temperature_application, value: value }
                  },});
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="temperature_comment">Комментарий к температуре:</label>
            <input
              id="temperature_comment"
              type="text"
              value={metadata.temperature_application?.comment ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;
                onDraftChange({
                    ...material,
                    metadata: { ...metadata, temperature_application:{...metadata.temperature_application, comment: text }
                  },});
              }}
            />
          </div>
        </fieldset>
      </div>
    </form>
  );
}
