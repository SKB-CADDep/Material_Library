import elements_catalog from "../config/elements_catalog.json";
import type { ElementItem, ElementsCatalogResponse } from "../types/api";

export type CatalogElement = {
  symbol: string;
  display_symbol?: string;
  name?: string;
  color?: string | null;
  influence?: string | null;
  min?: number | null;
};

function toCatalogElements(
  elements: CatalogElement[] | ElementItem[],
): CatalogElement[] {
  return elements.map((item) => ({
    symbol: item.symbol,
    display_symbol: item.display_symbol ?? item.symbol,
    name: item.name,
    color: item.color ?? null,
    influence: item.influence ?? null,
    min: item.min ?? undefined,
  }));
}

function sortElements(elements: CatalogElement[]): CatalogElement[] {
  return [...elements].sort((a, b) =>
    (a.name ?? a.symbol).localeCompare(b.name ?? b.symbol, "ru"),
  );
}

let catalogElements = toCatalogElements(
  (elements_catalog as { elements: CatalogElement[] }).elements,
);

export const ELEMENTS_MAP = new Map<string, CatalogElement>(
  catalogElements.map((item) => [item.symbol, item]),
);

export function applyElementsCatalog(
  catalog: ElementsCatalogResponse | { elements: CatalogElement[] },
): void {
  catalogElements = toCatalogElements(catalog.elements);
  ELEMENTS_MAP.clear();
  for (const item of catalogElements) {
    ELEMENTS_MAP.set(item.symbol, item);
  }
}

export function getCatalogElements(): CatalogElement[] {
  return catalogElements;
}

export function getElementsSorted(): CatalogElement[] {
  return sortElements(catalogElements);
}

/** Snapshot sorted at module load; prefer getElementsSorted() after edits. */
export const ELEMENTS_SORTED = sortElements(catalogElements);

export function elementDisplayName(symbol: string): string {
  return ELEMENTS_MAP.get(symbol)?.name?.trim() || symbol;
}

export type ElementInfluenceLines = {
  header: string;
  improves: string;
  reduces: string;
};

export type ElementInfluenceParts = {
  improves: string;
  reduces: string;
};

function stripInfluencePrefix(line: string, prefix: string): string {
  const trimmed = line.trim();
  if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return "";
  }
  let rest = trimmed.slice(prefix.length).trim();
  if (rest.startsWith(":")) {
    rest = rest.slice(1).trim();
  }
  rest = rest.replace(/[.\s]+$/g, "").trim();
  if (!rest || rest === "-") {
    return "";
  }
  return rest;
}

/** Разбор текста influence на «Повышает» / «Снижает». */
export function parseInfluenceText(tip: string | null | undefined): ElementInfluenceParts {
  let improves = "";
  let reduces = "";
  if (!tip?.trim()) {
    return { improves, reduces };
  }
  for (const line of tip.split("\n")) {
    const trimmed = line.trim();
    if (/^повышает/i.test(trimmed)) {
      improves = stripInfluencePrefix(trimmed, "Повышает");
    } else if (/^снижает/i.test(trimmed)) {
      reduces = stripInfluencePrefix(trimmed, "Снижает");
    }
  }
  return { improves, reduces };
}

/** Сборка influence в формат каталога. */
export function formatInfluenceText(
  elementName: string,
  parts: ElementInfluenceParts,
): string | null {
  const improves = parts.improves.trim() || "-";
  const reduces = parts.reduces.trim() || "-";
  if (improves === "-" && reduces === "-") {
    return null;
  }
  const title = elementName.trim() || "Элемент";
  return `${title}.\nПовышает: ${improves}.\nСнижает: ${reduces}.`;
}

export function parseElementInfluence(symbol: string): ElementInfluenceLines {
  const info = ELEMENTS_MAP.get(symbol);
  const elemName = info?.name?.trim() || symbol;
  const header = `${elemName}: ${symbol}`;
  const parts = parseInfluenceText(info?.influence);
  const improves = parts.improves ? `    - Повышает: ${parts.improves}` : "";
  const reduces = parts.reduces ? `    - Снижает: ${parts.reduces}` : "";
  return { header, improves, reduces };
}
