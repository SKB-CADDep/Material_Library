import type { SourceItem } from "../types/api";
import {
  type ChemElementValueEntry,
  type CompositionEntry,
} from "./chemComparisonPivot";
import {
  chemicalEffectiveBounds,
  safeFloat,
  type ToleranceType,
} from "./chemicalEffectiveBounds";
import { materialMatchesApplicationAreas } from "./applicationAreaFilter";
import { resolveCompositionSourceLabel } from "./resolveCompositionSourceLabel";

export type ChemCompositionEntryApi = {
  material_id: string;
  material_name: string;
  areas: string[];
  composition: CompositionEntry;
};

export type ChemCompositionCacheEntry = {
  materialId: string;
  materialName: string;
  areas: string[];
  composition: CompositionEntry;
  sourceLabel: string;
  baseElement: string;
  unit: string;
  elementsMap: Map<string, ChemElementValueEntry>;
};

export type TargetElementDetail = {
  target: number;
  min: number | null;
  max: number | null;
  minTol: number | null;
  maxTol: number | null;
  state: "in" | "below" | "above" | "missing" | "";
  delta: number | null;
};

export type CandidateStatus =
  | "Полное совпадение"
  | "Частичное совпадение"
  | "Нет совпадений";

export type CandidateEvaluation = {
  materialId: string;
  materialName: string;
  sourceLabel: string;
  baseElement: string;
  unit: string;
  composition: CompositionEntry;
  details: Record<string, TargetElementDetail>;
  matched: number;
  totalTargets: number;
  missing: number;
  status: CandidateStatus;
  maxDelta: number;
};

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

export function buildChemCompositionCache(
  entries: ChemCompositionEntryApi[],
  chemicalSources: SourceItem[],
): ChemCompositionCacheEntry[] {
  return entries.map((entry) => {
    const composition = entry.composition;
    const elements = composition.other_elements ?? [];
    return {
      materialId: entry.material_id,
      materialName: entry.material_name,
      areas: entry.areas ?? [],
      composition,
      sourceLabel: resolveCompositionSourceLabel(composition, chemicalSources),
      baseElement: String(composition.base_element ?? "").trim() || "-",
      unit: elements[0]?.unit_value?.trim() || "%",
      elementsMap: buildElementsMap(elements),
    };
  });
}

export function collectTargets(
  rows: Array<{ element: string; target: string }>,
): Record<string, number> {
  const targets: Record<string, number> = {};
  for (const row of rows) {
    const elem = row.element.trim();
    if (!elem || elem === "-") {
      continue;
    }
    const valStr = row.target.trim();
    if (!valStr) {
      continue;
    }
    const targetVal = safeFloat(valStr);
    if (targetVal === null) {
      continue;
    }
    targets[elem] = targetVal;
  }
  return targets;
}

export function evaluateCandidate(
  cand: ChemCompositionCacheEntry,
  targets: Record<string, number>,
): CandidateEvaluation {
  const elementsMap = cand.elementsMap;
  const composition = cand.composition;
  let toleranceType = composition.tolerance_type as ToleranceType | undefined;
  if (toleranceType !== "absolute" && toleranceType !== "relative") {
    toleranceType = "absolute";
  }

  const details: Record<string, TargetElementDetail> = {};
  let matched = 0;
  let missing = 0;
  const numericDeltas: number[] = [];

  for (const [elemSym, targetVal] of Object.entries(targets)) {
    const elemInfo = elementsMap.get(elemSym);
    const detail: TargetElementDetail = {
      target: targetVal,
      min: null,
      max: null,
      minTol: null,
      maxTol: null,
      state: "",
      delta: null,
    };

    if (!elemInfo) {
      detail.state = "missing";
      missing += 1;
      details[elemSym] = detail;
      continue;
    }

    const minV = safeFloat(elemInfo.min_value);
    const maxV = safeFloat(elemInfo.max_value);
    const [lower, upper, minTol, maxTol] = chemicalEffectiveBounds(
      elemInfo,
      toleranceType,
    );

    detail.min = minV;
    detail.max = maxV;
    detail.minTol = minTol;
    detail.maxTol = maxTol;

    if (minV === null && maxV === null) {
      detail.state = "missing";
      missing += 1;
      details[elemSym] = detail;
      continue;
    }

    if (lower <= targetVal && targetVal <= upper) {
      detail.state = "in";
      matched += 1;
    } else if (targetVal < lower) {
      detail.state = "below";
      if (lower !== Number.NEGATIVE_INFINITY) {
        const delta = lower - targetVal;
        detail.delta = delta;
        numericDeltas.push(delta);
      }
    } else if (targetVal > upper) {
      detail.state = "above";
      if (upper !== Number.POSITIVE_INFINITY) {
        const delta = targetVal - upper;
        detail.delta = delta;
        numericDeltas.push(delta);
      }
    } else {
      detail.state = "missing";
    }

    details[elemSym] = detail;
  }

  const totalTargets = Object.keys(targets).length;
  let status: CandidateStatus;
  if (matched === totalTargets && missing === 0 && numericDeltas.length === 0) {
    status = "Полное совпадение";
  } else if (matched > 0) {
    status = "Частичное совпадение";
  } else {
    status = "Нет совпадений";
  }

  const maxDelta = numericDeltas.length > 0 ? Math.max(...numericDeltas) : 0;

  return {
    materialId: cand.materialId,
    materialName: cand.materialName,
    sourceLabel: cand.sourceLabel,
    baseElement: cand.baseElement,
    unit: cand.unit,
    composition: cand.composition,
    details,
    matched,
    totalTargets,
    missing,
    status,
    maxDelta,
  };
}

function candidateSortKey(c: CandidateEvaluation): [
  number,
  number,
  number,
  number,
  string,
] {
  let rank: number;
  if (c.status === "Полное совпадение") {
    rank = 0;
  } else if (c.status === "Частичное совпадение") {
    rank = 1;
  } else {
    rank = 2;
  }
  return [
    rank,
    -c.matched,
    c.maxDelta,
    c.missing,
    c.materialName.toLowerCase(),
  ];
}

export function evaluateAllCandidates(
  cache: ChemCompositionCacheEntry[],
  targets: Record<string, number>,
  selectedAreas: string[],
): CandidateEvaluation[] {
  if (Object.keys(targets).length === 0) {
    return [];
  }

  const candidates: CandidateEvaluation[] = [];
  for (const cand of cache) {
    if (!materialMatchesApplicationAreas(cand.areas, selectedAreas)) {
      continue;
    }
    candidates.push(evaluateCandidate(cand, targets));
  }

  return candidates.sort((a, b) => {
    const ka = candidateSortKey(a);
    const kb = candidateSortKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
}

export function formatDetailNumber(
  value: number | null | undefined,
  prec = 4,
): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return value
    .toFixed(prec)
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "");
}

export const DETAIL_STATE_LABELS: Record<string, string> = {
  in: "в диапазоне",
  below: "ниже диапазона",
  above: "выше диапазона",
  missing: "нет данных",
  "": "нет данных",
};

export function candidateRowClass(status: CandidateStatus): string {
  if (status === "Полное совпадение") {
    return "chem-target-row--full";
  }
  if (status === "Частичное совпадение") {
    return "chem-target-row--partial";
  }
  return "chem-target-row--none";
}

export function detailRowClass(state: TargetElementDetail["state"]): string {
  if (state === "in") {
    return "chem-target-detail--in";
  }
  if (state === "missing") {
    return "chem-target-detail--missing";
  }
  return "chem-target-detail--out";
}
