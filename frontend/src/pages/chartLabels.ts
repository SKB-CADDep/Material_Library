export function yLabelWithUnit(baseLabel: string, unit: string | undefined): string {
  const trimmed = (unit ?? "").trim();
  if (!trimmed) return baseLabel;
  const comma = baseLabel.lastIndexOf(",");
  if (comma >= 0) {
    return `${baseLabel.slice(0, comma)}, ${trimmed}`;
  }
  return `${baseLabel}, ${trimmed}`;
}

export function chartValueLabel(yLabel: string): string {
  const comma = yLabel.lastIndexOf(",");
  return comma >= 0 ? yLabel.slice(0, comma).trim() : yLabel;
}
