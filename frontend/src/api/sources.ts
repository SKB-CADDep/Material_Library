import { api } from "./client";
import type { SourcesResponse } from "../types/api";

export async function getSources(): Promise<SourcesResponse>{
    const {data} = await api.get<SourcesResponse>("/sources");
    return data;
}
