import { api } from "./client";
import type { MaterialSummary, MaterialSaveResponse} from "../types/api";

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
  const mechanicalProps = body.mechanical_properties as {
    strength_category?: {
      value_strength_category?: string;
      source_strength_category?: string | null;
      source_ref_id?: string | null;
    }[];
  } | undefined;
  const chemicalProps = body.chemical_properties as {
    composition?: {
      composition_source?: string;
    }[];
  } | undefined;

  for (const [i, cat] of (mechanicalProps?.strength_category ?? []).entries()) {
    const hasSource =
      Boolean((cat.source_strength_category ?? "").trim()) ||
      Boolean((cat.source_ref_id ?? "").trim());
    if (!hasSource) {
      const name =
        (cat.value_strength_category ?? "").trim() || `КП #${i + 1}`;
      throw new Error(`Укажите источник КП для категории «${name}»`);
    }
  }

  for (const [i, entry] of (chemicalProps?.composition ?? []).entries()) {
    if (!(entry.composition_source ?? "").trim()) {
      throw new Error(`Укажите источник для набора состава #${i + 1}`);
    }
  }

  const { data } = await api.put<MaterialSaveResponse>(`/materials/${id}`, body);
  return data;
}

function materialDraftFilename(body: Record<string, unknown>): string {
  const metadata = body.metadata as
    | { name_material_standard?: string }
    | undefined;
  const name = (metadata?.name_material_standard ?? "").trim();
  if (!name) {
    throw new Error("Укажите стандартное наименование материала");
  }
  const base = name.replace(/\s+/g, "_");
  return base.toLowerCase().endsWith(".json") ? base : `${base}.json`;
}

export async function saveNewMaterial(
  body: Record<string, unknown>
): Promise<MaterialSaveResponse> {
  const mechanicalProps = body.mechanical_properties as {
    strength_category?: {
      value_strength_category?: string;
      source_strength_category?: string | null;
      source_ref_id?: string | null;
    }[];
  } | undefined;
  const chemicalProps = body.chemical_properties as {
    composition?: {
      composition_source?: string;
    }[];
  } | undefined;

  for (const [i, cat] of (mechanicalProps?.strength_category ?? []).entries()) {
    const hasSource =
      Boolean((cat.source_strength_category ?? "").trim()) ||
      Boolean((cat.source_ref_id ?? "").trim());
    if (!hasSource) {
      const name =
        (cat.value_strength_category ?? "").trim() || `КП #${i + 1}`;
      throw new Error(`Укажите источник КП для категории «${name}»`);
    }
  }

  for (const [i, entry] of (chemicalProps?.composition ?? []).entries()) {
    if (!(entry.composition_source ?? "").trim()) {
      throw new Error(`Укажите источник для набора состава #${i + 1}`);
    }
  }
  const filename = materialDraftFilename(body);
  const { data } = await api.post<MaterialSaveResponse>("/materials", body, {
    params: { filename },
  });
  return data;
}

