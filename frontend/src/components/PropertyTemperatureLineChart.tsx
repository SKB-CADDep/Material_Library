import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PropertyChartTooltip } from "../pages/PropertyChartTooltip";
import { computeNiceAxisFromValues, formatTickLabel } from "../utils/chartTicks";
import {
  PROPERTY_CHART_AXIS_TICK,
  PROPERTY_CHART_LINE,
  PROPERTY_CHART_MARGIN,
  PROPERTY_CHART_MIN_HEIGHT,
  PROPERTY_CHART_Y_AXIS_WIDTH,
  propertyChartXAxisLabel,
} from "../utils/propertyChartAxis";

export type PropertyChartPoint = { temperature: number; value: number };

type PropertyTemperatureLineChartProps = {
  data: PropertyChartPoint[];
  yLabel?: string;
};

export function PropertyTemperatureLineChart({
  data,
  yLabel = "Значение",
}: PropertyTemperatureLineChartProps) {
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
    <div className="property-chart-plot">
      <div className="property-chart-y-axis-label" aria-hidden="true">
        {yLabel}
      </div>
      <ResponsiveContainer width="100%" height="100%" minHeight={PROPERTY_CHART_MIN_HEIGHT}>
          <LineChart data={data} margin={PROPERTY_CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              domain={x.domain}
              dataKey="temperature"
              label={propertyChartXAxisLabel()}
              ticks={x.ticks}
              tick={PROPERTY_CHART_AXIS_TICK}
              tickFormatter={formatTickLabel}
            />
            <YAxis
              width={PROPERTY_CHART_Y_AXIS_WIDTH}
              domain={y.domain}
              ticks={y.ticks}
              tick={PROPERTY_CHART_AXIS_TICK}
              tickFormatter={formatTickLabel}
            />
            <Tooltip
              content={({ active, payload }) => (
                <PropertyChartTooltip active={active} payload={payload} yLabel={yLabel} />
              )}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={PROPERTY_CHART_LINE.stroke}
              strokeWidth={PROPERTY_CHART_LINE.strokeWidth}
              dot={PROPERTY_CHART_LINE.dot}
              activeDot={PROPERTY_CHART_LINE.activeDot}
            />
          </LineChart>
        </ResponsiveContainer>
    </div>
  );
}
