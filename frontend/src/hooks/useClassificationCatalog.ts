import { useQuery } from "@tanstack/react-query";
import { getClassificationCatalog } from "../api/classification";

export function useClassificationCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["classification-catalog"],
    queryFn: getClassificationCatalog,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });
}
