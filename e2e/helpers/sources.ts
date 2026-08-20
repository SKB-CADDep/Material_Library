import { expect, type Page } from "@playwright/test";

export async function openSourcesPage(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(".workspace-info")).toContainText("материалов");
  await page.getByRole("link", { name: "Работа с источниками" }).click();
  await expect(page).toHaveURL(/\/sources/);
  await expect(page.locator(".data-table--sources")).toBeVisible({
    timeout: 15_000,
  });
}

export function sourceRow(page: Page, name: string) {
  return page
    .locator(".data-table--sources tbody tr")
    .filter({ has: page.locator(".col-name", { hasText: name }) });
}

export async function waitForSourceInTable(
  page: Page,
  name: string,
): Promise<void> {
  await expect(sourceRow(page, name)).toHaveCount(1, { timeout: 15_000 });
}

export async function waitForSourceAbsentFromTable(
  page: Page,
  name: string,
): Promise<void> {
  await expect(sourceRow(page, name)).toHaveCount(0, { timeout: 15_000 });
}

export async function openCreateSourceDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "+ Добавить источник" }).click();
  await expect(
    page.getByRole("heading", { name: "Добавление источника" }),
  ).toBeVisible();
}

export async function submitSourceForm(
  page: Page,
  mode: "create" | "edit",
): Promise<void> {
  const label = mode === "create" ? "Создать" : "Сохранить";
  const method = mode === "create" ? "POST" : "PUT";
  const response = page.waitForResponse(
    (res) =>
      res.url().includes("/api/sources") &&
      res.request().method() === method &&
      res.ok(),
  );
  await page.getByRole("button", { name: label, exact: true }).click();
  await response;
}

export async function confirmSourceDelete(page: Page): Promise<void> {
  const deleteResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/sources/") &&
      res.request().method() === "DELETE" &&
      res.ok(),
  );
  await page
    .locator(".dialog-footer")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await deleteResponse;
}
