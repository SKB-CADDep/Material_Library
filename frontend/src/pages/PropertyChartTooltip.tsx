import { ScientificText } from "../lib/scientificNotation";
import { formatChartTooltipLine, parseChartAxisLabel } from "./chartLabels";

type ChartPoint = { temperature: number; value: number };

type PropertyChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartPoint }>;
  yLabel: string;
};

export function PropertyChartTooltip({
  active,
  payload,
  yLabel,
}: PropertyChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  const { symbol, unit } = parseChartAxisLabel(yLabel);
  const temperatureLine = formatChartTooltipLine("T", point.temperature, "°C");
  const valueLine = formatChartTooltipLine(symbol, point.value, unit);

  return (
    <div className="property-chart-tooltip">
      <p>
        <ScientificText>{temperatureLine}</ScientificText>
      </p>
      <p>
        <ScientificText>{valueLine}</ScientificText>
      </p>
    </div>
  );
}
