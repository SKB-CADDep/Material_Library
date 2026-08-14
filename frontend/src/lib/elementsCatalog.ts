import elements_catalog from "../config/elements_catalog.json";

export type CatalogElement = {
  symbol: string;
  display_symbol?: string;
  name?: string;
  influence?: string | null;
};

const catalogElements = (elements_catalog as { elements: CatalogElement[] })
  .elements;

export const ELEMENTS_MAP = new Map<string, CatalogElement>(
  catalogElements.map((item) => [item.symbol, item]),
);

export const ELEMENTS_SORTED = [...catalogElements].sort((a, b) =>
  (a.name ?? a.symbol).localeCompare(b.name ?? b.symbol, "ru"),
);

export function elementDisplayName(symbol: string): string {
  return ELEMENTS_MAP.get(symbol)?.name?.trim() || symbol;
}

export type ElementInfluenceLines = {
  header: string;
  improves: string;
  reduces: string;
};

export function parseElementInfluence(symbol: string): ElementInfluenceLines {
  const info = ELEMENTS_MAP.get(symbol);
  const elemName = info?.name?.trim() || symbol;
  const header = `${elemName}: ${symbol}`;
  const tip = info?.influence?.trim() ?? "";

  let improves = "";
  let reduces = "";

  if (tip) {
    for (const line of tip.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("Повышает")) {
        improves = `    - ${trimmed}`;
      } else if (trimmed.startsWith("Снижает")) {
        reduces = `    - ${trimmed}`;
      }
    }
  }

  return { header, improves, reduces };
}
