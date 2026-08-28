import { expect, type Page } from "@playwright/test";

export async function openCalculationTab(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(".workspace-info")).toContainText("материалов");
  await expect(page).toHaveURL(/\/selection/);
  await page.getByRole("link", { name: "Расчёт отдельно" }).click();
  await expect(page).toHaveURL(/\/selection\/calc/);
}

export async function selectCalculationMaterial(
  page: Page,
  name: string,
): Promise<void> {
  await page.locator("#sep-material-select").selectOption({ label: name });
}

export async function waitForCalculationDbRows(
  page: Page,
  rowCount: number,
): Promise<void> {
  const dbRows = page.locator(
    ".calculation-table tbody tr:not(.calculation-table-separator):not(.calculation-table-row--custom)",
  );
  await expect(page.locator(".calculation-table")).toBeVisible({
    timeout: 15_000,
  });
  await expect(dbRows).toHaveCount(rowCount, { timeout: 15_000 });
}

export async function dbTemperaturesInTable(page: Page): Promise<string[]> {
  const texts = await page
    .locator(
      ".calculation-table tbody tr:not(.calculation-table-separator):not(.calculation-table-row--custom) .calculation-table-col--temp",
    )
    .allTextContents();
  return texts.map((text) => text.trim()).filter(Boolean);
}

export async function addCustomCalculationTemperature(
  page: Page,
  temp: string | number,
): Promise<void> {
  const response = page.waitForResponse(
    (res) =>
      res.url().includes("/api/selection/calculate") &&
      res.request().method() === "POST" &&
      res.ok(),
  );
  await page.locator("#calc-temp-input").fill(String(temp));
  await page.getByRole("button", { name: "+ Добавить расчёт" }).click();
  await response;
}

export async function waitForCustomCalculationRows(
  page: Page,
  rowCount: number,
): Promise<void> {
  await expect(page.locator(".calculation-table-row--custom")).toHaveCount(
    rowCount,
    { timeout: 15_000 },
  );
}
