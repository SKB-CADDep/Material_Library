import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { UnitSelect } from "./UnitSelect";
import { getSources } from "../api/sources";
import { useQuery } from "@tanstack/react-query";
type MechanicalPropertiesTabProps = {
  material: Record<string, unknown> | undefined;
  onDraftChange: (next: Record<string, unknown>) => void;
};

type PropertyData = {
  temperature_value_pairs?: Array<[number, number]>;
  value_unit?: string;
  comment?: string;
  property_subsource?: string | number | readonly string[];
  min_value?: number;
  is_acceptance?: boolean;
};

type StrengthCategory = {
  value_strength_category?: string;
  [key: string]: unknown;
  hardness_unit: string;
  source_strength_category?: string | null;
  source_ref_id?: string | null;
};

/** Имя источника КП: строковое поле или резолв source_ref_id через strength_sources. */
function resolveKpSourceName(
  cat: StrengthCategory | undefined,
  sources: Array<Record<string, string>>,
): string {
  const byName = (cat?.source_strength_category ?? "").trim();
  if (byName) return byName;
  const refId = String(cat?.source_ref_id ?? "").trim();
  if (!refId) return "";
  return sources.find((src) => src.id_source === refId)?.name_source ?? refId;
}

type MechanicalProperties = {
  strength_category?: StrengthCategory[];
};

type MechPropertyConfig = {
  key: string;
  legend: string;
  unitType: string;
  yLabel: string;
  hasAcceptance?: boolean;
};
type UndependMechPropertiesConfig = {
  key: string;
  legend: string;
  unitType: string;
};
/** Температурозависимые мех. свойства: от предела текучести до выносливости (как в Tkinter / catalog). */
const TEMPERATURE_MECH_PROPERTIES: MechPropertyConfig[] = [
  {
    key: "yield_strength",
    legend: "Предел текучести (σ_0,2)",
    unitType: "Предел текучести",
    yLabel: "σ_0,2, МПа",
    hasAcceptance: true,
  },
  {
    key: "tensile_strength",
    legend: "Предел прочности (σ_в)",
    unitType: "Предел прочности",
    yLabel: "σ_в, МПа",
    hasAcceptance: true,
  },
  {
    key: "impact_strength",
    legend: "Ударная вязкость (KCU)",
    unitType: "Ударная вязкость",
    yLabel: "KCU, Дж/см²",
    hasAcceptance: true,
  },
  {
    key: "tensile_strength_limit_10_thousands_hours",
    legend: "Предел длит. прочности за 10 тыс.ч (σ_дп_10)",
    unitType: "Предел длит. прочности",
    yLabel: "σ_дп_10, МПа",
  },
  {
    key: "tensile_strength_limit_100_thousands_hours",
    legend: "Предел длит. прочности за 100 тыс.ч (σ_дп_100)",
    unitType: "Предел длит. прочности",
    yLabel: "σ_дп_100, МПа",
  },
  {
    key: "tensile_strength_limit_200_thousands_hours",
    legend: "Предел длит. прочности за 200 тыс.ч (σ_дп_200)",
    unitType: "Предел длит. прочности",
    yLabel: "σ_дп_200, МПа",
  },
  {
    key: "tensile_strength_limit_250_thousands_hours",
    legend: "Предел длит. прочности за 250 тыс.ч (σ_дп_250)",
    unitType: "Предел длит. прочности",
    yLabel: "σ_дп_250, МПа",
  },
  {
    // ключ в JSON с кириллической «с»
    key: "сreep_strain_rate_1_100_thousands_hours",
    legend: "Ползучесть 1%/100 тыс.ч (σ_1_100)",
    unitType: "Предел ползучести",
    yLabel: "σ_1_100, МПа",
  },
  {
    key: "decrement_oscillations_at_800",
    legend: "Декремент колебаний при 800 (·10⁻⁴) (δψ_800)",
    unitType: "Декремент колебаний",
    yLabel: "δψ_800",
  },
  {
    key: "decrement_oscillations_at_1200",
    legend: "Декремент колебаний при 1200 (·10⁻⁴) (δψ_1200)",
    unitType: "Декремент колебаний",
    yLabel: "δψ_1200",
  },
  {
    key: "decrement_oscillations_at_1600",
    legend: "Декремент колебаний при 1600 (·10⁻⁴) (δψ_1600)",
    unitType: "Декремент колебаний",
    yLabel: "δψ_1600",
  },
  {
    key: "fatigue_limit_for_smooth_specimen",
    legend: "Предел выносливости (гладкий образец, N=10e7) (σ_-1_smooth)",
    unitType: "Предел выносливости",
    yLabel: "σ_-1_smooth, МПа",
  },
  {
    key: "fatigue_limit_for_notched_specimen",
    legend: "Предел выносливости (образец с надрезом, N=10e7) (σ_-1_notched)",
    unitType: "Предел выносливости",
    yLabel: "σ_-1_notched, МПа",
  },
];

const UNDEPEND_MECH_PROPERTIES: UndependMechPropertiesConfig[] = [
  {
    key: "relative_elongation",
    legend: "Относительное удлинение(не менее)",
    unitType: "Безразмерный",
  },
  {
    key: "relative_contraction",
    legend: "Относительное сужение(не менее)",
    unitType: "Безразмерный",
  },
  {
    key: "angle_of_bend",
    legend: "Угол изгиба",
    unitType: "Угол",
  },
];

type ChartPoint = { temperature: number; value: number };

function toChartData(pairs: Array<[number, number]> | undefined): ChartPoint[] {
  return (pairs ?? []).map(([temperature, value]) => ({ temperature, value }));
}

function TemperatureGraph({
  data,
  yLabel = "Значение",
}: {
  data: ChartPoint[];
  yLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="tab-placeholder">Нет данных для графика</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={data}
        margin={{ left: 8, right: 16, top: 8, bottom: 24 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={["dataMin", "dataMax"]}
          dataKey="temperature"
          label={{ value: "T, °C", position: "insideBottom", offset: -5 }}
        />
        <YAxis
          width={72}
          domain={["dataMin", "dataMax"]}
          label={{ value: yLabel, angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          formatter={(value) => [value, "Значение"]}
          labelFormatter={(label) => `Температура: ${label}°C`}
        />
        <Line
          type="linear"
          dataKey="value"
          stroke="#3D5A80"
          strokeWidth={2}
          dot={{ fill: "#3D5A80", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TemperatureValueTable({
  pairs,
}: {
  pairs: Array<[number, number]> | undefined;
}) {
  return (
    <div className="table-wrapper">
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>T, °C</th>
              <th>Значение</th>
            </tr>
          </thead>
          <tbody>
            {(pairs ?? []).map(([temperature, value], index) => (
              <tr key={index}>
                <td>
                  <input
                    type="number"
                    readOnly
                    value={temperature}
                    className="table-cell-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    readOnly
                    value={value}
                    className="table-cell-input"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-controls">
        <button
          type="button"
          className="table-control-btn"
          disabled
          title="Редактирование — позже"
        >
          +
        </button>
        <button
          type="button"
          className="table-control-btn"
          disabled
          title="Редактирование — позже"
        >
          −
        </button>
      </div>
    </div>
  );
}

function getPropertyData(
  category: StrengthCategory | undefined,
  key: string,
): PropertyData | undefined {
  if (!category) return undefined;
  return category[key] as PropertyData | undefined;
}

function patchCategoryProperty(
  material: Record<string, unknown>,
  mechanical: MechanicalProperties,
  categoryIndex: number,
  propertyKey: string,
  patch: Partial<PropertyData>,
): Record<string, unknown> {
  const categories = mechanical.strength_category ?? [];
  const current = categories[categoryIndex] ?? {};
  const prevProp = (current[propertyKey] as PropertyData | undefined) ?? {};

  return {
    ...material,
    mechanical_properties: {
      ...mechanical,
      strength_category: categories.map((cat, i) =>
        i !== categoryIndex
          ? cat
          : {
              ...cat,
              [propertyKey]: {
                ...prevProp,
                ...patch,
              },
            },
      ),
    },
  };
}

export function MechanicalPropertiesTab({
  material,
  onDraftChange,
}: MechanicalPropertiesTabProps) {
  const result = useQuery({
    queryKey: ["sources"],
    queryFn: getSources,
  });
  const mechanicalSources = result.data?.strength_sources ?? [];
  const [categoryIndex, setCategoryIndex] = useState(0);
  const materialKey =
    (material as { id?: string } | undefined)?.id ??
    (material as { metadata?: { name_material_standard?: string } } | undefined)
      ?.metadata?.name_material_standard ??
    null;
  useEffect(() => {
    setCategoryIndex(0);
  }, [materialKey]);
  const mechanical_properties = (material?.mechanical_properties ??
    {}) as MechanicalProperties;
  const category = mechanical_properties.strength_category?.[categoryIndex];
  const currentSource = resolveKpSourceName(category, mechanicalSources);
  const sourceNames = mechanicalSources.map((src) => src.name_source);
  const showOrphan =
    currentSource !== "" && !sourceNames.includes(currentSource);

  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }
  const hardnessRows =
    (category?.hardness as
      | Array<{
          unit_value?: string;
          min_value?: number;
          max_value?: number;
        }>
      | undefined) ?? [];
  

  return (
    <form
      className="general-form physical-properties-form"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="form-stack">
        <div className="form-row">
          <label htmlFor="strength_category_select">Категория прочности:</label>
          <select
            id="strength_category_select"
            className="input"
            value={
              (mechanical_properties.strength_category?.length ?? 0) > 0
                ? categoryIndex
                : ""
            }
            onChange={(e) => setCategoryIndex(Number(e.target.value))}
            disabled={(mechanical_properties.strength_category?.length ?? 0) === 0}
          >
            {(mechanical_properties.strength_category ?? []).map(
              (cat, index) => (
                <option key={index} value={index}>
                  {cat.value_strength_category ?? `КП #${index + 1}`}
                </option>
              ),
            )}
          </select>
          <button
            type="button"
            className="table-control-btn"
            title="Добавить категорию прочности"
            onClick={() => {
              const prev = mechanical_properties.strength_category ?? [];
              const newIndex = prev.length;
              const newCat: StrengthCategory = {
                value_strength_category: `Новая КП ${newIndex + 1}`,
                source_strength_category: "",
                source_ref_id: "",
                hardness: [],
                hardness_unit: "",
              };
              onDraftChange({
                ...material,
                mechanical_properties: {
                  ...mechanical_properties,
                  strength_category: [...prev, newCat],
                },
              });
              setCategoryIndex(newIndex);
            }}
          >
            +
          </button>
          <button
            type="button"
            className="table-control-btn"
            title="Удалить категорию прочности"
            disabled={(mechanical_properties.strength_category?.length ?? 0) === 0}
            onClick={() => {
              const prev = mechanical_properties.strength_category ?? [];
              if (prev.length === 0) return;
              if (!window.confirm("Удалить категорию?")) return;
              const next = prev.filter((_, i) => i !== categoryIndex);
              onDraftChange({
                ...material,
                mechanical_properties: {
                  ...mechanical_properties,
                  strength_category: next,
                },
              });
              // как в Tkinter populate_form: после удаления выбрать первую, иначе сбросить
              setCategoryIndex(0);
            }}
          >
            −
          </button>
        </div>
        <fieldset className="form-section">
        <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
              <label htmlFor="name_strength_select">
                  Название КП:
                </label>
                <input
                  id="name_strength_select"
                  type="text"
                  value={
                    mechanical_properties?.strength_category?.[categoryIndex]?.value_strength_category ?? ""
                  }
                  className="input"
                  onChange={(event) => {
                    const text = event.target.value;
                    onDraftChange({
                      ...material,
                      mechanical_properties: {
                        ...mechanical_properties,
                        strength_category: mechanical_properties.strength_category?.map(
                          (cat, idx) =>
                            idx === categoryIndex
                              ? { ...cat, value_strength_category: text }
                              : cat
                        ) ?? [{ value_strength_category: text }],
                      },
                    });
                  }}
                />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="source_strength_select">Источник КП:</label>
              <select
                id="source_strength_select"
                className="input"
                value={currentSource}
                onChange={(e) => {
                  const name = e.target.value;
                  const matched = mechanicalSources.find(
                    (src) => src.name_source === name,
                  );
                  const source_strength_category = name;
                  const source_ref_id = matched?.id_source ?? "";
                  onDraftChange({
                    ...material,
                    mechanical_properties: {
                      ...mechanical_properties,
                      strength_category:
                        mechanical_properties.strength_category?.map(
                          (cat, idx) =>
                            idx === categoryIndex
                              ? {
                                  ...cat,
                                  source_strength_category,
                                  source_ref_id,
                                }
                              : cat,
                        ) ?? [
                          {
                            source_strength_category,
                            source_ref_id,
                            hardness_unit: "",
                          },
                        ],
                    },
                  });
                }}
              >
                <option value="">— не выбран —</option>
                {showOrphan && (
                  <option key={`orphan-${currentSource}`} value={currentSource}>
                    {currentSource}
                  </option>
                )}
                {mechanicalSources.map((src) => (
                  <option
                    key={src.id_source ?? src.name_source}
                    value={src.name_source}
                  >
                    {src.name_source}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
        {TEMPERATURE_MECH_PROPERTIES.map((prop) => {
          const data = getPropertyData(category, prop.key);
          const unitId = `${prop.key}_value_unit`;
          const sourceId = `${prop.key}_property_subsource`;
          const commentId = `${prop.key}_comment`;

          return (
            <fieldset key={prop.key} className="form-section">
              <legend>{prop.legend}</legend>
              {prop.hasAcceptance && (
                <div className="form-row">
                  <label
                    htmlFor={`${prop.key}_is_acceptance`}
                    className="checkbox-item"
                  >
                    <input
                      id={`${prop.key}_is_acceptance`}
                      type="checkbox"
                      checked={data?.is_acceptance ?? false}
                      onChange={(event) => {
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            { is_acceptance: event.target.checked },
                          ),
                        );
                      }}
                    />{" "}
                    Сдаточная характеристика
                  </label>
                </div>
              )}
              <div className="property-section-layout">
                <div className="property-section-fields">
                  <div className="form-row">
                    <label htmlFor={unitId}>Ед. изм:</label>
                    <UnitSelect
                      id={unitId}
                      unitType={prop.unitType}
                      value={data?.value_unit ?? ""}
                      onChange={(nextUnit) => {
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            { value_unit: nextUnit },
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor={sourceId}>Источник свойств:</label>
                    <input
                      id={sourceId}
                      type="text"
                      value={data?.property_subsource ?? ""}
                      className="input"
                      readOnly
                      title="Редактирование источника — позже"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor={commentId}>Комментарий:</label>
                    <input
                      id={commentId}
                      type="text"
                      value={data?.comment ?? ""}
                      className="input"
                      onChange={(event) => {
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            { comment: event.target.value },
                          ),
                        );
                      }}
                    />
                  </div>
                  <TemperatureValueTable
                    pairs={data?.temperature_value_pairs}
                  />
                </div>
                <div className="property-section-chart">
                  <TemperatureGraph
                    data={toChartData(data?.temperature_value_pairs)}
                    yLabel={yLabelWithUnit(prop.yLabel, data?.value_unit)}
                  />
                </div>
              </div>
            </fieldset>
          );
        })}

        <fieldset className="form-section">
          <legend>Твёрдость</legend>
          <div className="form-row">
            <label htmlFor="hardness_is_acceptance" className="checkbox-item">
              <input
                id="hardness_is_acceptance"
                type="checkbox"
                checked={Boolean(category?.hardness_is_acceptance)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  const categories =
                    mechanical_properties.strength_category ?? [];
                  onDraftChange({
                    ...material,
                    mechanical_properties: {
                      ...mechanical_properties,
                      strength_category: categories.map((cat, i) =>
                        i !== categoryIndex
                          ? cat
                          : {
                              ...cat,
                              hardness_is_acceptance: checked,
                            },
                      ),
                    },
                  });
                }}
              />{" "}
              Сдаточная характеристика
            </label>
          </div>
          <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
                <label htmlFor="hardness_value_unit">Ед. изм:</label>
                <UnitSelect
                  id="hardness_value_unit"
                  unitType="Твердость"
                  value={
                    (category?.hardness_unit as string | undefined) ??
                    hardnessRows[0]?.unit_value ??
                    ""
                  }
                  onChange={(nextUnit) => {
                    const categories =
                      mechanical_properties.strength_category ?? [];
                    onDraftChange({
                      ...material,
                      mechanical_properties: {
                        ...mechanical_properties,
                        strength_category: categories.map((cat, i) => {
                          if (i !== categoryIndex) return cat;
                          const rows =
                            (cat.hardness as typeof hardnessRows | undefined) ??
                            [];
                          return {
                            ...cat,
                            hardness_unit: nextUnit,
                            hardness: rows.map((row) => ({
                              ...row,
                              unit_value: nextUnit,
                            })),
                          };
                        }),
                      },
                    });
                  }}
                />
              </div>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Min</th>
                  <th>Max</th>
                </tr>
              </thead>
              <tbody>
                {hardnessRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.min_value ?? ""}</td>
                    <td>{row.max_value ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        {UNDEPEND_MECH_PROPERTIES.map((prop) => {
          const data = getPropertyData(category, prop.key);
          const unitId = `${prop.key}_value_unit`;
          const sourceId = `${prop.key}_property_subsource`;
          const commentId = `${prop.key}_comment`;
          const value = `${prop.key}_value`;

          return (
            <fieldset key={prop.key} className="form-section">
              <legend>{prop.legend}</legend>
              <div className="form-row">
                <label
                  htmlFor={`${prop.key}_is_acceptance`}
                  className="checkbox-item"
                >
                  <input
                    id={`${prop.key}_is_acceptance`}
                    type="checkbox"
                    checked={data?.is_acceptance ?? false}
                    onChange={(event) => {
                      onDraftChange(
                        patchCategoryProperty(
                          material,
                          mechanical_properties,
                          categoryIndex,
                          prop.key,
                          { is_acceptance: event.target.checked },
                        ),
                      );
                    }}
                  />{" "}
                  Сдаточная характеристика
                </label>
              </div>
              <div className="property-section-layout">
                <div className="property-section-fields">
                  <div className="form-row">
                    <label htmlFor={unitId}>Ед. изм:</label>
                    <UnitSelect
                      id={unitId}
                      unitType={prop.unitType}
                      value={data?.value_unit ?? ""}
                      onChange={(nextUnit) => {
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            { value_unit: nextUnit },
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor={sourceId}>Источник свойств:</label>
                    <input
                      id={sourceId}
                      type="text"
                      value={data?.property_subsource ?? ""}
                      className="input"
                      readOnly
                      title="Редактирование источника — позже"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor={commentId}>Комментарий:</label>
                    <input
                      id={commentId}
                      type="text"
                      value={data?.comment ?? ""}
                      className="input"
                      onChange={(event) => {
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            { comment: event.target.value },
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor={value}>Значение:</label>
                    <input
                      id={value}
                      type="number"
                      value={data?.min_value ?? ""}
                      className="input"
                      onChange={(event) => {
                        const raw = event.target.value;
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            { min_value: raw === "" ? undefined : Number(raw) },
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Min</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                        <td>{data?.min_value ?? ""}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </fieldset>
          );
        })}
      </div>
    </form>
  );
}


/** Показывать единицу из draft, если она есть. */
function yLabelWithUnit(baseLabel: string, unit: string | undefined): string {
  if (!unit) return baseLabel;
  // если в подписи уже есть единица после запятой — заменяем хвост
  const comma = baseLabel.lastIndexOf(",");
  if (comma >= 0) {
    return `${baseLabel.slice(0, comma)}, ${unit}`;
  }
  return `${baseLabel}, ${unit}`;
}

// алиас на случай старого имени экспорта
export { MechanicalPropertiesTab as MechaicalPropertiesTab };
