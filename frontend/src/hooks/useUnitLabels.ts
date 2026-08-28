import { useQuery } from "@tanstack/react-query";
import { getUnits } from "../api/units";

export function useUnitLabels(unitType: string) {
  const { data } = useQuery({
    queryKey: ["units", unitType],
    queryFn: () => getUnits(unitType),
    enabled: Boolean(unitType),
  });

  const labels = data?.display_labels ?? {};
  return { labels };
}