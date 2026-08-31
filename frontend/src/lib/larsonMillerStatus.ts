export type LarsonMillerChartEmptyReason =
  | "missing-c"
  | "missing-table"
  | "missing-both";

type LarsonMillerChartData = {
  table_points: unknown[];
  chart_curve?: unknown[];
  chart_calc_point?: { stress?: number | null } | null;
};

export function resolveLarsonMillerChartEmptyReason(
  data: LarsonMillerChartData | null,
  hasConstantC: boolean,
): LarsonMillerChartEmptyReason | null {
  if (!data) {
    return null;
  }

  const hasSeries =
    (data.chart_curve?.length ?? 0) > 0 ||
    data.chart_calc_point?.stress != null;
  if (hasSeries) {
    return null;
  }

  const hasTable = data.table_points.length > 0;
  if (!hasConstantC && !hasTable) {
    return "missing-both";
  }
  if (!hasConstantC) {
    return "missing-c";
  }
  if (!hasTable) {
    return "missing-table";
  }
  return "missing-c";
}

export function larsonMillerChartEmptyMessage(
  reason: LarsonMillerChartEmptyReason,
): string {
  switch (reason) {
    case "missing-c":
      return "График не построен: не задана константа C в «Общих данных» материала.";
    case "missing-table":
      return "График не построен: нет табличных данных σдп для выбранного базового срока службы.";
    case "missing-both":
      return "График не построен: задайте C в «Общих данных» и выберите срок с данными σдп (или «Другое»).";
  }
}
