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

type MechanicalPropertiesTabProps = {
  material: Record<string, unknown> | undefined;
  onDraftChange: (next: Record<string, unknown>) => void;
};

type PropertyData = {
  temperature_value_pairs?: Array<[number, number]>;
  value_unit?: string;
  comment?: string;
  property_subsource?: string | number | readonly string[];
};

type StrengthCategory = {
  value_strength_category?: string;
  [key: string]: unknown;
};

type MechanicalProperties = {
  strength_category?: StrengthCategory[];
};

type MechPropertyConfig = {
  key: string;
  legend: string;
  unitType: string;
  yLabel: string;
};

/** Температурозависимые мех. свойства: от предела текучести до выносливости (как в Tkinter / catalog). */
const TEMPERATURE_MECH_PROPERTIES: MechPropertyConfig[] = [
  {
    key: "yield_strength",
    legend: "Предел текучести (σ_0,2)",
    unitType: "Предел текучести",
    yLabel: "σ_0,2, МПа",
  },
  {
    key: "tensile_strength",
    legend: "Предел прочности (σ_в)",
    unitType: "Предел прочности",
    yLabel: "σ_в, МПа",
  },
  {
    key: "impact_strength",
    legend: "Ударная вязкость (KCU)",
    unitType: "Ударная вязкость",
    yLabel: "KCU, Дж/см²",
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

type ChartPoint = { temperature: number; value: number };

function toChartData(pairs: Array<[number, number]> | undefined): ChartPoint[] {
  return (pairs ?? []).map(([temperature, value]) => ({ temperature, value }));
}

function TemperatureGraph({ data, yLabel = "Значение" }: { data: ChartPoint[]; yLabel?: string }) {
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

function TemperatureValueTable({ pairs }: { pairs: Array<[number, number]> | undefined }) {
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
        <button type="button" className="table-control-btn" disabled title="Редактирование — позже">
          +
        </button>
        <button type="button" className="table-control-btn" disabled title="Редактирование — позже">
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
  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }

  const mechanical_properties = (material.mechanical_properties ?? {}) as MechanicalProperties;
  const categoryIndex = 0;
  const category = mechanical_properties.strength_category?.[categoryIndex];

  return (
    <form
      className="general-form physical-properties-form"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="form-stack">
        {category?.value_strength_category && (
          <p className="status-message">
            Категория прочности: {category.value_strength_category}
            {" "}
            <span style={{ color: "var(--text-muted)" }}>
              (пока первая КП; выбор — следующий шаг)
            </span>
          </p>
        )}

        {TEMPERATURE_MECH_PROPERTIES.map((prop) => {
          const data = getPropertyData(category, prop.key);
          const unitId = `${prop.key}_value_unit`;
          const sourceId = `${prop.key}_property_subsource`;
          const commentId = `${prop.key}_comment`;

          return (
            <fieldset key={prop.key} className="form-section">
              <legend>{prop.legend}</legend>
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
                  <TemperatureValueTable pairs={data?.temperature_value_pairs} />
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
