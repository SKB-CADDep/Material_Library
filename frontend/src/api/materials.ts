import { api } from "./client";
import type { MaterialSummary, MaterialSaveResponse} from "../types/api";

type MechanicalPropsSlice = {
  strength_category?: {
    value_strength_category?: string;
    source_strength_category?: string | null;
    source_ref_id?: string | null;
  }[];
};

type ChemicalPropsSlice = {
  composition?: {
    composition_source?: string;
  }[];
};

function hasKpSource(cat: {
  source_strength_category?: string | null;
  source_ref_id?: string | null;
}): boolean {
  return (
    Boolean((cat.source_strength_category ?? "").trim()) ||
    Boolean((cat.source_ref_id ?? "").trim())
  );
}

export function validateMaterialDraftForSave(
  body: Record<string, unknown>
): string | null {
  const categories =
    (body.mechanical_properties as MechanicalPropsSlice | undefined)
      ?.strength_category ?? [];
  if (categories.length === 0) {
    return "Добавьте категорию прочности и укажите источник КП";
  }
  for (const [i, cat] of categories.entries()) {
    if (!hasKpSource(cat)) {
      const name =
        (cat.value_strength_category ?? "").trim() || `КП #${i + 1}`;
      return `Укажите источник КП для категории «${name}»`;
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

/** Незаполненные строки T–value (NaN) не сохраняем в JSON. */
function stripInvalidTemperaturePairs(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const next = structuredClone(body);
  const physical = next.physical_properties as
    | Record<string, { temperature_value_pairs?: Array<[number, number]> }>
    | undefined;
  if (!physical) return next;

  for (const property of Object.values(physical)) {
    if (!property?.temperature_value_pairs) continue;
    property.temperature_value_pairs = property.temperature_value_pairs.filter(
      ([temperature, value]) =>
        Number.isFinite(temperature) && Number.isFinite(value),
    );
  }

  return next;
}

export async function listMaterials(): Promise<MaterialSummary[]> {
  const { data } = await api.get<MaterialSummary[]>("/materials");
  return data;
}
export async function getMaterial(id:string): Promise<Record<string, unknown>>{
  const { data } = await api.get<Record<string, unknown>>(`/materials/${id}`)
  return data;
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

export function normalizeMaterialFilename(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Имя файла не может быть пустым");
  }
  const base = trimmed.replace(/\s+/g, "_");
  return base.toLowerCase().endsWith(".json") ? base : `${base}.json`;
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

