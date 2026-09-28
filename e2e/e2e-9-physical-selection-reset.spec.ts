import { test, expect } from "./test";
import {
  openEditorTab,
  selectMaterialByName,
  startEditing,
} from "./helpers/editor";

test.describe("E2E-9: physical selection resets on material change", () => {
  test("selected T–value row highlight does not carry to another material", async ({
    page,
  }) => {
    await openEditorTab(page);
    await selectMaterialByName(page, "FixtureFull");
    await startEditing(page);

    await page.getByRole("link", { name: "Физические свойства" }).click();

    const densitySection = page.locator("fieldset.form-section", {
      has: page.locator("#density_value_unit"),
    });
    await expect(densitySection).toBeVisible();

    const firstDataRow = densitySection.locator("tbody tr").first();
    await firstDataRow.locator("input.table-cell-input").first().click();
    await expect(firstDataRow).toHaveClass(/table-row-selected/);

    await selectMaterialByName(page, "Z-FixtureBare");
    await page.getByRole("link", { name: "Физические свойства" }).click();

    const bareDensity = page.locator("fieldset.form-section", {
      has: page.locator("#density_value_unit"),
    });
    // FixtureBare может быть без строк — важен сброс selection, не наличие данных.
    await expect(page.locator("tbody tr.table-row-selected")).toHaveCount(0);
    await expect(bareDensity).toBeVisible();
  });
});
