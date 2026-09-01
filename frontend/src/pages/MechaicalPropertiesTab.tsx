import { useEffect, useRef, useState } from "react";
import { UnitSelect } from "./UnitSelect";
import { useSourcesCatalog } from "../hooks/useSourcesCatalog";
import { useKeepAlivePaneActive } from "../context/KeepAlivePaneContext";
import {
  PropertySourceSelect,
  isOrphanSource,
  resolvePropertySourceName,
} from "./PropertySourceSelect";
import { yLabelWithUnit } from "./chartLabels";
import {
  formatCategoryOptionLabel,
  resolveCategorySourceName,
} from "../lib/strengthCategory";
import { RequiredMark } from "../components/RequiredMark";
import { RequiredFieldsFootnote } from "../components/RequiredFieldsFootnote";
import { PropertyTemperatureLineChart } from "../components/PropertyTemperatureLineChart";
import { PropertyCommentField } from "../components/PropertyCommentField";
import { TemperatureValueTable } from "../components/TemperatureValueTable";
import { parseDecimalInput } from "../lib/formatDecimal";
import { useUnitLabels } from "../hooks/useUnitLabels";
import { usePropertiesCatalog } from "../hooks/usePropertiesCatalog";
import { useResizableTableHeaders } from "../hooks/useResizableTableHeaders";
import { HARDNESS_UNIT_TYPE } from "../lib/unitTypes";
import { ScientificText } from "../lib/scientificNotation";
import {
  findNamedProp,
  patchNamedPropertyInContainer,
  type NamedProperty,
} from "../lib/namedProperties";

type MechanicalPropertiesTabProps = {
  material: Record<string, unknown> | undefined;
  onDraftChange: (next: Record<string, unknown>) => void;
  readOnly?: boolean;
};

type PropertyData = NamedProperty;

type StrengthCategory = {
  value_strength_category?: string;
  [key: string]: unknown;
  hardness_unit: string;
  source_strength_category?: string | null;
  source_ref_id?: string | null;
  properties?: NamedProperty[];
};

type MechanicalProperties = {
  strength_category?: StrengthCategory[];
};

type MechPropertyConfig = {
  key: string;
  legend: string;
  yLabel: string;
  hasAcceptance?: boolean;
};
type UndependMechPropertiesConfig = {
  key: string;
  legend: string;
};
function parsePairNumber(raw: string): number {
  if (raw === "" || raw === "-") return NaN;
  return parseDecimalInput(raw) ?? NaN;
}

const TEMPERATURE_MECH_PROPERTIES: MechPropertyConfig[] = [
  {
    key: "yield_strength",
    legend: "Предел текучести (σ_0,2)",
    yLabel: "σ_0,2, МПа",
    hasAcceptance: true,
  },
  {
    key: "tensile_strength",
    legend: "Предел прочности (σ_в)",
    yLabel: "σ_в, МПа",
    hasAcceptance: true,
  },
  {
    key: "impact_strength",
    legend: "Ударная вязкость (KCU)",
    yLabel: "KCU, Дж/см²",
    hasAcceptance: true,
  },
  {
    key: "tensile_strength_limit_10_thousands_hours",
    legend: "Предел длит. прочности за 10 тыс.ч (σ_дп_10)",
    yLabel: "σ_дп_10, МПа",
  },
  {
    key: "tensile_strength_limit_100_thousands_hours",
    legend: "Предел длит. прочности за 100 тыс.ч (σ_дп_100)",
    yLabel: "σ_дп_100, МПа",
  },
  {
    key: "tensile_strength_limit_200_thousands_hours",
    legend: "Предел длит. прочности за 200 тыс.ч (σ_дп_200)",
    yLabel: "σ_дп_200, МПа",
  },
  {
    key: "tensile_strength_limit_250_thousands_hours",
    legend: "Предел длит. прочности за 250 тыс.ч (σ_дп_250)",
    yLabel: "σ_дп_250, МПа",
  },
  {

    key: "сreep_strain_rate_1_100_thousands_hours",
    legend: "Ползучесть 1%/100 тыс.ч (σ_1_100)",
    yLabel: "σ_1_100, МПа",
  },
  {
    key: "decrement_oscillations_at_800",
    legend: "Декремент колебаний при 800 (·10⁻⁴) (δψ_800)",
    yLabel: "δψ_800",
  },
  {
    key: "decrement_oscillations_at_1200",
    legend: "Декремент колебаний при 1200 (·10⁻⁴) (δψ_1200)",
    yLabel: "δψ_1200",
  },
  {
    key: "decrement_oscillations_at_1600",
    legend: "Декремент колебаний при 1600 (·10⁻⁴) (δψ_1600)",
    yLabel: "δψ_1600",
  },
  {
    key: "fatigue_limit_for_smooth_specimen",
    legend: "Предел выносливости (гладкий образец, N=10e7) (σ_-1_smooth)",
    yLabel: "σ_-1_smooth, МПа",
  },
  {
    key: "fatigue_limit_for_notched_specimen",
    legend: "Предел выносливости (образец с надрезом, N=10e7) (σ_-1_notched)",
    yLabel: "σ_-1_notched, МПа",
  },
];

const UNDEPEND_MECH_PROPERTIES: UndependMechPropertiesConfig[] = [
  {
    key: "relative_elongation",
    legend: "Относительное удлинение(не менее)"
  },
  {
    key: "relative_contraction",
    legend: "Относительное сужение(не менее)",
  },
  {
    key: "angle_of_bend",
    legend: "Угол изгиба",
  },
];

type ChartPoint = { temperature: number; value: number };

function toChartData(pairs: Array<[number, number]> | undefined): ChartPoint[] {
  return (pairs ?? [])
    .filter(
      (pair): pair is [number, number] =>
        Array.isArray(pair) &&
        pair.length >= 2 &&
        Number.isFinite(pair[0]) &&
        Number.isFinite(pair[1]),
    )
    .map(([temperature, value]) => ({ temperature, value }));
}


function MechTemperatureGraph({
  prop,
  data,
  unitType,
}: {
  prop: MechPropertyConfig;
  data: PropertyData | undefined;
  unitType: string;
}) {
  const { labels } = useUnitLabels(unitType);

  return (
    <PropertyTemperatureLineChart
      data={toChartData(data?.temperature_value_pairs)}
      yLabel={yLabelWithUnit(prop.yLabel, data?.value_unit, labels)}
    />
  );
}

function getPropertyData(
  category: StrengthCategory | undefined,
  key: string,
): PropertyData | undefined {
  return findNamedProp(category, key);
}

function patchCategoryProperty(
  material: Record<string, unknown>,
  mechanical: MechanicalProperties,
  categoryIndex: number,
  propertyKey: string,
  patch: Partial<PropertyData>,
): Record<string, unknown> {
  const categories = mechanical.strength_category ?? [];

  return {
    ...material,
    mechanical_properties: {
      ...mechanical,
      strength_category: categories.map((cat, i) =>
        i !== categoryIndex
          ? cat
          : patchNamedPropertyInContainer(cat, propertyKey, patch),
      ),
    },
  };
}

export function MechanicalPropertiesTab({
  material,
  onDraftChange,
  readOnly = false,
}: MechanicalPropertiesTabProps) {
  const paneActive = useKeepAlivePaneActive();
  const result = useSourcesCatalog({ enabled: paneActive });
  const mechanicalSources = result.data?.strength_sources ?? [];
  const propertySources = result.data?.property_sources ?? [];
  const propertySourceNames = propertySources.map((src) => src.name_source);
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
  const currentSource = resolveCategorySourceName(category, mechanicalSources);
  const sourceNames = mechanicalSources.map((src) => src.name_source);
  const showOrphan =
    currentSource !== "" && !sourceNames.includes(currentSource);
  const [modulusSelectedRowIndex, setModulusSelectedRowIndex] = useState<
    number | null
  >(null);
  const hardnessTableRef = useRef<HTMLTableElement>(null);
  const scalarHardnessTableRef = useRef<HTMLTableElement>(null);
  useResizableTableHeaders(hardnessTableRef, { disabled: !paneActive });
  useResizableTableHeaders(scalarHardnessTableRef, { disabled: !paneActive });
  const propertiesCatalog = usePropertiesCatalog({ enabled: paneActive });
  const mechanicalUnitType = (key: string) =>
    propertiesCatalog.data?.mechanical[key]?.unit_type ?? "";

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
      <fieldset className="editor-readonly-scope" disabled={readOnly}>
      <div className="form-stack">
        <div className="form-row">
          <label htmlFor="editor-strength-category-select">Категория прочности:</label>
          <div className="form-row-inline">
          <select
            id="editor-strength-category-select"
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
                  {formatCategoryOptionLabel(cat, index, mechanicalSources)}
                </option>
              ),
            )}
      
          </select>
          {(mechanical_properties.strength_category?.length ?? 0) === 0 && (
            <p className="tab-placeholder tab-placeholder--inline">
              Нет категорий прочности — нажмите «+», чтобы добавить КП
            </p>
          )}
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
                properties: [],
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
              setCategoryIndex(0);
            }}
          >
            −
          </button>
        </div>
        </div>
      
        <fieldset className="form-section">
          <div className="property-section-fields kp-category-fields">
            <div className="form-row">
              <label htmlFor="name_strength_select" className="form-label--fixed">
                Название КП:
              </label>
              <input
                id="name_strength_select"
                type="text"
                value={
                  mechanical_properties?.strength_category?.[categoryIndex]
                    ?.value_strength_category ?? ""
                }
                className="input"
                onChange={(event) => {
                  const text = event.target.value;
                  onDraftChange({
                    ...material,
                    mechanical_properties: {
                      ...mechanical_properties,
                      strength_category:
                        mechanical_properties.strength_category?.map(
                          (cat, idx) =>
                            idx === categoryIndex
                              ? { ...cat, value_strength_category: text }
                              : cat,
                        ) ?? [{ value_strength_category: text }],
                    },
                  });
                }}
              />
            </div>
            <div className="form-row">
              <label htmlFor="source_strength_select" className="form-label--fixed">
                Источник КП
                <RequiredMark />:
              </label>
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
            <RequiredFieldsFootnote />
          </div>
        </fieldset>
        {TEMPERATURE_MECH_PROPERTIES.map((prop) => {
          const data = getPropertyData(category, prop.key);
          const unitId = `${prop.key}_value_unit`;
          const sourceId = `${prop.key}_property_subsource`;
          const commentId = `${prop.key}_comment`;
          const currentPropertySource = resolvePropertySourceName(
            data,
            propertySources,
          );
          const showPropertyOrphan = isOrphanSource(
            currentPropertySource,
            propertySourceNames,
          );

          return (
            <fieldset key={prop.key} className="form-section">
              <legend>
                <ScientificText>{prop.legend}</ScientificText>
              </legend>
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
                      unitType={mechanicalUnitType(prop.key)}
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
                    <PropertySourceSelect
                      id={sourceId}
                      value={currentPropertySource}
                      showOrphan={showPropertyOrphan}
                      sources={propertySources}
                      onChange={(name, sourceRefId) => {
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            {
                              property_subsource: name,
                              source_ref_id: sourceRefId,
                            },
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor={commentId}>Комментарий:</label>
                    <PropertyCommentField
                      id={commentId}
                      value={data?.comment ?? ""}
                      onChange={(text) => {
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            { comment: text },
                          ),
                        );
                      }}
                    />
                  </div>
                  <TemperatureValueTable
                    pairs={data?.temperature_value_pairs}
                    onChangeValue={(rowIndex, raw) => {
                      const nextValue = parsePairNumber(raw);
                      const prevPairs = data?.temperature_value_pairs ?? [];
                      onDraftChange(
                        patchCategoryProperty(
                          material,
                          mechanical_properties,
                          categoryIndex,
                          prop.key,
                          {
                            temperature_value_pairs: prevPairs.map((pair, i) =>
                              i !== rowIndex ? pair : [pair[0], nextValue],
                            ),
                          },
                        ),
                      );
                    }}
                    onChangeTemperature={(rowIndex, raw) => {
                      const nextTemperature = parsePairNumber(raw);
                      const prevPairs = data?.temperature_value_pairs ?? [];
                      onDraftChange(
                        patchCategoryProperty(
                          material,
                          mechanical_properties,
                          categoryIndex,
                          prop.key,
                          {
                            temperature_value_pairs: prevPairs.map((pair, i) =>
                              i !== rowIndex ? pair : [nextTemperature, pair[1]],
                            ),
                          },
                        ),
                      );
                    }}
                    selectedRowIndex={modulusSelectedRowIndex}
                    onRowSelect={setModulusSelectedRowIndex}
                    onAddRow={() => {
                      const prev = data?.temperature_value_pairs ?? [];
                      onDraftChange(
                        patchCategoryProperty(
                          material,
                          mechanical_properties,
                          categoryIndex,
                          prop.key,
                          { temperature_value_pairs: [...prev, [NaN, NaN]] },
                        ),
                      );
                      setModulusSelectedRowIndex(null);
                    }}
                    onDeleteRow={() => {
                      const prev = data?.temperature_value_pairs ?? [];
                      if (prev.length === 0) return;
                      if (
                        !window.confirm(
                          "Вы уверены, что хотите удалить эту пару?",
                        )
                      ) {
                        return;
                      }
                      const next = prev.filter(
                        (_, i) => i !== modulusSelectedRowIndex,
                      );
                      onDraftChange(
                        patchCategoryProperty(
                          material,
                          mechanical_properties,
                          categoryIndex,
                          prop.key,
                          { temperature_value_pairs: next },
                        ),
                      );
                      setModulusSelectedRowIndex(null);
                    }}
                  />
                </div>
                <div className="property-section-chart">
                  <MechTemperatureGraph prop={prop} data={data} unitType={mechanicalUnitType(prop.key)}/>
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
                  unitType={HARDNESS_UNIT_TYPE}
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
            <table ref={hardnessTableRef} className="data-table">
              <thead>
                <tr>
                  <th>Min</th>
                  <th>Max</th>
                </tr>
              </thead>
              <tbody>
                {hardnessRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="table-empty">
                      Нет данных о твердости
                    </td>
                  </tr>
                ) : (
                  hardnessRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.min_value ?? ""}</td>
                    <td>{row.max_value ?? ""}</td>
                  </tr>
                ))
                )}
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
          const currentPropertySource = resolvePropertySourceName(
            data,
            propertySources,
          );
          const showPropertyOrphan = isOrphanSource(
            currentPropertySource,
            propertySourceNames,
          );

          return (
            <fieldset key={prop.key} className="form-section">
              <legend>
                <ScientificText>{prop.legend}</ScientificText>
              </legend>
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
                      unitType={mechanicalUnitType(prop.key)}
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
                    <PropertySourceSelect
                      id={sourceId}
                      value={currentPropertySource}
                      showOrphan={showPropertyOrphan}
                      sources={propertySources}
                      onChange={(name, sourceRefId) => {
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            {
                              property_subsource: name,
                              source_ref_id: sourceRefId,
                            },
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor={commentId}>Комментарий:</label>
                    <PropertyCommentField
                      id={commentId}
                      value={data?.comment ?? ""}
                      onChange={(text) => {
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            { comment: text },
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor={value}>Значение:</label>
                    <input
                      id={value}
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
                            { min_value: raw === "" ? undefined : (parseDecimalInput(raw) ?? undefined) },
                          ),
                        );
                      }}
                    />
                  </div>
                  <div className="table-wrapper">
                    <table ref={scalarHardnessTableRef} className="data-table">
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
      </fieldset>
    </form>
  );
}


// алиас на случай старого имени экспорта
export { MechanicalPropertiesTab as MechaicalPropertiesTab };
