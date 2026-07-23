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