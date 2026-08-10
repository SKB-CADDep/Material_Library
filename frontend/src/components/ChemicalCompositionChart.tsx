import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartMode,
  type ElementChartPoint,
  buildElementChartData,
  chemicalChartHeight,
  chemicalChartLogDomain,
  formatBarValueLabel,
} from "../lib/chemicalCompositionChart";
import {
  buildLogAxisTicks,
  chemicalLogAxisExponent,
  formatChemicalBarLabel,
  formatChemicalLogAxisExponentSuperscript,
  formatLogAxisTickLabel,
  isChemicalLogPowerOfTen,
} from "../utils/chemicalChartAxis";

export type { ChartMode, ElementChartPoint };
export { buildElementChartData };

const CHEM_CHART_ELEMENT_AXIS_FONT = 16;
const CHEM_CHART_ROW_HEIGHT = 40;
const CHEM_CHART_GRID_MAJOR = "rgba(70, 70, 70, 0.55)";
const CHEM_CHART_GRID_MINOR = "rgba(70, 70, 70, 0.42)";
const CHEM_CHART_GRID_DASH = "6 4";

type LogAxisTickProps = {
  x?: number | string;
  y?: number | string;
  payload?: { value: number };
};

function ChemicalLogAxisTick({ x = 0, y = 0, payload }: LogAxisTickProps) {
  const xPos = typeof x === "number" ? x : Number(x);
  const yPos = typeof y === "number" ? y : Number(y);
  const value = Number(payload?.value ?? 0);

  if (!isChemicalLogPowerOfTen(value)) {
    return (
      <text
        x={xPos}
        y={yPos}
        dy={5}
        textAnchor="middle"
        className="chemical-log-axis-tick chemical-log-axis-tick--plain"
      >
        {formatLogAxisTickLabel(value)}
      </text>
    );
  }

  const exponent = chemicalLogAxisExponent(value) ?? 0;

  return (
    <text
      x={xPos}
      y={yPos}
      dy={5}
      textAnchor="middle"
      className="chemical-log-axis-tick"
    >
      <tspan className="chemical-log-axis-tick__base">10</tspan>
      <tspan className="chemical-log-axis-tick__exp">
        {formatChemicalLogAxisExponentSuperscript(exponent)}
      </tspan>
    </text>
  );
}

type BarValueLabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string | null;
  unit: string;
};

function labelListValue(value: unknown): number | string | null | undefined {
  if (value == null || typeof value === "boolean") {
    return undefined;
  }
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  return undefined;
}

/** Подпись % у конца столбца — как Tkinter ax.text(val, i, …). */
function ChemicalBarValueLabel({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  value,
  unit,
}: BarValueLabelProps) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0.0001) {
    return null;
  }

  const xPos = typeof x === "number" ? x : Number(x);
  const yPos = typeof y === "number" ? y : Number(y);
  const barWidth = typeof width === "number" ? width : Number(width);
  const barHeight = typeof height === "number" ? height : Number(height);
  const label = formatBarValueLabel(numeric, unit);

  return (
    <text
      x={xPos + barWidth + 4}
      y={yPos + barHeight / 2}
      dy={4}
      textAnchor="start"
      className="chemical-bar-value-label"
    >
      {label}
    </text>
  );
}

export type ChemicalCompositionChartProps = {
  data: ElementChartPoint[];
  unit: string;
  mode: ChartMode;
  onModeChange: (mode: ChartMode) => void;
};

export function ChemicalCompositionChart({
  data,
  unit,
  mode,
  onModeChange,
}: ChemicalCompositionChartProps) {
  const height = chemicalChartHeight(data.length, CHEM_CHART_ROW_HEIGHT);
  const domain = useMemo(() => chemicalChartLogDomain(data), [data]);
  const { majorTicks, minorTicks } = useMemo(
    () => buildLogAxisTicks(domain),
    [domain],
  );

  const handleMinToggle = (checked: boolean) => {
    onModeChange(checked ? "min" : "max");
  };

  const handleMaxToggle = (checked: boolean) => {
    onModeChange(checked ? "max" : "min");
  };

  return (
    <div className="chemical-composition-chart property-section-chart">
      <fieldset className="chemical-composition-chart__panel">
        <legend>Распределение элементов в составе</legend>
        {data.length === 0 ? (
          <p className="tab-placeholder">Нет данных для графика</p>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ left: 4, right: 88, top: 12, bottom: 44 }}
              barCategoryGap="18%"
            >
              {majorTicks.map((tick) => (
                <ReferenceLine
                  key={`major-${tick}`}
                  x={tick}
                  stroke={CHEM_CHART_GRID_MAJOR}
                  strokeDasharray={CHEM_CHART_GRID_DASH}
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                />
              ))}
              {minorTicks.map((tick) => (
                <ReferenceLine
                  key={`minor-${tick}`}
                  x={tick}
                  stroke={CHEM_CHART_GRID_MINOR}
                  strokeDasharray={CHEM_CHART_GRID_DASH}
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                />
              ))}
              <XAxis
                type="number"
                scale="log"
                domain={domain}
                allowDataOverflow
                ticks={majorTicks}
                tick={ChemicalLogAxisTick}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={{ stroke: "var(--text-muted)" }}
                label={{
                  value: unit.trim() ? unit : "%",
                  position: "insideBottom",
                  offset: -4,
                  style: {
                    fill: "var(--text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                  },
                }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                reversed
                tick={{
                  fontSize: CHEM_CHART_ELEMENT_AXIS_FONT,
                  fontWeight: 600,
                  fill: "var(--text)",
                }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <Tooltip
                formatter={(_value, _name, item) => {
                  const point = item?.payload as ElementChartPoint | undefined;
                  const v = point?.value ?? 0;
                  const text = formatChemicalBarLabel(v);
                  return [`${text} ${unit}`, mode === "max" ? "Max" : "Min"];
                }}
              />
              <Bar dataKey="displayValue" name="value" maxBarSize={26} radius={0}>
                {data.map((entry) => (
                  <Cell key={entry.symbol} fill={entry.fill} stroke={entry.fill} />
                ))}
                <LabelList
                  dataKey="value"
                  content={(props) => (
                    <ChemicalBarValueLabel
                      x={props.x}
                      y={props.y}
                      width={props.width}
                      height={props.height}
                      value={labelListValue(props.value)}
                      unit={unit}
                    />
                  )}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </fieldset>
      <div className="chemical-composition-chart__controls">
        <label className="checkbox-item" htmlFor="chem_chart_min">
          <input
            id="chem_chart_min"
            type="checkbox"
            checked={mode === "min"}
            onChange={(event) => handleMinToggle(event.target.checked)}
          />
          Min
        </label>
        <label className="checkbox-item" htmlFor="chem_chart_max">
          <input
            id="chem_chart_max"
            type="checkbox"
            checked={mode === "max"}
            onChange={(event) => handleMaxToggle(event.target.checked)}
          />
          Max
        </label>
      </div>
    </div>
  );
}
