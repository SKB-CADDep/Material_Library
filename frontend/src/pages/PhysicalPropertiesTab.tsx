import { useMemo, useState } from "react";
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
import { UnitSelect } from "./UnitSelect.tsx";
import {
  PropertySourceSelect,
  isOrphanSource,
  resolvePropertySourceName,
} from "./PropertySourceSelect.tsx";
import type { SourceItem } from "../types/api";
import { chartValueLabel, yLabelWithUnit } from "./chartLabels.ts";
import { useUnitLabels } from "../hooks/useUnitLabels";
import { computeNiceAxisFromValues, formatTickLabel } from "../utils/chartTicks.ts";
import {
  findNamedProp,
  patchPhysicalProperty,
  type NamedProperty,
} from "../lib/namedProperties";

const PHYSICAL_Y_LABELS = {
  modulus_elasticity: "E, МПа",
  coefficient_linear_expansion: "α, ·10⁻⁶ 1/°C",
  coefficient_thermal_conductivity: "λ, Вт/(м·°C)",
  density: "ρ, кг/м³",
  specific_heat: "C, Дж/(кг·°C)",
} as const;

type PhysicalPropKey = keyof typeof PHYSICAL_Y_LABELS;

type PhysicalPropConfig = {
  key: PhysicalPropKey;
  legend: string;
  unitType: string;
  unitId: string;
  sourceId: string;
  commentId: string;
};

const PHYSICAL_PROPERTIES: PhysicalPropConfig[] = [
  {
    key: "modulus_elasticity",
    legend: "Модуль упругости (E)",
    unitType: "Модуль упругости",
    unitId: "modulus_elasticity_value_unit",
    sourceId: "modulus_elasticity_property_subsource",
    commentId: "modulus_elasticity_comment",
  },
  {
    key: "coefficient_linear_expansion",
    legend: "Коэффициент линейного расширения (·10⁻⁶)(α)",
    unitType: "Коэффициент линейного расширения",
    unitId: "coefficient_linear_expansion_value_unit",
    sourceId: "coefficient_linear_expansion_property_subsource",
    commentId: "coefficient_linear_expansion_comment",
  },
  {
    key: "coefficient_thermal_conductivity",
    legend: "Коэффициент теплопроводности (λ)",
    unitType: "Теплопроводность",
    unitId: "coefficient_thermal_conductivity_value_unit",
    sourceId: "coefficient_thermal_conductivity_property_subsource",
    commentId: "coefficient_thermal_conductivity_comment",
  },
  {
    key: "density",
    legend: "Плотность (ρ)",
    unitType: "Плотность",
    unitId: "density_value_unit",
    sourceId: "density_property_subsource",
    commentId: "density_comment",
  },
  {
    key: "specific_heat",
    legend: "Удельная теплоёмкость (C)",
    unitType: "Удельная теплоемкость",
    unitId: "specific_heat_value_unit",
    sourceId: "specific_heat_property_subsource",
    commentId: "specific_heat_comment",
  },
];

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
    .filter(
      ([temperature, value]) =>
        Number.isFinite(temperature) && Number.isFinite(value),
    )
    .map(([temperature, value]) => ({ temperature, value }));
}

type TemperatureGraphProps = {
  data: ChartPoint[];
  yLabel?: string;
};

function TemperatureGraph({ data, yLabel = "Значение" }: TemperatureGraphProps) {
  const axes = useMemo(() => {
    if (data.length === 0) {
      return null;
    }
    const x = computeNiceAxisFromValues(data.map((point) => point.temperature));
    const y = computeNiceAxisFromValues(data.map((point) => point.value));
    if (!x || !y) {
      return null;
    }
    return { x, y };
  }, [data]);

  if (!axes) {
    return <p className="tab-placeholder">Нет данных для графика</p>;
  }

  const { x, y } = axes;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={x.domain}
          dataKey="temperature"
          label={{ value: "T, °C", position: "insideBottom", offset: -5 }}
          ticks={x.ticks}
          tickFormatter={formatTickLabel}
        />
        <YAxis
          width={72}
          domain={y.domain}
          label={{ value: yLabel, angle: -90, position: "insideLeft" }}
          ticks={y.ticks}
          tickFormatter={formatTickLabel}
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
    <TemperatureGraph
      data={toChartData(pairs)}
      yLabel={yLabelWithUnit(yLabel, valueUnit, labels)}
    />
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
  onDeleteRow,
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
                    className={
                      isRowSelectionEnabled ? "data-table-select-cell" : undefined
                    }
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
                    className={
                      isRowSelectionEnabled ? "data-table-select-cell" : undefined
                    }
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

function PhysicalPropertySection({
  config,
  material,
  prop,
  sources,
  selectedRowIndex,
  onRowSelect,
  onDraftChange,
}: {
  config: PhysicalPropConfig;
  material: Record<string, unknown>;
  prop: NamedProperty | undefined;
  sources: SourceItem[];
  selectedRowIndex: number | null;
  onRowSelect: (index: number | null) => void;
  onDraftChange: (next: Record<string, unknown>) => void;
}) {
  const currentSource = resolvePropertySourceName(prop, sources);
  const sourceNames = sources.map((src) => src.name_source);
  const showOrphan = isOrphanSource(currentSource, sourceNames);
  const pairs = prop?.temperature_value_pairs;

  const patch = (next: Partial<NamedProperty>) => {
    onDraftChange(patchPhysicalProperty(material, config.key, next));
  };

  return (
    <fieldset className="form-section">
      <legend>{config.legend}</legend>
      <div className="property-section-layout">
        <div className="property-section-fields">
          <div className="form-row">
            <label htmlFor={config.unitId}>Ед. изм:</label>
            <UnitSelect
              id={config.unitId}
              unitType={config.unitType}
              value={prop?.value_unit ?? ""}
              onChange={(nextUnit) => {
                patch({ value_unit: nextUnit });
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor={config.sourceId}>Источник свойств:</label>
            <PropertySourceSelect
              id={config.sourceId}
              value={currentSource}
              showOrphan={showOrphan}
              sources={sources}
              onChange={(name, sourceRefId) => {
                patch({
                  property_subsource: name,
                  source_ref_id: sourceRefId,
                });
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor={config.commentId}>Комментарий:</label>
            <input
              id={config.commentId}
              type="text"
              value={prop?.comment ?? ""}
              className="input"
              onChange={(event) => {
                patch({ comment: event.target.value });
              }}
            />
          </div>
          <TemperatureValueTable
            pairs={pairs}
            onChangeValue={(rowIndex, raw) => {
              const nextValue = parsePairNumber(raw);
              const prevPairs = pairs ?? [];
              patch({
                temperature_value_pairs: prevPairs.map((pair, i) =>
                  i !== rowIndex ? pair : [pair[0], nextValue],
                ),
              });
            }}
            onChangeTemperature={(rowIndex, raw) => {
              const nextTemperature = parsePairNumber(raw);
              const prevPairs = pairs ?? [];
              patch({
                temperature_value_pairs: prevPairs.map((pair, i) =>
                  i !== rowIndex ? pair : [nextTemperature, pair[1]],
                ),
              });
            }}
            selectedRowIndex={selectedRowIndex}
            onRowSelect={onRowSelect}
            onAddRow={() => {
              const prev = pairs ?? [];
              patch({ temperature_value_pairs: [...prev, [NaN, NaN]] });
              onRowSelect(null);
            }}
            onDeleteRow={() => {
              const prev = pairs ?? [];
              if (prev.length === 0) return;
              if (
                !window.confirm("Вы уверены, что хотите удалить эту пару?")
              ) {
                return;
              }
              patch({
                temperature_value_pairs: prev.filter(
                  (_, i) => i !== selectedRowIndex,
                ),
              });
              onRowSelect(null);
            }}
          />
        </div>
        <div className="property-section-chart">
          <PhysicalTemperatureGraph
            unitType={config.unitType}
            yLabel={PHYSICAL_Y_LABELS[config.key]}
            valueUnit={prop?.value_unit}
            pairs={pairs}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function PhysicalPropertiesTab({
  material,
  onDraftChange,
}: PhysicalPropertiesTabProps) {
  const result = useQuery({
    queryKey: ["sources"],
    queryFn: getSources,
  });
  const physicalSources = result.data?.property_sources ?? [];
  const [selectedRows, setSelectedRows] = useState<
    Partial<Record<PhysicalPropKey, number | null>>
  >({});

  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }

  const physical = material.physical_properties as
    | Record<string, unknown>
    | undefined;

  return (
    <form
      className="general-form physical-properties-form"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="form-stack">
        {PHYSICAL_PROPERTIES.map((config) => (
          <PhysicalPropertySection
            key={config.key}
            config={config}
            material={material}
            prop={findNamedProp(physical, config.key)}
            sources={physicalSources}
            selectedRowIndex={selectedRows[config.key] ?? null}
            onRowSelect={(index) => {
              setSelectedRows((prev) => ({ ...prev, [config.key]: index }));
            }}
            onDraftChange={onDraftChange}
          />
        ))}
      </div>
    </form>
  );
}
