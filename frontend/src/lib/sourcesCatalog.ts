import type { QueryClient } from "@tanstack/react-query";

export const SOURCES_QUERY_KEY = ["sources"] as const;

export async function refreshSourcesAfterCrud(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.refetchQueries({ queryKey: SOURCES_QUERY_KEY });
  await queryClient.invalidateQueries({ queryKey: ["selection"] });
}
