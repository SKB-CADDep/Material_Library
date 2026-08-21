import { expect, type Page } from "@playwright/test";

export async function openEditorTab(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(".workspace-info")).toContainText("материалов");
  await page
    .getByRole("link", { name: "Добавление / Редактирование" })
    .click();
  await expect(page).toHaveURL(/\/editor/);
}

export async function selectMaterialByName(
  page: Page,
  materialName: string,
): Promise<void> {
  const materialSelect = page.locator("#material-select");
  await expect(materialSelect).toBeVisible();
  await materialSelect.selectOption({ label: materialName });
}

export async function startEditing(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Редактировать" }).click();
  await expect(page.getByText("Только просмотр")).toHaveCount(0);
}
