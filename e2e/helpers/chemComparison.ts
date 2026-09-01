import { expect, type Page } from "@playwright/test";

export async function openChemComparisonTab(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(".workspace-info")).toContainText("материалов");
  await expect(page).toHaveURL(/\/selection/);
  await page
    .getByRole("link", { name: "Сравнение материалов (хим. состав)" })
    .click();
  await expect(page).toHaveURL(/\/selection\/compare-chem/);
}

export async function selectChemMaterial(page: Page, name: string): Promise<void> {
  await page.locator(".chem-comparison-material-btn", { hasText: name }).click();
}

export async function waitForChemPivotTable(page: Page): Promise<void> {
  await expect(page.locator(".chem-comparison-pivot-table")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.locator(".chem-comparison-pivot-table tbody tr"),
  ).not.toHaveCount(0, { timeout: 15_000 });
}

export async function switchToChemTargetScenario(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "Подбор по целевому составу" })
    .click();
  await expect(page.locator(".chem-target-table")).toBeVisible();
}

export async function fillChemTargetRow(
  page: Page,
  rowIndex: number,
  element: string,
  target: string,
): Promise<void> {
  const row = page.locator(".chem-target-table tbody tr").nth(rowIndex);
  await row.locator("td").nth(0).getByRole("button", { name: "Элемент" }).click();
  await page.locator(`[data-element="${element}"]`).click();
  await row.locator("td").nth(1).locator("input").fill(target);
}

export async function addChemTargetRow(page: Page): Promise<void> {
  await page.getByTitle("Добавить строку").click();
}

export async function waitForChemTargetResults(
  page: Page,
  materialName: string,
): Promise<void> {
  const resultRow = page
    .locator(".chem-target-results-table tbody tr")
    .filter({ hasText: materialName });
  await expect(resultRow).toBeVisible({ timeout: 15_000 });
}
