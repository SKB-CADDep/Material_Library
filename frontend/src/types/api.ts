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