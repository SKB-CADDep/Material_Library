export type WorkspaceResponse = {
    directory: string;
    count: number;
    application_areas: string[];
};

export type MaterialSummary = {
id: string;
name: string;
areas: string[];
filename: string;
};

export interface SourceItem {
  id_source?: string;
  name_source: string;
  description: string;
  hyperlink: string;
  user_name_change: string;
  data_change: string;
  user_name_found: string;
  data_found: string;
}

export type SourceResponse = {
  property_sources: SourceItem[];
  strength_sources: SourceItem[];
  chemical_sources: SourceItem[];
};


export type MaterialSaveResponse = {
ok: boolean
filename: string
}

  export type UnitResponse = {
    unit_type: string
    system_unit: string
    units: string[]
  }

  export type PropType = "physical" | "mechanical" | "hardness";

export type TemperatureSelectionColumn = {
  key: string;
  label: string;
  unit: string;
  unit_type?: string | null;
};

export type TemperatureSelectionRow = {
  material_id: string;
  material_name: string;
  strength_category: string;
  source: string;
  max_temp?: string | number | null;
  temperature_comment?: string | null;
  category_index?: number | null;
  source_ref_id?: string | null;
  values: Record<string, number | string | null>;
};

export type TemperatureSelectionRequest = {
  prop_type: PropType;
  temperature: number;
  area?: string | null;      
  areas?: string[] | null;   
};

export type TemperatureSelectionResponse = {
  prop_type: PropType;
  temperature: number;
  area: string | null;
  columns: TemperatureSelectionColumn[];
  rows: TemperatureSelectionRow[];
};