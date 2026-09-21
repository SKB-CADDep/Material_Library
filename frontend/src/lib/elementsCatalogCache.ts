import type { QueryClient } from "@tanstack/react-query";
import { getElementsCatalog } from "../api/elements";
import { applyElementsCatalog } from "./elementsCatalog";

export const ELEMENTS_QUERY_KEY = ["catalogs", "elements"] as const;

export async function refreshElementsAfterCrud(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ELEMENTS_QUERY_KEY });
  const data = await queryClient.fetchQuery({
    queryKey: ELEMENTS_QUERY_KEY,
    queryFn: getElementsCatalog,
  });
  applyElementsCatalog(data);
}
