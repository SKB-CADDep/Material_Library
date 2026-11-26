import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { UnitSelect } from "./UnitSelect.tsx";
import {
  PropertySourceSelect,
  isOrphanSource,
  resolvePropertySourceName,
} from "./PropertySourceSelect.tsx";
import type { SourceItem } from "../types/api";
import { yLabelWithUnit } from "./chartLabels.ts";
import { useUnitLabels } from "../hooks/useUnitLabels";
import { useSourcesCatalog } from "../hooks/useSourcesCatalog";
import { usePropertiesCatalog } from "../hooks/usePropertiesCatalog";
import { PropertyTemperatureLineChart } from "../components/PropertyTemperatureLineChart";
import { useKeepAlivePaneActive } from "../context/KeepAlivePaneContext";
import {
  findNamedProp,
  patchPhysicalProperty,
  type NamedProperty,
} from "../lib/namedProperties";
import { parseDecimalInput } from "../lib/formatDecimal";
import { resolveLinearExpansionUnit } from "../lib/linearExpansionUnit";
import { ScientificText } from "../lib/scientificNotation";
import { TemperatureValueTable } from "../components/TemperatureValueTable";
import { PropertyCommentField } from "../components/PropertyCommentField";

const PHYSICAL_Y_LABELS = {
  modulus_elasticity: "E, МПа",
  coefficient_linear_expansion: "α",
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
    legend: "Коэффициент линейного расширения (α)",
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
  readOnly?: boolean;
};

type ChartPoint = { temperature: number; value: number };

function parsePairNumber(raw: string): number {
  if (raw === "" || raw === "-") return NaN;
  return parseDecimalInput(raw) ?? NaN;
}

function toChartData(pairs: Array<[number, number]> | undefined): ChartPoint[] {
  return (pairs ?? [])
    .filter(
      ([temperature, value]) =>
        Number.isFinite(temperature) && Number.isFinite(value),
    )
    .map(([temperature, value]) => ({ temperature, value }));
}

const PhysicalTemperatureGraph = memo(function PhysicalTemperatureGraph({
  unitType,
  yLabel,
  valueUnit,
  pairs,
  enabled,
}: {
  unitType: string;
  yLabel: string;
  valueUnit?: string;
  pairs?: Array<[number, number]>;
  enabled: boolean;
}) {
  const { labels } = useUnitLabels(unitType);
  const chartData = useMemo(() => toChartData(pairs), [pairs]);

  if (!enabled) {
    return <div className="property-chart-plot" aria-hidden="true" />;
  }

  return (
    <PropertyTemperatureLineChart
      data={chartData}
      yLabel={yLabelWithUnit(yLabel, valueUnit, labels)}
    />
  );
});

function PhysicalPropertySection({
  config,
  material,
  prop,
  chartProp,
  sources,
  selectedRowIndex,
  onRowSelect,
  onDraftChange,
  unitType,
  chartsEnabled,
}: {
  config: PhysicalPropConfig;
  material: Record<string, unknown>;
  prop: NamedProperty | undefined;
  chartProp: NamedProperty | undefined;
  sources: SourceItem[];
  selectedRowIndex: number | null;
  onRowSelect: (index: number | null) => void;
  onDraftChange: (next: Record<string, unknown>) => void;
  unitType: string;
  chartsEnabled: boolean;
}) {
  const currentSource = resolvePropertySourceName(prop, sources);
  const sourceNames = sources.map((src) => src.name_source);
  const showOrphan = isOrphanSource(currentSource, sourceNames);
  const pairs = prop?.temperature_value_pairs;
  const chartPairs = chartProp?.temperature_value_pairs;
  const storedUnit = prop?.value_unit ?? "";
  const displayUnit =
    config.key === "coefficient_linear_expansion"
      ? resolveLinearExpansionUnit(
          storedUnit,
          (pairs ?? []).map((pair) => pair[1]),
        )
      : storedUnit;

  const patch = (next: Partial<NamedProperty>) => {
    onDraftChange(patchPhysicalProperty(material, config.key, next));
  };

  // Меняем только подпись ед.изм.; числа в БД не пересчитываем (пересчёт — только в расчётах).
  const handleUnitChange = (nextUnit: string) => {
    patch({ value_unit: nextUnit });
  };

  return (
    <fieldset className="form-section">
      <legend>
        <ScientificText>{config.legend}</ScientificText>
      </legend>
      <div className="property-section-layout">
        <div className="property-section-fields">
          <div className="form-row form-row--unit">
            <label htmlFor={config.unitId}>Ед.изм.</label>
            <UnitSelect
              id={config.unitId}
              unitType={unitType}
              value={displayUnit}
              onChange={handleUnitChange}
            />
          </div>
          <div className="form-row form-row--stack">
            <label htmlFor={config.sourceId}>Источник:</label>
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
          <div className="form-row form-row--stack">
            <label htmlFor={config.commentId}>Комментарий:</label>
            <PropertyCommentField
              id={config.commentId}
              value={prop?.comment ?? ""}
              onChange={(text) => {
                patch({ comment: text });
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
            unitType={unitType}
            yLabel={PHYSICAL_Y_LABELS[config.key]}
            valueUnit={displayUnit}
            pairs={chartPairs}
            enabled={chartsEnabled}
          />
        </div>
      </div>
    </fieldset>
  );
}

export const PhysicalPropertiesTab = memo(function PhysicalPropertiesTab({
  material,
  onDraftChange,
  readOnly = false,
}: PhysicalPropertiesTabProps) {
  const paneActive = useKeepAlivePaneActive();
  const chartsEnabled = useDeferredValue(paneActive);
  const deferredMaterial = useDeferredValue(material);
  const result = useSourcesCatalog({ enabled: paneActive });
  const propertiesCatalog = usePropertiesCatalog({ enabled: paneActive });
  const physicalSources = result.data?.property_sources ?? [];
  const [selectedRows, setSelectedRows] = useState<
    Partial<Record<PhysicalPropKey, number | null>>
  >({});

  const materialKey =
    typeof material?.material_id === "string" && material.material_id.trim()
      ? material.material_id
      : null;

  useEffect(() => {
    setSelectedRows({});
  }, [materialKey]);

  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }

  const physical = material.physical_properties as
    | Record<string, unknown>
    | undefined;
  const deferredPhysical = deferredMaterial?.physical_properties as
    | Record<string, unknown>
    | undefined;

  return (
    <form
      className="general-form physical-properties-form"
      onSubmit={(event) => event.preventDefault()}
    >
      <fieldset className="editor-readonly-scope" disabled={readOnly}>
        <div className="form-stack">
          {PHYSICAL_PROPERTIES.map((config) => (
            <PhysicalPropertySection
              key={config.key}
              config={config}
              material={material}
              prop={findNamedProp(physical, config.key)}
              chartProp={findNamedProp(deferredPhysical, config.key)}
              chartsEnabled={chartsEnabled}
              sources={physicalSources}
              unitType={
                propertiesCatalog.data?.physical[config.key]?.unit_type ??
                config.unitType
              }
              selectedRowIndex={selectedRows[config.key] ?? null}
              onRowSelect={(index) => {
                setSelectedRows((prev) => ({ ...prev, [config.key]: index }));
              }}
              onDraftChange={onDraftChange}
            />
          ))}
        </div>
      </fieldset>
    </form>
  );
});

