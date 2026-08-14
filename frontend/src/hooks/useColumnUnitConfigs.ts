import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getUnits } from "../api/units";
import { TEMPERATURE_UNIT_TYPE } from "../lib/calculationColumnHeader";
import type { UnitResponse } from "../types/api";

type UseColumnUnitConfigsOptions = {
  includeTemperature?: boolean;
};

export function useColumnUnitConfigs(
  columns: Array<{unit_type?: string|null}>,
  options: UseColumnUnitConfigsOptions = {},
) {
  const unitTypes = useMemo(() => {
    const types = new Set<string>();
    if (options.includeTemperature) {
      types.add(TEMPERATURE_UNIT_TYPE);
    }
    for (const col of columns) {
      if (col.unit_type) {
        types.add(col.unit_type);
      }
    }
    return [...types];
  }, [columns, options.includeTemperature]);

  const queries = useQueries({
    queries: unitTypes.map((unitType) => ({
      queryKey: ["units", unitType],
      queryFn: () => getUnits(unitType),
      staleTime: Infinity,
    })),
  });

  const unitDataKey = queries
    .map((query, index) =>
      query.data
        ? `${unitTypes[index]}:${query.dataUpdatedAt}`
        : `${unitTypes[index]}:pending`,
    )
    .join("|");

  const configs = useMemo(() => {
    const map: Record<string, UnitResponse> = {};
    unitTypes.forEach((unitType, index) => {
      const data = queries[index]?.data;
      if (data) {
        map[unitType] = data;
      }
    });
    return map;
  }, [unitTypes, unitDataKey, queries]);

  const isLoading = queries.some((query) => query.isLoading);

  return { configs, isLoading };
}
