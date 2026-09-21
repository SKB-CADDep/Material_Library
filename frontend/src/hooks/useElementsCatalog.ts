import { useQuery } from "@tanstack/react-query";
import { getElementsCatalog } from "../api/elements";
import { ELEMENTS_QUERY_KEY } from "../lib/elementsCatalogCache";
import { applyElementsCatalog } from "../lib/elementsCatalog";

export function useElementsCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ELEMENTS_QUERY_KEY,
    queryFn: async () => {
      const data = await getElementsCatalog();
      applyElementsCatalog(data);
      return data;
    },
    staleTime: 0,
    retry: false,
    enabled: options?.enabled ?? true,
  });
}
