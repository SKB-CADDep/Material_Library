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

  export type SourcesResponse = {
    property_sources: Array<Record<string, string>>;
    strength_sources: Array<Record<string, string>>;
    chemical_sources: Array<Record<string, string>>;
  };