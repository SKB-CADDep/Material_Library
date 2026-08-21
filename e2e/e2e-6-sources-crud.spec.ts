import { test, expect } from "./test";
import {
  confirmSourceDelete,
  openCreateSourceDialog,
  openSourcesPage,
  sourceRow,
  submitSourceForm,
  waitForSourceAbsentFromTable,
  waitForSourceInTable,
} from "./helpers/sources";

const SOURCE_NAME = "E2E-6 Source A";
const EDITED_NAME = "E2E-6 Source B";
const SOURCE_DESCRIPTION = "E2E-6 CRUD smoke";

test.describe("E2E-6: sources create → edit → delete", () => {
  test("creates property source, edits name, deletes unused source", async ({
    page,
  }) => {
    await openSourcesPage(page);

    await expect(
      page.getByRole("tab", { name: /Источник свойств/ }),
    ).toHaveAttribute("aria-selected", "true");

    await openCreateSourceDialog(page);
    await page.locator("#name_source").fill(SOURCE_NAME);
    await page.locator("#description").fill(SOURCE_DESCRIPTION);
    await page.locator("#hyperlink").fill("https://example.com/e2e-6");
    await submitSourceForm(page, "create");

    await expect(page.locator(".dialog-overlay")).toHaveCount(0);
    await waitForSourceInTable(page, SOURCE_NAME);

    const row = sourceRow(page, SOURCE_NAME);
    await expect(row).toContainText(SOURCE_DESCRIPTION);
    await row.getByLabel("Редактировать").click();

    await expect(
      page.getByRole("heading", { name: "Редактирование источника" }),
    ).toBeVisible();
    await page.locator("#name_source").fill(EDITED_NAME);
    await submitSourceForm(page, "edit");

    await waitForSourceInTable(page, EDITED_NAME);
    await waitForSourceAbsentFromTable(page, SOURCE_NAME);

    const editedRow = sourceRow(page, EDITED_NAME);
    const usageCheck = page.waitForResponse(
      (res) => res.url().includes("/usage") && res.ok(),
    );
    await editedRow.getByLabel("Удалить").click();
    await usageCheck;

    await expect(
      page.getByRole("heading", { name: "Подтверждение удаления" }),
    ).toBeVisible();
    await expect(page.getByText(`«${EDITED_NAME}»`)).toBeVisible();

    await confirmSourceDelete(page);

    await expect(page.locator(".dialog-overlay")).toHaveCount(0);
    await waitForSourceAbsentFromTable(page, EDITED_NAME);
  });
});
