import type { ClassificationResponse } from "../types/api";

export type MaterialClassification = {
  classification_category?: string;
  classification_class?: string;
  classification_subclass?: string;
};

/** Сравнение без запятых: «Конструкционная легированная» и «Конструкционная, легированная». */
export function classificationTextKey(value: string): string {
  return value.replace(/,/g, "").replace(/\s+/g, " ").trim();
}

export function matchClassificationOption(
  value: string,
  options: string[],
): string | undefined {
  const key = classificationTextKey(value);
  if (!key) return undefined;
  return options.find((option) => classificationTextKey(option) === key);
}

export function isOrphanClassificationValue(
  current: string,
  options: string[],
): boolean {
  return current !== "" && matchClassificationOption(current, options) === undefined;
}

export function classificationClassOptions(
  catalog: ClassificationResponse | undefined,
  category: string,
): string[] {
  if (!catalog || !category) return [];
  const names = catalog.categories.map((item) => item.name);
  const matchedName = matchClassificationOption(category, names);
  const match = catalog.categories.find((item) => item.name === matchedName);
  return match?.classes.map((item) => item.name) ?? [];
}

export function classificationSubclassOptions(
  catalog: ClassificationResponse | undefined,
  category: string,
  className: string,
): string[] {
  if (!catalog || !category || !className) return [];
  const names = catalog.categories.map((item) => item.name);
  const matchedName = matchClassificationOption(category, names);
  const categoryItem = catalog.categories.find((item) => item.name === matchedName);
  const classNames = categoryItem?.classes.map((item) => item.name) ?? [];
  const matchedClass = matchClassificationOption(className, classNames);
  const classItem = categoryItem?.classes.find((item) => item.name === matchedClass);
  return classItem?.subclasses ?? [];
}

export function normalizeClassificationSelection(
  catalog: ClassificationResponse | undefined,
  current: MaterialClassification,
  patch: Partial<MaterialClassification>,
): MaterialClassification {
  const next: MaterialClassification = {
    classification_category:
      patch.classification_category ?? current.classification_category ?? "",
    classification_class:
      patch.classification_class ?? current.classification_class ?? "",
    classification_subclass:
      patch.classification_subclass ?? current.classification_subclass ?? "",
  };

  if (patch.classification_category !== undefined) {
    const classes = classificationClassOptions(catalog, next.classification_category ?? "");
    if (matchClassificationOption(next.classification_class ?? "", classes) === undefined) {
      next.classification_class = "";
      next.classification_subclass = "";
    }
  }

  if (
    patch.classification_category !== undefined ||
    patch.classification_class !== undefined
  ) {
    const subclasses = classificationSubclassOptions(
      catalog,
      next.classification_category ?? "",
      next.classification_class ?? "",
    );
    if (matchClassificationOption(next.classification_subclass ?? "", subclasses) === undefined) {
      next.classification_subclass = "";
    }
  }

  return next;
}

type ClassificationSelectProps = {
  id: string;
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

function ClassificationSelect({
  id,
  label,
  value,
  options,
  disabled = false,
  onChange,
}: ClassificationSelectProps) {
  const matched = matchClassificationOption(value, options);
  const showOrphan = isOrphanClassificationValue(value, options);
  const selected = matched ?? value;

  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="input property-field-wrap"
        value={selected}
        disabled={disabled}
        title={value || undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">— не выбран —</option>
        {showOrphan && (
          <option key={`orphan-${value}`} value={value}>
            {value}
          </option>
        )}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

type ClassificationFieldsetProps = {
  classification: MaterialClassification;
  catalog: ClassificationResponse | undefined;
  isLoading?: boolean;
  readOnly?: boolean;
  onChange: (next: MaterialClassification) => void;
};

export function ClassificationFieldset({
  classification,
  catalog,
  isLoading = false,
  readOnly = false,
  onChange,
}: ClassificationFieldsetProps) {
  const category = classification.classification_category ?? "";
  const className = classification.classification_class ?? "";
  const subclass = classification.classification_subclass ?? "";

  const categoryOptions = catalog?.categories.map((item) => item.name) ?? [];
  const classOptions = classificationClassOptions(catalog, category);
  const subclassOptions = classificationSubclassOptions(catalog, category, className);

  const disabled = isLoading || !catalog || readOnly;

  return (
    <fieldset className="form-section">
      <legend>Классификация</legend>
      {isLoading && (
        <p className="tab-placeholder tab-placeholder--inline">Загрузка справочника…</p>
      )}
      <ClassificationSelect
        id="classification-category"
        label="Категория:"
        value={category}
        options={categoryOptions}
        disabled={disabled}
        onChange={(value) =>
          onChange(
            normalizeClassificationSelection(catalog, classification, {
              classification_category: value,
            }),
          )
        }
      />
      <ClassificationSelect
        id="classification-class"
        label="Структурный класс:"
        value={className}
        options={classOptions}
        disabled={disabled || !category}
        onChange={(value) =>
          onChange(
            normalizeClassificationSelection(catalog, classification, {
              classification_class: value,
            }),
          )
        }
      />
      <ClassificationSelect
        id="classification-subclass"
        label="Подкласс:"
        value={subclass}
        options={subclassOptions}
        disabled={disabled || !className}
        onChange={(value) =>
          onChange(
            normalizeClassificationSelection(catalog, classification, {
              classification_subclass: value,
            }),
          )
        }
      />
    </fieldset>
  );
}
