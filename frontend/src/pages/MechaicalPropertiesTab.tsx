import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
import { BlurCommitTextInput } from "../components/BlurCommitTextInput";
import {
  parseDecimalFieldInput,
  parseDecimalInput,
} from "../lib/formatDecimal";
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
    legend: "Предел выносливости (σ_{-1 гладкий, N=10e7})",
    yLabel: "σ_{-1 гладкий, N=10e7}, МПа",
  },
  {
    key: "fatigue_limit_for_notched_specimen",
    legend: "Предел выносливости (σ_{-1 с надрезом, N=10e7})",
    yLabel: "σ_{-1 с надрезом, N=10e7}, МПа",
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


const MechTemperatureGraph = memo(function MechTemperatureGraph({
  prop,
  data,
  unitType,
  enabled,
}: {
  prop: MechPropertyConfig;
  data: PropertyData | undefined;
  unitType: string;
  enabled: boolean;
}) {
  const { labels } = useUnitLabels(unitType);
  const pairs = data?.temperature_value_pairs;
  const chartData = useMemo(() => toChartData(pairs), [pairs]);
  const yLabel = yLabelWithUnit(prop.yLabel, data?.value_unit, labels);

  if (!enabled) {
    return <div className="property-chart-plot" aria-hidden="true" />;
  }

  return (
    <PropertyTemperatureLineChart
      data={chartData}
      yLabel={yLabel}
    />
  );
});

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

export const MechanicalPropertiesTab = memo(function MechanicalPropertiesTab({
  material,
  onDraftChange,
  readOnly = false,
}: MechanicalPropertiesTabProps) {
  const paneActive = useKeepAlivePaneActive();
  // Графики — низкий приоритет: сначала фокус/ввод, потом Recharts.
  const chartsEnabled = useDeferredValue(paneActive);
  const deferredMaterial = useDeferredValue(material);
  const result = useSourcesCatalog({ enabled: paneActive });
  const mechanicalSources = result.data?.strength_sources ?? [];
  const propertySources = result.data?.property_sources ?? [];
  const propertySourceNames = propertySources.map((src) => src.name_source);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [modulusSelectedRowIndex, setModulusSelectedRowIndex] = useState<
    number | null
  >(null);
  const [hardnessSelectedRowIndex, setHardnessSelectedRowIndex] = useState<
    number | null
  >(null);

  const materialKey =
    typeof material?.material_id === "string" && material.material_id.trim()
      ? material.material_id
      : null;

  const mechanical_properties = (material?.mechanical_properties ??
    {}) as MechanicalProperties;
  const strengthCategories = mechanical_properties.strength_category ?? [];

  useEffect(() => {
    setCategoryIndex(0);
    setModulusSelectedRowIndex(null);
    setHardnessSelectedRowIndex(null);
  }, [materialKey]);

  useEffect(() => {
    setCategoryIndex((index) => {
      if (strengthCategories.length === 0) {
        return 0;
      }
      return Math.min(index, strengthCategories.length - 1);
    });
  }, [strengthCategories.length]);

  const category = strengthCategories[categoryIndex];
  const deferredMechanical = (deferredMaterial?.mechanical_properties ??
    {}) as MechanicalProperties;
  const deferredCategory =
    deferredMechanical.strength_category?.[categoryIndex];
  const currentSource = resolveCategorySourceName(category, mechanicalSources);
  const sourceNames = mechanicalSources.map((src) => src.name_source);
  const showOrphan =
    currentSource !== "" && !sourceNames.includes(currentSource);
  const hardnessTableRef = useRef<HTMLTableElement>(null);
  useResizableTableHeaders(hardnessTableRef, { disabled: !paneActive });
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
          min_value?: number | string;
          max_value?: number | string;
        }>
      | undefined) ?? [];

  const hardnessUnit =
    (category?.hardness_unit as string | undefined) ??
    hardnessRows[0]?.unit_value ??
    "";

  const updateHardnessRows = (
    updater: (
      rows: Array<{
        unit_value?: string;
        min_value?: number | string;
        max_value?: number | string;
      }>,
    ) => Array<{
      unit_value?: string;
      min_value?: number | string;
      max_value?: number | string;
    }>,
  ) => {
    const categories = mechanical_properties.strength_category ?? [];
    onDraftChange({
      ...material,
      mechanical_properties: {
        ...mechanical_properties,
        strength_category: categories.map((cat, i) => {
          if (i !== categoryIndex) return cat;
          const rows =
            (cat.hardness as typeof hardnessRows | undefined) ?? [];
          const nextRows = updater(rows);
          return {
            ...cat,
            hardness: nextRows,
            hardness_unit:
              (cat.hardness_unit as string | undefined) ||
              nextRows[0]?.unit_value ||
              hardnessUnit ||
              "",
          };
        }),
      },
    });
  };

  const updateHardnessAt = (
    rowIndex: number,
    patch: {
      min_value?: number | string;
      max_value?: number | string;
    },
  ) => {
    updateHardnessRows((rows) =>
      rows.map((row, i) => (i === rowIndex ? { ...row, ...patch } : row)),
    );
  };
  return (
    <form
      className="general-form physical-properties-form"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="form-stack">
        <div className="mech-kp-sticky">
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
                onChange={(e) => {
                  setCategoryIndex(Number(e.target.value));
                  setModulusSelectedRowIndex(null);
                  setHardnessSelectedRowIndex(null);
                }}
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
                disabled={readOnly}
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
                disabled={
                  readOnly ||
                  (mechanical_properties.strength_category?.length ?? 0) === 0
                }
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

          <fieldset className="editor-readonly-scope" disabled={readOnly}>
            <fieldset className="form-section mech-kp-sticky__meta">
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
          </fieldset>
        </div>

      <fieldset className="editor-readonly-scope" disabled={readOnly}>
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
              <div className="property-section-layout">
                <div className="property-section-fields">
                  <div className="form-row form-row--unit form-row--unit-with-acceptance">
                    <label htmlFor={unitId}>Ед.изм.</label>
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
                    {prop.hasAcceptance ? (
                      <label
                        htmlFor={`${prop.key}_is_acceptance`}
                        className="checkbox-item checkbox-item--inline"
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
                        сдат. хар-ка
                      </label>
                    ) : null}
                  </div>
                  <div className="form-row form-row--stack">
                    <label htmlFor={sourceId}>Источник:</label>
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
                  <div className="form-row form-row--stack">
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
                  <MechTemperatureGraph
                    prop={prop}
                    data={getPropertyData(deferredCategory, prop.key)}
                    unitType={mechanicalUnitType(prop.key)}
                    enabled={chartsEnabled}
                  />
                </div>
              </div>
            </fieldset>
          );
        })}

        <fieldset className="form-section hardness-card">
          <legend>Твёрдость</legend>
          <div className="hardness-card__row">
            <div className="hardness-card__unit">
              <label htmlFor="hardness_value_unit" className="hardness-card__unit-label">
                Ед.изм
              </label>
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
                        const nextRows =
                          rows.length === 0
                            ? [{ unit_value: nextUnit }]
                            : rows.map((row) => ({
                                ...row,
                                unit_value: nextUnit,
                              }));
                        return {
                          ...cat,
                          hardness_unit: nextUnit,
                          hardness: nextRows,
                        };
                      }),
                    },
                  });
                }}
              />
            </div>
            <label
              htmlFor="hardness_is_acceptance"
              className="hardness-card__acceptance"
            >
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
              />
              <span className="hardness-card__acceptance-text">сдат. хар-ка</span>
            </label>
            <div className="hardness-card__bounds-group">
              <div className="hardness-card__table-wrap table-wrapper">
                <table
                  ref={hardnessTableRef}
                  className="data-table data-table--selectable-rows hardness-card__table"
                >
                  <thead>
                    <tr>
                      <th>max</th>
                      <th>min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(hardnessRows.length === 0
                      ? [
                          {
                            unit_value: hardnessUnit || "HB",
                            min_value: undefined as number | undefined,
                            max_value: undefined as number | undefined,
                          },
                        ]
                      : hardnessRows
                    ).map((row, i) => {
                      const isPlaceholder = hardnessRows.length === 0;
                      return (
                        <tr
                          key={isPlaceholder ? "hardness-placeholder" : i}
                          className={
                            !isPlaceholder && hardnessSelectedRowIndex === i
                              ? "table-row-selected"
                              : ""
                          }
                          onClick={() => {
                            if (!isPlaceholder) setHardnessSelectedRowIndex(i);
                          }}
                        >
                          <td>
                            <BlurCommitTextInput
                              className="table-cell-input"
                              type="text"
                              inputMode="decimal"
                              placeholder="—"
                              value={
                                row.max_value === undefined ||
                                row.max_value === null
                                  ? ""
                                  : String(row.max_value)
                              }
                              commitWhenUnchanged={false}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              onCommit={(raw) => {
                                const max_value = parseDecimalFieldInput(raw);
                                if (max_value === null) return;
                                if (isPlaceholder) {
                                  updateHardnessRows(() => [
                                    {
                                      unit_value: hardnessUnit || "HB",
                                      min_value: undefined,
                                      max_value,
                                    },
                                  ]);
                                  setHardnessSelectedRowIndex(0);
                                  return;
                                }
                                updateHardnessAt(i, { max_value });
                              }}
                            />
                          </td>
                          <td>
                            <BlurCommitTextInput
                              className="table-cell-input"
                              type="text"
                              inputMode="decimal"
                              placeholder="—"
                              value={
                                row.min_value === undefined ||
                                row.min_value === null
                                  ? ""
                                  : String(row.min_value)
                              }
                              commitWhenUnchanged={false}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              onCommit={(raw) => {
                                const min_value = parseDecimalFieldInput(raw);
                                if (min_value === null) return;
                                if (isPlaceholder) {
                                  updateHardnessRows(() => [
                                    {
                                      unit_value: hardnessUnit || "HB",
                                      min_value,
                                      max_value: undefined,
                                    },
                                  ]);
                                  setHardnessSelectedRowIndex(0);
                                  return;
                                }
                                updateHardnessAt(i, { min_value });
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="hardness-card__controls table-controls">
                <button
                  type="button"
                  className="table-control-btn"
                  title="Добавить строку твёрдости"
                  onClick={() => {
                    updateHardnessRows((rows) => [
                      ...rows,
                      {
                        unit_value: hardnessUnit || "HB",
                        min_value: undefined,
                        max_value: undefined,
                      },
                    ]);
                    setHardnessSelectedRowIndex(hardnessRows.length);
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  className="table-control-btn"
                  title={
                    hardnessRows.length === 0 || hardnessSelectedRowIndex === null
                      ? "Сначала выберите строку"
                      : "Удалить выбранную строку"
                  }
                  disabled={
                    hardnessRows.length === 0 || hardnessSelectedRowIndex === null
                  }
                  onClick={() => {
                    if (
                      hardnessRows.length === 0 ||
                      hardnessSelectedRowIndex === null
                    ) {
                      return;
                    }
                    const removeIndex = hardnessSelectedRowIndex;
                    updateHardnessRows((rows) =>
                      rows.filter((_, i) => i !== removeIndex),
                    );
                    setHardnessSelectedRowIndex((prev) => {
                      if (prev === null) return null;
                      if (hardnessRows.length <= 1) return null;
                      return Math.max(
                        0,
                        Math.min(prev, hardnessRows.length - 2),
                      );
                    });
                  }}
                >
                  −
                </button>
              </div>
            </div>
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
            <fieldset key={prop.key} className="form-section scalar-mech-card">
              <legend>
                <ScientificText>{prop.legend}</ScientificText>
              </legend>
              <div className="scalar-mech-card__body">
                <div className="scalar-mech-card__top">
                  <div className="scalar-mech-card__unit">
                    <label htmlFor={unitId} className="scalar-mech-card__unit-label">
                      Ед.изм
                    </label>
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
                  <label
                    htmlFor={`${prop.key}_is_acceptance`}
                    className="scalar-mech-card__acceptance"
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
                    />
                    <span>сдат. хар-ка</span>
                  </label>
                  <label className="scalar-mech-card__value" htmlFor={value}>
                    <span>Значение:</span>
                    <BlurCommitTextInput
                      id={value}
                      value={
                        data?.min_value === undefined || data?.min_value === null
                          ? ""
                          : String(data.min_value)
                      }
                      className="input scalar-mech-card__value-input"
                      inputMode="decimal"
                      commitWhenUnchanged={false}
                      onCommit={(raw) => {
                        const trimmed = raw.trim();
                        if (!trimmed) {
                          onDraftChange(
                            patchCategoryProperty(
                              material,
                              mechanical_properties,
                              categoryIndex,
                              prop.key,
                              { min_value: undefined },
                            ),
                          );
                          return;
                        }
                        const parsed = parseDecimalFieldInput(raw);
                        // Нечисловой ввод оставляем в draft — save покажет предупреждение.
                        const min_value =
                          parsed === null ? trimmed : parsed;
                        onDraftChange(
                          patchCategoryProperty(
                            material,
                            mechanical_properties,
                            categoryIndex,
                            prop.key,
                            { min_value },
                          ),
                        );
                      }}
                    />
                  </label>
                </div>
                <div className="form-row form-row--stack">
                  <label htmlFor={sourceId}>Источник:</label>
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
                <div className="form-row form-row--stack">
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
              </div>
            </fieldset>
          );
        })}
      </fieldset>
      </div>
    </form>
  );
});


// алиас на случай старого имени экспорта
export { MechanicalPropertiesTab as MechaicalPropertiesTab };
