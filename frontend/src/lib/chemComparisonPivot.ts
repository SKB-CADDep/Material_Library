import elements_catalog from "../config/elements_catalog.json";
import type { SourceItem } from "../types/api";
import { formatChemElementValue, type ChemElementValue } from "./formatChemElementValue";
import { resolveCompositionSourceLabel } from "./resolveCompositionSourceLabel";

export type CompositionEntry = {
  composition_source?: string | null;
  source_ref_id?: string | null;
  composition_subsource?: string | null;
  comment?: string | null;
  base_element?: string | null;
  note?: string | null;
  tolerance_type?: "absolute" | "relative" | string | null;
  other_elements?: ChemElementValueEntry[];
};

export type ChemElementValueEntry = ChemElementValue & {
  element?: string | null;
  unit_value?: string | null;
};

export type ChemSourceColumn = {
  key: string;
  label: string;
  comment: string;
  baseElement: string;
  unit: string;
  note: string;
};

export type ChemPivotRow = {
  symbol: string;
  name: string;
  cells: Record<string, string>;
  hasDiff: boolean;
};

export type ChemComparisonView = {
  columns: ChemSourceColumn[];
  rows: ChemPivotRow[];
};

type CatalogElement = {
  symbol: string;
  name?: string;
};

const catalogBySymbol = new Map<string, CatalogElement>(
  (elements_catalog as { elements: CatalogElement[] }).elements.map((item) => [
    item.symbol,
    item,
  ]),
);

export function elementCatalogName(symbol: string): string {
  const key = symbol.trim();
  if (!key) {
    return "";
  }
  return catalogBySymbol.get(key)?.name?.trim() ?? "";
}

function buildElementsMap(
  elements: ChemElementValueEntry[],
): Map<string, ChemElementValueEntry> {
  const map = new Map<string, ChemElementValueEntry>();
  for (const entry of elements) {
    const symbol = String(entry.element ?? "").trim();
    if (symbol) {
      map.set(symbol, entry);
    }
  }
  return map;
}


export function buildChemComparisonView(
  composition: CompositionEntry[],
  chemicalSources: SourceItem[],
): ChemComparisonView {
  if (composition.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns: ChemSourceColumn[] = [];
  const sourceMaps: Map<string, ChemElementValueEntry>[] = [];

  composition.forEach((entry, index) => {
    const elements = entry.other_elements ?? [];
    sourceMaps.push(buildElementsMap(elements));

    columns.push({
      key: `src_${index}`,
      label: resolveCompositionSourceLabel(entry, chemicalSources),
      comment: String(entry.comment ?? ""),
      baseElement: String(entry.base_element ?? "").trim() || "-",
      unit: elements[0]?.unit_value?.trim() || "%",
      note: String(entry.note ?? ""),
    });
  });

  const allSymbols = new Set<string>();
  for (const map of sourceMaps) {
    for (const symbol of map.keys()) {
      allSymbols.add(symbol);
    }
  }

  const rows: ChemPivotRow[] = [...allSymbols].sort().map((symbol) => {
    const formattedValues: string[] = [];
    const cells: Record<string, string> = {};

    columns.forEach((column, index) => {
      const formatted = formatChemElementValue(sourceMaps[index]?.get(symbol));
      cells[column.key] = formatted;
      formattedValues.push(formatted);
    });

    return {
      symbol,
      name: elementCatalogName(symbol),
      cells,
      hasDiff: new Set(formattedValues).size > 1,
    };
  });

  return { columns, rows };
}
