import elements_catalog from "../config/elements_catalog.json";
import {
  computeChemicalLogDomain,
  formatChemicalBarLabel,
} from "../utils/chemicalChartAxis";

export type ChemicalChartElement = {
  element: string;
  min_value: number;
  max_value: number;
};

export type ChartMode = "min" | "max";

export type ElementChartPoint = {
  /** Подпись на оси Y (display_symbol или символ). */
  name: string;
  symbol: string;
  value: number;
  /** Для log-шкалы: 0 → ε, tooltip/подпись — по value. */
  displayValue: number;
  fill: string;
};

type CatalogElement = {
  symbol: string;
  display_symbol?: string;
  color?: string | null;
};

const catalogElements = (elements_catalog as { elements: CatalogElement[] }).elements;

const catalogBySymbol = new Map(
  catalogElements.map((item) => [item.symbol, item]),
);

export function elementAxisLabel(symbol: string, fallback = "Основа"): string {
  const key = symbol.trim();
  if (!key) return fallback;
  return catalogBySymbol.get(key)?.display_symbol?.trim() || key;
}

export function elementBarColor(symbol: string): string {
  return catalogBySymbol.get(symbol.trim())?.color ?? "#1f77b4";
}

export function buildElementChartData(
  elements: ChemicalChartElement[],
  baseElement: string,
  mode: ChartMode,
): ElementChartPoint[] {
  const plotData: ElementChartPoint[] = [];
  let total = 0;

  for (const el of elements) {
    const sym = el.element?.trim();
    if (!sym) continue;

    const raw = mode === "max" ? el.max_value : el.min_value;
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    if (value > 0) total += value;

    plotData.push({
      name: elementAxisLabel(sym, sym),
      symbol: sym,
      value,
      displayValue: value > 0 ? value : 0.0001,
      fill: elementBarColor(sym),
    });
  }

  const baseSym = baseElement.trim() || "Основа";
  const basePercent = Math.max(0, 100 - total);
  plotData.push({
    name: elementAxisLabel(baseSym, baseSym === "Основа" ? "Основа" : baseSym),
    symbol: baseSym,
    value: basePercent,
    displayValue: basePercent > 0 ? basePercent : 0.0001,
    fill: catalogBySymbol.get(baseSym)?.color ?? "#444444",
  });

  plotData.sort((a, b) => a.value - b.value);
  return plotData;
}

export function chemicalChartHeight(rowCount: number, rowHeight = 40): number {
  return Math.max(300, rowCount * rowHeight + 56);
}

export function chemicalChartLogDomain(data: ElementChartPoint[]): [number, number] {
  return computeChemicalLogDomain(data.map((point) => point.value));
}

export function formatBarValueLabel(value: number, unit: string): string {
  const text = formatChemicalBarLabel(value);
  return text ? ` ${text} ${unit}` : "";
}
