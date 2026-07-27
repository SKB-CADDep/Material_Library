import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSources } from "../api/sources";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { UnitSelect } from "./UnitSelect.tsx"
import {
  PropertySourceSelect,
  isOrphanSource,
  resolvePropertySourceName,
} from "./PropertySourceSelect.tsx";
import { chartValueLabel, yLabelWithUnit } from "./chartLabels.ts";

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
};

type ChartPoint = { temperature: number; value: number };

/** Пустая строка в input → NaN в draft (можно стереть поле backspace). */
function parsePairNumber(raw: string): number {
  if (raw === "" || raw === "-") return NaN;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatPairNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function toChartData(pairs: Array<[number, number]> | undefined): ChartPoint[] {
  return (pairs ?? [])
    .filter(([temperature, value]) =>
      Number.isFinite(temperature) && Number.isFinite(value),
    )
    .map(([temperature, value]) => ({ temperature, value }));
}

type TemperatureGraphProps = {
  data: ChartPoint[];
  yLabel?: string;
};

function TemperatureGraph({ data, yLabel = "Значение" }: TemperatureGraphProps) {
  if (data.length === 0) {
    return <p className="tab-placeholder">Нет данных для графика</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 24 }}>
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
          formatter={(value) => [value, chartValueLabel(yLabel)]}
          labelFormatter={(label) => `Температура: ${label} °C`}
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

type TemperatureValueTableProps = {
  pairs: Array<[number, number]> | undefined;
  onChangeValue?: (rowIndex: number, raw: string) => void;
  onChangeTemperature?: (rowIndex: number, raw: string) => void;
  selectedRowIndex?: number | null;
  onRowSelect?: (index: number) => void;
  onAddRow?: () => void;
  onDeleteRow?: () => void;
};

function TemperatureValueTable({
  pairs,
  onChangeValue,
  onChangeTemperature,
  selectedRowIndex,
  onRowSelect,
  onAddRow,
  onDeleteRow
}: TemperatureValueTableProps) {
  const isRowSelectionEnabled = Boolean(onRowSelect);

  return (
    <div className="table-wrapper">
      <div className="data-table-container">
        <table
          className={
            isRowSelectionEnabled
              ? "data-table data-table--selectable-rows"
              : "data-table"
          }
        >
          <thead>
            <tr>
              <th>T, °C</th>
              <th>Значение</th>
            </tr>
          </thead>
          <tbody>
            {(pairs ?? []).length === 0 ? (
              <tr>
                <td colSpan={2} className="table-empty">
                  Нет точек — нажмите «+», чтобы добавить пару T–значение
                </td>
              </tr>
            ) : (
              (pairs ?? []).map(([temperature, value], index) => (
              <tr
                key={index}
                className={
                  selectedRowIndex === index ? "table-row-selected" : ""
                }
              >
                <td
                  className={isRowSelectionEnabled ? "data-table-select-cell" : undefined}
                  onClick={
                    isRowSelectionEnabled
                      ? () => onRowSelect?.(index)
                      : undefined
                  }
                >
                  <input
                    type="number"
                    readOnly={!onChangeTemperature}
                    value={formatPairNumber(temperature)}
                    onChange={
                      onChangeTemperature
                        ? (e) => onChangeTemperature(index, e.target.value)
                        : undefined
                    }
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="table-cell-input"
                  />
                </td>
                <td
                  className={isRowSelectionEnabled ? "data-table-select-cell" : undefined}
                  onClick={
                    isRowSelectionEnabled
                      ? () => onRowSelect?.(index)
                      : undefined
                  }
                >
                  <input
                    type="number"
                    readOnly={!onChangeValue}
                    onChange={
                      onChangeValue
                        ? (e) => onChangeValue(index, e.target.value)
                        : undefined
                    }
                    value={formatPairNumber(value)}
                    className="table-cell-input"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
      <div className="table-controls">
        <button
          type="button"
          className="table-control-btn"
          title="Добавить пару"
          onClick={() => onAddRow?.()}
          disabled={!onAddRow}
        >
          +
        </button>
        <button
          type="button"
          className="table-control-btn"
          title={
            selectedRowIndex == null
              ? "Сначала выберите строку"
              : "Удалить пару"
          }
          disabled={selectedRowIndex == null || !onDeleteRow}
          onClick={() => onDeleteRow?.()}
        >
          −
        </button>
      </div>
    </div>
  );
}

export function PhysicalPropertiesTab({ material, onDraftChange }: PhysicalPropertiesTabProps) {
  const result = useQuery({
    queryKey: ["sources"],
    queryFn: getSources,
  });
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

  const physical_properties = material.physical_properties as {
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
        <fieldset className="form-section">
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
                <input
                  id="modulus_elasticity_comment"
                  type="text"
                  value={physical_properties.modulus_elasticity?.comment ?? ""}
                  className="input"
                  onChange={(event) => {
                    const text = event.target.value;
                    onDraftChange({
                      ...material,
                      physical_properties: { ...physical_properties, modulus_elasticity:{...physical_properties.modulus_elasticity, comment: text }
                    },});}}
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
              <TemperatureGraph
                data={toChartData(
                  physical_properties.modulus_elasticity?.temperature_value_pairs,
                )}
                yLabel={yLabelWithUnit(
                  PHYSICAL_Y_LABELS.modulus_elasticity,
                  physical_properties.modulus_elasticity?.value_unit,
                )}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section">
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
                <input
                  id="coefficient_linear_expansion_comment"
                  type="text"
                  value={physical_properties.coefficient_linear_expansion?.comment ?? ""}
                  className="input"
                  onChange={(event) => {
                    const text = event.target.value;
                    onDraftChange({
                      ...material,
                      physical_properties: { ...physical_properties, coefficient_linear_expansion:{...physical_properties.coefficient_linear_expansion, comment: text }
                    },});
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
              <TemperatureGraph
                data={toChartData(
                  physical_properties.coefficient_linear_expansion?.temperature_value_pairs,
                )}
                yLabel={yLabelWithUnit(
                  PHYSICAL_Y_LABELS.coefficient_linear_expansion,
                  physical_properties.coefficient_linear_expansion?.value_unit,
                )}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section">
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
                <input
                  id="coefficient_thermal_conductivity_comment"
                  type="text"
                  value={
                    physical_properties.coefficient_thermal_conductivity?.comment ?? ""
                  }
                  className="input"
                  onChange={(event) => {
                    const text = event.target.value;
                    onDraftChange({
                      ...material,
                      physical_properties: { ...physical_properties, coefficient_thermal_conductivity:{...physical_properties.coefficient_thermal_conductivity, comment: text }
                    },});}}
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
              <TemperatureGraph
                data={toChartData(
                  physical_properties.coefficient_thermal_conductivity
                    ?.temperature_value_pairs,
                )}
                yLabel={yLabelWithUnit(
                  PHYSICAL_Y_LABELS.coefficient_thermal_conductivity,
                  physical_properties.coefficient_thermal_conductivity?.value_unit,
                )}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section">
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
                <input
                  id="density_comment"
                  type="text"
                  value={physical_properties.density?.comment ?? ""}
                  className="input"
                  onChange={(event) => {
                    const text = event.target.value;
                    onDraftChange({
                      ...material,
                      physical_properties: { ...physical_properties, density:{...physical_properties.density, comment: text }
                    },});}}
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
              <TemperatureGraph
                data={toChartData(physical_properties.density?.temperature_value_pairs)}
                yLabel={yLabelWithUnit(
                  PHYSICAL_Y_LABELS.density,
                  physical_properties.density?.value_unit,
                )}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section">
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
                <input
                  id="specific_heat_comment"
                  type="text"
                  value={physical_properties.specific_heat?.comment ?? ""}
                  onChange={(event) => {
                    const text = event.target.value;
                    onDraftChange({
                      ...material,
                      physical_properties: { ...physical_properties, specific_heat:{...physical_properties.specific_heat, comment: text }
                    },});}}
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
              <TemperatureGraph
                data={toChartData(
                  physical_properties.specific_heat?.temperature_value_pairs,
                )}
                yLabel={yLabelWithUnit(
                  PHYSICAL_Y_LABELS.specific_heat,
                  physical_properties.specific_heat?.value_unit,
                )}
              />
            </div>
          </div>
        </fieldset>
      </div>
    </form>
  );
}
