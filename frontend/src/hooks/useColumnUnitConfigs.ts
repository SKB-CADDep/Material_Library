import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getUnits } from "../api/units";
import type { SingleCalculationColumn, UnitResponse } from "../types/api";

export function useColumnUnitConfigs(columns: SingleCalculationColumn[]) {
  const unitTypes = useMemo(() => {
    const types = new Set<string>();
    for (const col of columns) {
      if (col.unit_type) {
        types.add(col.unit_type);
      }
    }
    return [...types];
  }, [columns]);

  const queries = useQueries({
    queries: unitTypes.map((unitType) => ({
      queryKey: ["units", unitType],
      queryFn: () => getUnits(unitType),
      staleTime: Infinity,
    })),
  });

  const configs = useMemo(() => {
    const map: Record<string, UnitResponse> = {};
    unitTypes.forEach((unitType, index) => {
      const data = queries[index]?.data;
      if (data) {
        map[unitType] = data;
      }
    });
    return map;
  }, [unitTypes, queries]);

  const isLoading = queries.some((query) => query.isLoading);

  return { configs, isLoading };
}
