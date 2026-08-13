export type WorkspaceResponse = {
    directory: string;
    count: number;
    application_areas: string[];
};

export type HealthResponse = {
  status: string;
  workspace: string | null;
  materials_dir: string | null;
};

export type WorkspacePlaceholderMode = "manual" | "waiting";

export type MaterialSummary = {
id: string;
name: string;
areas: string[];
filename: string;
};

export interface SourceItem {
  id_source: string;
  name_source: string;
  description: string;
  hyperlink: string;
  user_name_change: string;
  data_change: string;
  user_name_found: string;
  data_found: string;
}

export type SourcesResponse = {
  property_sources: SourceItem[];
  strength_sources: SourceItem[];
  chemical_sources: SourceItem[];
};

export type SourceUsageResponse = {
  count: number;
  examples: string[];
};

export type TabType =
  | "property_sources"
  | "strength_sources"
  | "chemical_sources";


export type SourcesTabType = TabType;


export type MaterialSaveResponse = {
  ok: boolean;
  filename: string;
};

export type ClassificationClassItem = {
  name: string;
  subclasses: string[];
};

export type ClassificationCategoryItem = {
  name: string;
  classes: ClassificationClassItem[];
};

export type ClassificationResponse = {
  categories: ClassificationCategoryItem[];
};

  export type UnitFactor = number | "offset_k" | "offset_f";

  export type UnitResponse = {
    unit_type: string;
    system_unit: string;
    units: string[];
    display_labels: Record<string, string>;
    factors: Record<string, UnitFactor>;
  };

  export type PropType = "physical" | "mechanical" | "hardness";

export type TemperatureSelectionColumn = {
  key: string;
  label: string;
  unit: string;
  unit_type?: string | null;
  display_symbol?: string;
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

export type CalculationCell = {
  value: number | null;
  mode: string | null
}

export type SingleCalculationColumn = {
  key: string;
  label: string;
  display_symbol?: string;
  unit: string;
  unit_type?: string | null;
  temperature_dependent: boolean
}

export type SingleCalculationRow = {
  temperature: number | string;
  values: Record<string, CalculationCell>
};

export type SingleCalculationRequest = {
  material_id: string;
  category_index: number;
  custom_temperatures?: number[]
}

export type SingleCalculationResponse = {
    material_id: string;
    category_index: number;
    columns: SingleCalculationColumn[];
    db_rows: SingleCalculationRow[];
    custom_rows: SingleCalculationRow[]
}

export type AshbyAxisKind = "temperature" | "physical" | "mechanical";

export type AshbyAxisOption = {
  key: string;
  label: string;
  unit: string;
  unit_type?: string | null;
  kind: AshbyAxisKind;
};

export type AshbyOptionsResponse = {
  axes: AshbyAxisOption[];
  classes: string[];
};

export type AshbyRequest = {
  x_prop: string;
  y_prop: string;
  class_names: string[];
  areas?: string[] | null;
};

export type AshbyPoint = {
  x: number;
  y: number;
};

export type AshbySeries = {
  id: string;
  label: string;
  class_name: string;
  color: string;
  points: AshbyPoint[];
};

export type AshbyHull = {
  class_name: string;
  color: string;
  points: AshbyPoint[];
};

export type AshbyClassLegendItem = {
  class_name: string;
  color: string;
};

export type AshbyAxisMeta = {
  key: string;
  label: string;
  /** Дисплей-символ свойства (T, E, ρ, …). */
  symbol: string;
  unit: string;
};

export type AshbyResponse = {
  x_axis: AshbyAxisMeta;
  y_axis: AshbyAxisMeta;
  series: AshbySeries[];
  hulls: AshbyHull[];
  class_legend?: AshbyClassLegendItem[];
};

export type PropertyMeta = {
  unit_type: string;
  name: string;
  symbol: string;
  unit: string;
  temperature_dependent?: boolean;
  display_symbol?: string;
}

export type PropertiesResponse = {
    physical:  Record<string, PropertyMeta>
    mechanical:  Record<string, PropertyMeta>
}