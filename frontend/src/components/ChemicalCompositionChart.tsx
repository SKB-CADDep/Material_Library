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
  formatLogAxisTickLabel,
  isChemicalLogPowerOfTen,
} from "../utils/chemicalChartAxis";

export type { ChartMode, ElementChartPoint };
export { buildElementChartData };

const CHEM_CHART_AXIS = "#000000";
const CHEM_CHART_ELEMENT_AXIS_FONT = 14;
const CHEM_CHART_ROW_HEIGHT = 40;
const CHEM_CHART_BAR_LABEL_FONT = 13;
const CHEM_CHART_LOG_AXIS_FONT = 16;
const CHEM_CHART_LOG_EXP_FONT = 13;
const CHEM_CHART_GRID_MAJOR = "rgba(0, 0, 0, 0.4)";
const CHEM_CHART_GRID_MINOR = "rgba(0, 0, 0, 0.28)";
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
        fontSize={CHEM_CHART_LOG_AXIS_FONT}
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
      dy={8}
      textAnchor="middle"
      className="chemical-log-axis-tick"
      fontSize={CHEM_CHART_LOG_AXIS_FONT}
      fontWeight={600}
    >
      <tspan>10</tspan>
      <tspan
        fontSize={CHEM_CHART_LOG_EXP_FONT}
        baselineShift="super"
        fontWeight={600}
      >
        {exponent}
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
      fontSize={CHEM_CHART_BAR_LABEL_FONT}
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
    if (checked) {
      onModeChange("min");
      return;
    }
    if (mode === "min") {
      onModeChange("max");
    }
  };

  const handleMaxToggle = (checked: boolean) => {
    if (checked) {
      onModeChange("max");
      return;
    }
    if (mode === "max") {
      onModeChange("min");
    }
  };

  return (
    <div className="chemical-composition-chart">
      <fieldset className="chemical-composition-chart__frame">
        <legend className="chemical-composition-chart__legend">
          Распределение элементов в составе
        </legend>
        <div className="chemical-composition-chart__plot">
          {data.length === 0 ? (
            <p className="chemical-composition-chart__empty">Нет данных</p>
          ) : (
            <ResponsiveContainer width="100%" height={height}>
              <BarChart
                layout="vertical"
                data={data}
                margin={{ left: 8, right: 112, top: 12, bottom: 44 }}
                barCategoryGap="20%"
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
                  tickMargin={10}
                  height={46}
                  axisLine={{ stroke: CHEM_CHART_AXIS, strokeWidth: 1 }}
                  tickLine={{ stroke: CHEM_CHART_AXIS }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  reversed
                  tick={{
                    fontSize: CHEM_CHART_ELEMENT_AXIS_FONT,
                    fontWeight: 600,
                    fill: CHEM_CHART_AXIS,
                  }}
                  axisLine={{ stroke: CHEM_CHART_AXIS, strokeWidth: 1 }}
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
                <Bar dataKey="displayValue" name="value" maxBarSize={22} radius={0}>
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
        </div>
      </fieldset>

      <div className="chemical-composition-chart__controls">
        <label className="chemical-composition-chart__check" htmlFor="chem_chart_min">
          <input
            id="chem_chart_min"
            type="checkbox"
            checked={mode === "min"}
            onChange={(event) => handleMinToggle(event.target.checked)}
          />
          Min
        </label>
        <label className="chemical-composition-chart__check" htmlFor="chem_chart_max">
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
