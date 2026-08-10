
export const PROPERTY_CHART_MIN_HEIGHT = 480;

export const PROPERTY_CHART_MARGIN = {
  left: 20,
  right: 16,
  top: 12,
  bottom: 42,
} as const;

export const PROPERTY_CHART_Y_AXIS_WIDTH = 80;

export const PROPERTY_CHART_AXIS_TICK = {
  fontSize: 14,
  fontWeight: 600,
  fill: "var(--text)",
} as const;

const PROPERTY_CHART_AXIS_LABEL_STYLE = {
  fontSize: 16,
  fontWeight: 700,
  fill: "var(--text)",
} as const;

export const PROPERTY_CHART_LINE = {
  stroke: "#3D5A80",
  strokeWidth: 2.5,
  dot: { fill: "#3D5A80", r: 5 },
  activeDot: { r: 7 },
} as const;

const PROPERTY_CHART_AXIS_LABEL_OFFSET = 12;

export function propertyChartXAxisLabel() {
  return {
    value: "T, °C",
    position: "bottom" as const,
    offset: PROPERTY_CHART_AXIS_LABEL_OFFSET,
    style: PROPERTY_CHART_AXIS_LABEL_STYLE,
  };
}
