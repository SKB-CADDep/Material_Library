export function yLabelWithUnit(baseLabel: string, unit: string | undefined, labels?: Record<string, string>): string {
  const display = labels ? unitDisplayLabel(unit, labels) : (unit ?? "").trim();
  if (!display) return baseLabel;
  const comma = baseLabel.lastIndexOf(",");
  if (comma >= 0) {
    return `${baseLabel.slice(0, comma)}, ${display}`;
  }
  return `${baseLabel}, ${display}`;
}

export function chartValueLabel(yLabel: string): string {
  const comma = yLabel.lastIndexOf(",");
  return comma >= 0 ? yLabel.slice(0, comma).trim() : yLabel;
}


export function unitDisplayLabel(
  unit: string | undefined,
  labels: Record<string, string>,
): string {
  const key = (unit ?? "").trim();
  if (!key) return "";
  return labels[key] ?? key;
}