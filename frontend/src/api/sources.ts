import { api } from "./client";
import type { SourceResponse } from "../types/api";

export async function getSources(): Promise<SourceResponse>{
    const {data} = await api.get<SourceResponse>("/sources");
    return data;
}
