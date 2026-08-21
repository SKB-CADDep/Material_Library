import { expect, type Page } from "@playwright/test";

export async function openTemperatureSelectionTab(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(".workspace-info")).toContainText("материалов");
  await expect(page).toHaveURL(/\/selection/);
  await page.getByRole("link", { name: "Подбор по температуре" }).click();
  await expect(page).toHaveURL(/\/selection\/temperature/);
}

export async function waitForSelectionTableRows(
  page: Page,
  minRows = 1,
): Promise<void> {
  await expect(page.locator(".selection-table")).toBeVisible();
  await expect(page.locator(".selection-table tbody tr")).toHaveCount(minRows, {
    timeout: 15_000,
  });
}

export async function materialNamesInTable(page: Page): Promise<string[]> {
  const texts = await page
    .locator("tbody tr .selection-table-col--material")
    .allTextContents();
  return texts.map((text) => text.trim()).filter(Boolean);
}
