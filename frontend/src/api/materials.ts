import { api } from "./client";
import type { MaterialSummary, MaterialSaveResponse} from "../types/api";
import { materialForEditor } from "../lib/materialDraft";
import {
  categoryDisplayName,
  hasCategorySource,
  type StrengthCategoryFields,
} from "../lib/strengthCategory";

type MechanicalPropsSlice = {
  strength_category?: StrengthCategoryFields[];
};

type ChemicalPropsSlice = {
  composition?: {
    composition_source?: string;
  }[];
};

export function validateMaterialDraftForSave(
  body: Record<string, unknown>
): string | null {
  const categories =
    (body.mechanical_properties as MechanicalPropsSlice | undefined)
      ?.strength_category ?? [];
  if (categories.length === 0) {
    return "Добавьте категорию прочности и укажите источник (НТД) для КП";
  }
  for (const [i, cat] of categories.entries()) {
    if (!hasCategorySource(cat)) {
      const label = categoryDisplayName(cat, i);
      return `Укажите источник (НТД) для категории прочности «${label}»`;
    }
  }

  const compositions =
    (body.chemical_properties as ChemicalPropsSlice | undefined)
      ?.composition ?? [];
  if (compositions.length === 0) {
    return "Добавьте набор химического состава и укажите источник";
  }
  for (const [i, entry] of compositions.entries()) {
    if (!(entry.composition_source ?? "").trim()) {
      return `Укажите источник для набора состава #${i + 1}`;
    }
  }
  return null;
}

function assertMaterialDraftForSave(body: Record<string, unknown>): void {
  const error = validateMaterialDraftForSave(body);
  if (error) {
    throw new Error(error);
  }
}

type TemperaturePairsHolder = {
  temperature_value_pairs?: Array<[number, number]>;
};

function filterValidPairs(
  pairs: Array<[number, number]> | undefined,
): Array<[number, number]> | undefined {
  if (!pairs) return pairs;
  return pairs.filter(
    ([temperature, value]) =>
      Number.isFinite(temperature) && Number.isFinite(value),
  );
}

function stripPairsInPropertiesList(container: {
  properties?: TemperaturePairsHolder[];
}): void {
  if (!Array.isArray(container.properties)) return;
  for (const property of container.properties) {
    if (!property?.temperature_value_pairs) continue;
    property.temperature_value_pairs = filterValidPairs(
      property.temperature_value_pairs,
    );
  }
}

/** Незаполненные строки T–value (NaN) не сохраняем в JSON. */
function stripInvalidTemperaturePairs(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const next = structuredClone(body);
  const physical = next.physical_properties as
    | { properties?: TemperaturePairsHolder[] }
    | undefined;
  if (physical) {
    stripPairsInPropertiesList(physical);
  }

  const mechanical = next.mechanical_properties as
    | { strength_category?: Array<{ properties?: TemperaturePairsHolder[] }> }
    | undefined;
  for (const category of mechanical?.strength_category ?? []) {
    stripPairsInPropertiesList(category);
  }

  return next;
}

export async function listMaterials(): Promise<MaterialSummary[]> {
  const { data } = await api.get<MaterialSummary[]>("/materials");
  return data;
}
export async function getMaterial(id:string): Promise<Record<string, unknown>>{
  const { data } = await api.get<Record<string, unknown>>(`/materials/${id}`)
  return materialForEditor(data);
}

export async function saveMaterial(
  id: string,
  body: Record<string, unknown>
): Promise<MaterialSaveResponse> {
  assertMaterialDraftForSave(body);
  const payload = stripInvalidTemperaturePairs(body);

  const { data } = await api.put<MaterialSaveResponse>(`/materials/${id}`, payload);
  return data;
}

function defaultMaterialFilename(body: Record<string, unknown>): string{
  const metadata = body.metadata as
  | { name_material_standard?: string }
  | undefined;
  if (!metadata?.name_material_standard) {return "Новыйматериал";}
  return metadata?.name_material_standard;
}


export function materialDraftFilename(body: Record<string, unknown>): string {
  const name = (defaultMaterialFilename(body) ?? "").trim();
  if (!name) {
    throw new Error("Укажите стандартное наименование материала");
  }
  const base = name.replace(/\s+/g, "_");
  return base.toLowerCase().endsWith(".json") ? base : `${base}.json`;
}


export function materialFilenameBaseStem(filename: string): string {
  const stem = filename.replace(/\.json$/i, "");
  return stem.replace(/ \((\d+)\)$/, "");
}


export function nextVersionedMaterialFilename(
  sourceFilename: string,
  existingFilenames: readonly string[],
): string {
  const base = materialFilenameBaseStem(sourceFilename);
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const versionPattern = new RegExp(`^${escapedBase} \\((\\d+)\\)\\.json$`, "i");
  const exactBasePattern = new RegExp(`^${escapedBase}\\.json$`, "i");

  let maxVersion = 0;
  for (const name of existingFilenames) {
    if (exactBasePattern.test(name)) {
      maxVersion = Math.max(maxVersion, 0);
    }
    const match = name.match(versionPattern);
    if (match) {
      maxVersion = Math.max(maxVersion, Number(match[1]));
    }
  }

  return `${base} (${maxVersion + 1}).json`;
}

export function normalizeMaterialFilename(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Имя файла не может быть пустым");
  }
  return trimmed.toLowerCase().endsWith(".json") ? trimmed : `${trimmed}.json`;
}

export async function saveNewMaterial(
  body: Record<string, unknown>,
  filename: string
): Promise<MaterialSaveResponse> {
  assertMaterialDraftForSave(body);
  const payload = stripInvalidTemperaturePairs(body);

  const { data } = await api.post<MaterialSaveResponse>("/materials", payload, {
    params: { filename },
  });
  return data;
}

