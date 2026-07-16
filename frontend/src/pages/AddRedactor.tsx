import { useState } from "react";

type AddRedactorProps = {
  material: Record<string, unknown> | undefined;
  onDraftChange: (next: Record<string, unknown>) => void;
};

const ALL_AREAS = [
  "Зарубежные материалы",
  "Конструкционные материалы",
  "Крепежные материалы",
  "Литейные материалы",
  "Материалы дисков и роторов",
  "Материалы лопаток",
  "Трубки конденсатора",
];

export function AddRedactor({ material, onDraftChange }: AddRedactorProps) {
  const [newArea, setNewArea] = useState("");
  const [areas, setAreas] = useState(ALL_AREAS);

  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }

  const metadata = material.metadata as {
    name_material_standard?: string;
    name_material_alternative?: string | string[];
    comment?: string;
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
    <form className="general-form" onSubmit={(e) => e.preventDefault()}>
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
                  metadata: { ...metadata, name_material_alternative: text },
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

        <fieldset className="form-section">
          <legend>Классификация</legend>
          <div className="form-row">
            <label htmlFor="category">Категория:</label>
            <input
              id="category"
              type="text"
              value={metadata.classification?.classification_category ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;
                onDraftChange({
                  ...material,
                  metadata: { ...metadata, classification:{...metadata.classification, classification_category: text }
                },});
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="class">Структурный класс:</label>
            <input
              id="class"
              type="text"
              value={metadata.classification?.classification_class ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;
                onDraftChange({
                    ...material,
                    metadata: { ...metadata, classification:{...metadata.classification, classification_class: text }
                  },});
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="subclass">Подкласс:</label>
            <input
              id="subclass"
              type="text"
              value={metadata.classification?.classification_subclass ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;
                onDraftChange({
                    ...material,
                    metadata: { ...metadata, classification:{...metadata.classification, classification_subclass: text }
                  },});
              }}
            />
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Области применения</legend>
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
                setAreas([...areas, trimmed]);
                onDraftChange({...material, metadata: {...metadata, application_area:[...(metadata.application_area ?? []), trimmed]}})
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
              type="number"
              value={metadata.temperature_application?.value ?? ""}
              className="input"
              onChange={(event) => {
                const number = event.target.value;
                onDraftChange({
                    ...material,
                    metadata: { ...metadata, temperature_application:{...metadata.temperature_application, value: number }
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
