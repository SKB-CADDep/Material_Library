import { api } from "./client";

export type HelpDocumentId = "about" | "instruction" | "changelog";

export type HelpDocumentMeta = {
  id: HelpDocumentId;
  title: string;
};

export async function listHelpDocuments(): Promise<HelpDocumentMeta[]> {
  const { data } = await api.get<HelpDocumentMeta[]>("/help");
  return data;
}

export async function getHelpDocument(id: HelpDocumentId): Promise<string> {
  const { data } = await api.get<string>(`/help/${id}`, {
    responseType: "text",
  });
  return data;
}
