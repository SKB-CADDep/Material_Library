import { useState } from "react";
import { useSourcesCatalog } from "../hooks/useSourcesCatalog";
import { UnitSelect } from "./UnitSelect.tsx"
import {
  PropertySourceSelect,
  isOrphanSource,
  resolvePropertySourceName,
} from "./PropertySourceSelect.tsx";
import { yLabelWithUnit } from "./chartLabels.ts";
import { useUnitLabels } from "../hooks/useUnitLabels";
import { PropertyTemperatureLineChart } from "../components/PropertyTemperatureLineChart.tsx";
import { PropertyCommentField } from "../components/PropertyCommentField.tsx";
import { TemperatureValueTable } from "../components/TemperatureValueTable.tsx";

const PHYSICAL_Y_LABELS = {
  modulus_elasticity: "E, МПа",
  coefficient_linear_expansion: "α, ·10⁻⁶ 1/°C",
  coefficient_thermal_conductivity: "λ, Вт/(м·°C)",
  density: "ρ, кг/м³",
  specific_heat: "C, Дж/(кг·°C)",
} as const;

type PhysicalPropertiesTabProps = {
  material: Record<string, unknown> | undefined;
  onDraftChange: (next: Record<string, unknown>) => void;
  readOnly?: boolean;
};

type ChartPoint = { temperature: number; value: number };

function parsePairNumber(raw: string): number {
  if (raw === "" || raw === "-") return NaN;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toChartData(pairs: Array<[number, number]> | undefined): ChartPoint[] {
  return (pairs ?? [])
    .filter(([temperature, value]) =>
      Number.isFinite(temperature) && Number.isFinite(value),
    )
    .map(([temperature, value]) => ({ temperature, value }));
}

function PhysicalTemperatureGraph({
  unitType,
  yLabel,
  valueUnit,
  pairs,
}: {
  unitType: string;
  yLabel: string;
  valueUnit?: string;
  pairs?: Array<[number, number]>;
}) {
  const { labels } = useUnitLabels(unitType);

  return (
    <PropertyTemperatureLineChart
      data={toChartData(pairs)}
      yLabel={yLabelWithUnit(yLabel, valueUnit, labels)}
    />
  );
}

export function PhysicalPropertiesTab({
  material,
  onDraftChange,
  readOnly = false,
}: PhysicalPropertiesTabProps) {
  const result = useSourcesCatalog();
  const physicalSources = result.data?.property_sources ?? [];
  const [modulusSelectedRowIndex, setModulusSelectedRowIndex] = useState<
    number | null
  >(null);
  const [coefficientLinearSelectedRowIndex, setCoefficientLinearSelectedRowIndex] = useState<
    number | null
  >(null);
  const [coefficientThermalSelectedRowIndex, setcoefficientThermalSelectedRowIndex] = useState<
    number | null
  >(null);
  const [densitySelectedRowIndex, setDensitySelectedRowIndex] = useState<
    number | null
  >(null);
  const [specificHeatSelectedRowIndex, setSpecificHeatSelectedRowIndex] = useState<
    number | null
  >(null);


  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }

  const physical_properties = (material.physical_properties ?? {}) as {
    modulus_elasticity?: {
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
      property_subsource?: string | number | readonly string[];
      source_ref_id?: string | null;
    };
    coefficient_linear_expansion?: {
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
      property_subsource?: string | number | readonly string[];
      source_ref_id?: string | null;
    };
    coefficient_thermal_conductivity?: {
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
      property_subsource?: string | number | readonly string[];
      source_ref_id?: string | null;
    };
    density?: {
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
      property_subsource?: string | number | readonly string[];
      source_ref_id?: string | null;
    };
    specific_heat?: {
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
      property_subsource?: string | number | readonly string[];
      source_ref_id?: string | null;
    };
  };
  const currentModulusSource = resolvePropertySourceName(
    physical_properties.modulus_elasticity,
    physicalSources,
  );
  const currentCoefficientLinearSource = resolvePropertySourceName(
    physical_properties.coefficient_linear_expansion,
    physicalSources,
  );
  const currentCoefficientThermalSource = resolvePropertySourceName(
    physical_properties.coefficient_thermal_conductivity,
    physicalSources,
  );
  const currentDensitySource = resolvePropertySourceName(
    physical_properties.density,
    physicalSources,
  );
  const currentSpecificHeatSource = resolvePropertySourceName(
    physical_properties.specific_heat,
    physicalSources,
  );
  const sourceNames = physicalSources.map((src) => src.name_source);
  const showOrphanModulus = isOrphanSource(currentModulusSource, sourceNames);
  const showOrphanLinear = isOrphanSource(
    currentCoefficientLinearSource,
    sourceNames,
  );
  const showOrphanThermal = isOrphanSource(
    currentCoefficientThermalSource,
    sourceNames,
  );
  const showOrphanDensity = isOrphanSource(currentDensitySource, sourceNames);
  const showOrphanSpecificHeat = isOrphanSource(
    currentSpecificHeatSource,
    sourceNames,
  );

  return (
    <form
      className="general-form physical-properties-form"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="form-stack">
        <fieldset className="form-section" disabled={readOnly}>
          <legend>Модуль упругости (E)</legend>
          <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
                <label htmlFor="modulus_elasticity_value_unit">Ед. изм:</label>
                <UnitSelect
                  id="modulus_elasticity_value_unit"
                  unitType="Модуль упругости"
                  value={physical_properties.modulus_elasticity?.value_unit ?? ""}
                  onChange={(nextUnit) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                      ...physical_properties,
                      modulus_elasticity: {
                        ...physical_properties.modulus_elasticity,
                        value_unit: nextUnit,
                      },
                    },
                  });
                }}
              />
              </div>
              <div className="form-row">
                <label htmlFor="modulus_elasticity_property_subsource">
                  Источник свойств:
                </label>
                <PropertySourceSelect
                  id="modulus_elasticity_property_subsource"
                  value={currentModulusSource}
                  showOrphan={showOrphanModulus}
                  sources={physicalSources}
                  onChange={(name, sourceRefId) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        modulus_elasticity: {
                          ...physical_properties.modulus_elasticity,
                          property_subsource: name,
                          source_ref_id: sourceRefId,
                        },
                      },
                    });
                  }}
                />
              </div>
              <div className="form-row">
                <label htmlFor="modulus_elasticity_comment">Комментарий:</label>
                <PropertyCommentField
                  id="modulus_elasticity_comment"
                  value={physical_properties.modulus_elasticity?.comment ?? ""}
                  onChange={(text) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        modulus_elasticity: {
                          ...physical_properties.modulus_elasticity,
                          comment: text,
                        },
                      },
                    });
                  }}
                />
              </div>
              <TemperatureValueTable
                pairs={physical_properties.modulus_elasticity?.temperature_value_pairs}
                onChangeValue={(rowIndex, raw) => {
                  const nextValue = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.modulus_elasticity?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      modulus_elasticity: {
                        ...physical_properties.modulus_elasticity,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [pair[0], nextValue],
                        ),
                      },
                    },
                  });
                }}
                onChangeTemperature={(rowIndex, raw) => {
                  const nextTemperature = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.modulus_elasticity?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      modulus_elasticity: {
                        ...physical_properties.modulus_elasticity,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [nextTemperature, pair[1]],
                        ),
                      },
                    },
                  });
                }}
                selectedRowIndex={modulusSelectedRowIndex}
                onRowSelect={setModulusSelectedRowIndex}
                onAddRow={() => {
                  const prev =
                    physical_properties.modulus_elasticity?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      modulus_elasticity: {
                        ...physical_properties.modulus_elasticity,
                        temperature_value_pairs: [...prev, [NaN, NaN]],
                      },
                    },
                  });
                  setModulusSelectedRowIndex(null);
                }}
                onDeleteRow={() => {
                  const prev = physical_properties.modulus_elasticity?.temperature_value_pairs ?? [];
                  if (prev.length === 0) return;
                  if (
                    !window.confirm(
                      "Вы уверены, что хотите удалить эту пару?",
                    )
                  ) {
                    return;
                  }
                  const next = prev.filter((_, i) => i !== modulusSelectedRowIndex);
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      modulus_elasticity: {
                        ...physical_properties.modulus_elasticity,
                        temperature_value_pairs: next,
                      },
                    },
                  });
                  setModulusSelectedRowIndex(null);
                }}
              />
            </div>
            <div className="property-section-chart">
              <PhysicalTemperatureGraph
                unitType="Модуль упругости"
                yLabel={PHYSICAL_Y_LABELS.modulus_elasticity}
                valueUnit={physical_properties.modulus_elasticity?.value_unit}
                pairs={physical_properties.modulus_elasticity?.temperature_value_pairs}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section" disabled={readOnly}>
          <legend>Коэффициент линейного расширения (·10⁻⁶)(α)</legend>
          <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
                <label htmlFor="coefficient_linear_expansion_value_unit">Ед. изм:</label>
                <UnitSelect
                  id="coefficient_linear_expansion_value_unit"
                  unitType="Коэффициент линейного расширения"
                  value={physical_properties.coefficient_linear_expansion?.value_unit ?? ""}
                  onChange={(nextUnit) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                      ...physical_properties,
                      coefficient_linear_expansion: {
                        ...physical_properties.coefficient_linear_expansion,
                        value_unit: nextUnit,
                      },
                    },
                  });
                }}
              />
              </div>
              <div className="form-row">
                <label htmlFor="coefficient_linear_expansion_property_subsource">
                  Источник свойств:
                </label>
                <PropertySourceSelect
                  id="coefficient_linear_expansion_property_subsource"
                  value={currentCoefficientLinearSource}
                  showOrphan={showOrphanLinear}
                  sources={physicalSources}
                  onChange={(name, sourceRefId) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        coefficient_linear_expansion: {
                          ...physical_properties.coefficient_linear_expansion,
                          property_subsource: name,
                          source_ref_id: sourceRefId,
                        },
                      },
                    });
                  }}
                />
              </div>
              <div className="form-row">
                <label htmlFor="coefficient_linear_expansion_comment">Комментарий:</label>
                <PropertyCommentField
                  id="coefficient_linear_expansion_comment"
                  value={physical_properties.coefficient_linear_expansion?.comment ?? ""}
                  onChange={(text) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        coefficient_linear_expansion: {
                          ...physical_properties.coefficient_linear_expansion,
                          comment: text,
                        },
                      },
                    });
                  }}
                />
              </div>
              <TemperatureValueTable
                pairs={
                  physical_properties.coefficient_linear_expansion?.temperature_value_pairs
                }
                onChangeValue={(rowIndex, raw) => {
                  const nextValue = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.coefficient_linear_expansion?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      coefficient_linear_expansion: {
                        ...physical_properties.coefficient_linear_expansion,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [pair[0], nextValue],
                        ),
                      },
                    },
                  });
                }}
                onChangeTemperature={(rowIndex, raw) => {
                  const nextTemperature = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.coefficient_linear_expansion?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      coefficient_linear_expansion: {
                        ...physical_properties.coefficient_linear_expansion,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [nextTemperature, pair[1]],
                        ),
                      },
                    },
                  });
                }}
                selectedRowIndex={coefficientLinearSelectedRowIndex}
                onRowSelect={setCoefficientLinearSelectedRowIndex}
                onAddRow={() => {
                  const prev =
                    physical_properties.coefficient_linear_expansion?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      coefficient_linear_expansion: {
                        ...physical_properties.coefficient_linear_expansion,
                        temperature_value_pairs: [...prev, [NaN, NaN]],
                      },
                    },
                  });
                  setCoefficientLinearSelectedRowIndex(null);
                }}
                onDeleteRow={() => {
                  const prev = physical_properties.coefficient_linear_expansion?.temperature_value_pairs ?? [];
                  if (prev.length === 0) return;
                  if (
                    !window.confirm(
                      "Вы уверены, что хотите удалить эту пару?",
                    )
                  ) {
                    return;
                  }
                  const next = prev.filter((_, i) => i !== coefficientLinearSelectedRowIndex);
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      coefficient_linear_expansion: {
                        ...physical_properties.coefficient_linear_expansion,
                        temperature_value_pairs: next,
                      },
                    },
                  });
                  setCoefficientLinearSelectedRowIndex(null);
                }}
              />
            </div>
            <div className="property-section-chart">
              <PhysicalTemperatureGraph
                unitType="Коэффициент линейного расширения"
                yLabel={PHYSICAL_Y_LABELS.coefficient_linear_expansion}
                valueUnit={
                  physical_properties.coefficient_linear_expansion?.value_unit
                }
                pairs={
                  physical_properties.coefficient_linear_expansion
                    ?.temperature_value_pairs
                }
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section" disabled={readOnly}>
          <legend>Коэффициент теплопроводности (λ)</legend>
          <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
                <label htmlFor="coefficient_thermal_conductivity_value_unit">
                  Ед. изм:
                </label>
                <UnitSelect
                  id="coefficient_thermal_conductivity_value_unit"
                  unitType="Теплопроводность"
                  value={physical_properties.coefficient_thermal_conductivity?.value_unit ?? ""}
                  onChange={(nextUnit) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                      ...physical_properties,
                      coefficient_thermal_conductivity: {
                        ...physical_properties.coefficient_thermal_conductivity,
                        value_unit: nextUnit,
                      },
                    },
                  });
                }}
              />
              </div>
              <div className="form-row">
                <label htmlFor="coefficient_thermal_conductivity_property_subsource">
                  Источник свойств:
                </label>
                <PropertySourceSelect
                  id="coefficient_thermal_conductivity_property_subsource"
                  value={currentCoefficientThermalSource}
                  showOrphan={showOrphanThermal}
                  sources={physicalSources}
                  onChange={(name, sourceRefId) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        coefficient_thermal_conductivity: {
                          ...physical_properties.coefficient_thermal_conductivity,
                          property_subsource: name,
                          source_ref_id: sourceRefId,
                        },
                      },
                    });
                  }}
                />
              </div>
              <div className="form-row">
                <label htmlFor="coefficient_thermal_conductivity_comment">
                  Комментарий:
                </label>
                <PropertyCommentField
                  id="coefficient_thermal_conductivity_comment"
                  value={
                    physical_properties.coefficient_thermal_conductivity?.comment ?? ""
                  }
                  onChange={(text) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        coefficient_thermal_conductivity: {
                          ...physical_properties.coefficient_thermal_conductivity,
                          comment: text,
                        },
                      },
                    });
                  }}
                />
              </div>
              <TemperatureValueTable
                pairs={
                  physical_properties.coefficient_thermal_conductivity
                    ?.temperature_value_pairs
                }
                onChangeValue={(rowIndex, raw) => {
                  const nextValue = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.coefficient_thermal_conductivity?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      coefficient_thermal_conductivity: {
                        ...physical_properties.coefficient_thermal_conductivity,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [pair[0], nextValue],
                        ),
                      },
                    },
                  });
                }}
                onChangeTemperature={(rowIndex, raw) => {
                  const nextTemperature = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.coefficient_thermal_conductivity?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      coefficient_thermal_conductivity: {
                        ...physical_properties.coefficient_thermal_conductivity,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [nextTemperature, pair[1]],
                        ),
                      },
                    },
                  });
                }}
                selectedRowIndex={coefficientThermalSelectedRowIndex}
                onRowSelect={setcoefficientThermalSelectedRowIndex}
                onAddRow={() => {
                  const prev =
                    physical_properties.coefficient_thermal_conductivity?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      coefficient_thermal_conductivity: {
                        ...physical_properties.coefficient_thermal_conductivity,
                        temperature_value_pairs: [...prev, [NaN, NaN]],
                      },
                    },
                  });
                  setcoefficientThermalSelectedRowIndex(null);
                }}
                onDeleteRow={() => {
                  const prev = physical_properties.coefficient_thermal_conductivity?.temperature_value_pairs ?? [];
                  if (prev.length === 0) return;
                  if (
                    !window.confirm(
                      "Вы уверены, что хотите удалить эту пару?",
                    )
                  ) {
                    return;
                  }
                  const next = prev.filter((_, i) => i !== coefficientLinearSelectedRowIndex);
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      coefficient_thermal_conductivity: {
                        ...physical_properties.coefficient_thermal_conductivity,
                        temperature_value_pairs: next,
                      },
                    },
                  });
                  setcoefficientThermalSelectedRowIndex(null);
                }}
              />
            </div>
            <div className="property-section-chart">
              <PhysicalTemperatureGraph
                unitType="Теплопроводность"
                yLabel={PHYSICAL_Y_LABELS.coefficient_thermal_conductivity}
                valueUnit={
                  physical_properties.coefficient_thermal_conductivity?.value_unit
                }
                pairs={
                  physical_properties.coefficient_thermal_conductivity
                    ?.temperature_value_pairs
                }
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section" disabled={readOnly}>
          <legend>Плотность (ρ)</legend>
          <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
                <label htmlFor="density_value_unit">Ед. изм:</label>
                <UnitSelect
                  id="density_value_unit"
                  unitType="Плотность"
                  value={physical_properties.density?.value_unit ?? ""}
                  onChange={(nextUnit) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                      ...physical_properties,
                      density: {
                        ...physical_properties.density,
                        value_unit: nextUnit,
                      },
                    },
                  });
                }}
              />
              </div>
              <div className="form-row">
                <label htmlFor="density_property_subsource">Источник свойств:</label>
                <PropertySourceSelect
                  id="density_property_subsource"
                  value={currentDensitySource}
                  showOrphan={showOrphanDensity}
                  sources={physicalSources}
                  onChange={(name, sourceRefId) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        density: {
                          ...physical_properties.density,
                          property_subsource: name,
                          source_ref_id: sourceRefId,
                        },
                      },
                    });
                  }}
                />
              </div>
              <div className="form-row">
                <label htmlFor="density_comment">Комментарий:</label>
                <PropertyCommentField
                  id="density_comment"
                  value={physical_properties.density?.comment ?? ""}
                  onChange={(text) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        density: {
                          ...physical_properties.density,
                          comment: text,
                        },
                      },
                    });
                  }}
                />
              </div>
              <TemperatureValueTable
                pairs={physical_properties.density?.temperature_value_pairs}
                onChangeValue={(rowIndex, raw) => {
                  const nextValue = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.density?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      density: {
                        ...physical_properties.density,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [pair[0], nextValue],
                        ),
                      },
                    },
                  });
                }}
                onChangeTemperature={(rowIndex, raw) => {
                  const nextTemperature = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.density?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      density: {
                        ...physical_properties.density,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [nextTemperature, pair[1]],
                        ),
                      },
                    },
                  });
                }}
                selectedRowIndex={densitySelectedRowIndex}
                onRowSelect={setDensitySelectedRowIndex}
                onAddRow={() => {
                  const prev =
                    physical_properties.density?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      density: {
                        ...physical_properties.density,
                        temperature_value_pairs: [...prev, [NaN, NaN]],
                      },
                    },
                  });
                  setDensitySelectedRowIndex(null);
                }}
                onDeleteRow={() => {
                  const prev = physical_properties.density?.temperature_value_pairs ?? [];
                  if (prev.length === 0) return;
                  if (
                    !window.confirm(
                      "Вы уверены, что хотите удалить эту пару?",
                    )
                  ) {
                    return;
                  }
                  const next = prev.filter((_, i) => i !== densitySelectedRowIndex);
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      density: {
                        ...physical_properties.density,
                        temperature_value_pairs: next,
                      },
                    },
                  });
                  setDensitySelectedRowIndex(null);
                }}
              />
            </div>
            <div className="property-section-chart">
              <PhysicalTemperatureGraph
                unitType="Плотность"
                yLabel={PHYSICAL_Y_LABELS.density}
                valueUnit={physical_properties.density?.value_unit}
                pairs={physical_properties.density?.temperature_value_pairs}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section" disabled={readOnly}>
          <legend>Удельная теплоёмкость (C)</legend>
          <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
                <label htmlFor="specific_heat_value_unit">Ед. изм:</label>
                <UnitSelect
                  id="specific_heat_value_unit"
                  unitType="Удельная теплоемкость"
                  value={physical_properties.specific_heat?.value_unit ?? ""}
                  onChange={(nextUnit) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                      ...physical_properties,
                      specific_heat: {
                        ...physical_properties.specific_heat,
                        value_unit: nextUnit,
                      },
                    },
                  });
                }}
              />
              </div>
              <div className="form-row">
                <label htmlFor="specific_heat_property_subsource">
                  Источник свойств:
                </label>
                <PropertySourceSelect
                  id="specific_heat_property_subsource"
                  value={currentSpecificHeatSource}
                  showOrphan={showOrphanSpecificHeat}
                  sources={physicalSources}
                  onChange={(name, sourceRefId) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        specific_heat: {
                          ...physical_properties.specific_heat,
                          property_subsource: name,
                          source_ref_id: sourceRefId,
                        },
                      },
                    });
                  }}
                />
              </div>
              <div className="form-row">
                <label htmlFor="specific_heat_comment">Комментарий:</label>
                <PropertyCommentField
                  id="specific_heat_comment"
                  value={physical_properties.specific_heat?.comment ?? ""}
                  onChange={(text) => {
                    onDraftChange({
                      ...material,
                      physical_properties: {
                        ...physical_properties,
                        specific_heat: {
                          ...physical_properties.specific_heat,
                          comment: text,
                        },
                      },
                    });
                  }}
                />
              </div>
              <TemperatureValueTable
                pairs={physical_properties.specific_heat?.temperature_value_pairs}
                onChangeValue={(rowIndex, raw) => {
                  const nextValue = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.specific_heat?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      specific_heat: {
                        ...physical_properties.specific_heat,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [pair[0], nextValue],
                        ),
                      },
                    },
                  });
                }}
                onChangeTemperature={(rowIndex, raw) => {
                  const nextTemperature = parsePairNumber(raw);
                  const prevPairs =
                    physical_properties.specific_heat?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      specific_heat: {
                        ...physical_properties.specific_heat,
                        temperature_value_pairs: prevPairs.map((pair, i) =>
                          i !== rowIndex ? pair : [nextTemperature, pair[1]],
                        ),
                      },
                    },
                  });
                }}
                selectedRowIndex={specificHeatSelectedRowIndex}
                onRowSelect={setSpecificHeatSelectedRowIndex}
                onAddRow={() => {
                  const prev =
                    physical_properties.specific_heat?.temperature_value_pairs ??
                    [];
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      specific_heat: {
                        ...physical_properties.specific_heat,
                        temperature_value_pairs: [...prev, [NaN, NaN]],
                      },
                    },
                  });
                  setSpecificHeatSelectedRowIndex(null);
                }}
                onDeleteRow={() => {
                  const prev = physical_properties.specific_heat?.temperature_value_pairs ?? [];
                  if (prev.length === 0) return;
                  if (
                    !window.confirm(
                      "Вы уверены, что хотите удалить эту пару?",
                    )
                  ) {
                    return;
                  }
                  const next = prev.filter((_, i) => i !== specificHeatSelectedRowIndex);
                  onDraftChange({
                    ...material,
                    physical_properties: {
                      ...physical_properties,
                      specific_heat: {
                        ...physical_properties.specific_heat,
                        temperature_value_pairs: next,
                      },
                    },
                  });
                  setSpecificHeatSelectedRowIndex(null);
                }}
              />
            </div>
            <div className="property-section-chart">
              <PhysicalTemperatureGraph
                unitType="Удельная теплоемкость"
                yLabel={PHYSICAL_Y_LABELS.specific_heat}
                valueUnit={physical_properties.specific_heat?.value_unit}
                pairs={physical_properties.specific_heat?.temperature_value_pairs}
              />
            </div>
          </div>
        </fieldset>
      </div>
    </form>
  );
}
