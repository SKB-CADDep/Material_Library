import { useQuery } from "@tanstack/react-query";
import { getPropertiesCatalog } from "../api/properties";

export function usePropertiesCatalog() {
  return useQuery({
    queryKey: ["properties-catalog"],
    queryFn: getPropertiesCatalog,
    staleTime: 60_000,
  });
}