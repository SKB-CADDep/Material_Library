import { useQuery } from "@tanstack/react-query";
import { getSources } from "../api/sources";
import { SOURCES_QUERY_KEY } from "../lib/sourcesCatalog";

export function useSourcesCatalog() {
  return useQuery({
    queryKey: SOURCES_QUERY_KEY,
    queryFn: getSources,
    staleTime: 0,
    retry: false,
  });
}
