import { formatTickLabel } from "../utils/chartTicks";

export function yLabelWithUnit(baseLabel: string, unit: string | undefined, labels?: Record<string, string>): string {
  const display = labels ? unitDisplayLabel(unit, labels) : (unit ?? "").trim();
  if (!display) return baseLabel;
  const comma = baseLabel.lastIndexOf(",");
  if (comma >= 0) {
    return `${baseLabel.slice(0, comma)}, ${display}`;
  }
  return `${baseLabel}, ${display}`;
}

export type ChartAxisLabelParts = {
  symbol: string;
  unit: string;
};

export function parseChartAxisLabel(yLabel: string): ChartAxisLabelParts {
  const comma = yLabel.lastIndexOf(",");
  if (comma >= 0) {
    return {
      symbol: yLabel.slice(0, comma).trim(),
      unit: yLabel.slice(comma + 1).trim(),
    };
  }
  return { symbol: yLabel.trim(), unit: "" };
}

export function chartValueLabel(yLabel: string): string {
  return parseChartAxisLabel(yLabel).symbol;
}

export function unitDisplayLabel(
  unit: string | undefined,
  labels: Record<string, string>,
): string {
  const key = (unit ?? "").trim();
  if (!key) return "";
  return labels[key] ?? key;
}

export function formatChartTooltipLine(symbol: string, value: number, unit: string): string {
  if (!Number.isFinite(value)) {
    return unit ? `${symbol} = — ${unit}` : `${symbol} = —`;
  }
  const valueText = formatTickLabel(value);
  return unit ? `${symbol} = ${valueText} ${unit}` : `${symbol} = ${valueText}`;
}
