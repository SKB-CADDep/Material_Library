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
  
  type MechanicalPropertiesTabProps = {
    material: Record<string, unknown> | undefined;
    onDraftChange: (next: Record<string, unknown>) => void;
  };
  
  type ChartPoint = { temperature: number; value: number };
  
  function toChartData(pairs: Array<[number, number]> | undefined): ChartPoint[] {
    return (pairs ?? []).map(([temperature, value]) => ({ temperature, value }));
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
  
  type TemperatureValueTableProps = {
    pairs: Array<[number, number]> | undefined;
  };
  
  function TemperatureValueTable({ pairs }: TemperatureValueTableProps) {
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
            title="Редактирование — в следующем шаге (B6)"
          >
            +
          </button>
          <button
            type="button"
            className="table-control-btn"
            disabled
            title="Редактирование — в следующем шаге (B6)"
          >
            −
          </button>
        </div>
      </div>
    );
  }
  
  export function MechaicalPropertiesTab({ material, onDraftChange }: MechanicalPropertiesTabProps) {
  
    if (!material) {
      return <p className="tab-placeholder">Выберите материал в списке выше</p>;
    }
  
    const mechanical_properties = material.mechanical_properties as {
      strength_category?: {
        yield_strength?:{
        temperature_value_pairs?: Array<[number, number]>;
        value_unit?: string;
        comment?: string;
        property_subsource?: string | number | readonly string[]}
      };
      coefficient_linear_expansion?: {
        temperature_value_pairs?: Array<[number, number]>;
        value_unit?: string;
        comment?: string;
        property_subsource?: string | number | readonly string[];
      };
      coefficient_thermal_conductivity?: {
        temperature_value_pairs?: Array<[number, number]>;
        value_unit?: string;
        comment?: string;
        property_subsource?: string | number | readonly string[];
      };
      density?: {
        temperature_value_pairs?: Array<[number, number]>;
        value_unit?: string;
        comment?: string;
      };
      specific_heat?: {
        temperature_value_pairs?: Array<[number, number]>;
        value_unit?: string;
        comment?: string;
      };
    };
  
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
                  <input
                    id="modulus_elasticity_property_subsource"
                    type="number"
                    value={physical_properties.modulus_elasticity?.property_subsource ?? ""}
                    className="input"
                    onChange={(event) => {
                      const text = event.target.value;
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
                />
              </div>
              <div className="property-section-chart">
                <TemperatureGraph
                  data={toChartData(
                    physical_properties.modulus_elasticity?.temperature_value_pairs,
                  )}
                  yLabel="E, МПа"
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
                  <input
                    id="coefficient_linear_expansion_property_subsource"
                    type="number"
                    value={
                      physical_properties.coefficient_linear_expansion?.property_subsource ??
                      ""
                    }
                    className="input"
                    onChange={(event) => {
                      const text = event.target.value;
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
                />
              </div>
              <div className="property-section-chart">
                <TemperatureGraph
                  data={toChartData(
                    physical_properties.coefficient_linear_expansion?.temperature_value_pairs,
                  )}
                  yLabel="α, ·10⁻⁶ 1/°C"
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
                  <input
                    id="coefficient_thermal_conductivity_property_subsource"
                    type="number"
                    value={
                      physical_properties.coefficient_thermal_conductivity
                        ?.property_subsource ?? ""
                    }
                    className="input"
                    onChange={(event) => {
                      const text = event.target.value;
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
                />
              </div>
              <div className="property-section-chart">
                <TemperatureGraph
                  data={toChartData(
                    physical_properties.coefficient_thermal_conductivity
                      ?.temperature_value_pairs,
                  )}
                  yLabel="λ, Вт/(м·°C)"
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
                />
              </div>
              <div className="property-section-chart">
                <TemperatureGraph
                  data={toChartData(physical_properties.density?.temperature_value_pairs)}
                  yLabel="ρ, кг/м³"
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
                />
              </div>
              <div className="property-section-chart">
                <TemperatureGraph
                  data={toChartData(
                    physical_properties.specific_heat?.temperature_value_pairs,
                  )}
                  yLabel="C, Дж/(кг·°C)"
                />
              </div>
            </div>
          </fieldset>
        </div>
      </form>
    );
  }