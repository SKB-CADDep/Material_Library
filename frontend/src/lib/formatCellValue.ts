export function formatCellValue(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    if (typeof value === "number") {
      return Number.isInteger(value) ? String(value) : value.toPrecision(4);
    }
    return String(value);
  }