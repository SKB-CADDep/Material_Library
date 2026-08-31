import { test, expect } from "./test";
import {
  addCustomCalculationTemperature,
  customRowCellByColumnKey,
  dbTemperaturesInTable,
  openCalculationTab,
  selectCalculationMaterial,
  waitForCalculationDbRows,
  waitForCustomCalculationRows,
} from "./helpers/calculation";

const FIXTURE_MATERIAL = "FixtureFull";
const FIXTURE_KP = "КП23";
const CUSTOM_TEMP = "150";

test.describe("E2E-4: separate calculation — material, KP, table, custom T", () => {
  test("selects material and KP, shows db rows, adds custom temperature row", async ({
    page,
  }) => {
    await openCalculationTab(page);

    await selectCalculationMaterial(page, FIXTURE_MATERIAL);
    await expect(page.locator("#sep-strength-category-select")).toHaveValue(FIXTURE_KP);
    await expect(page.locator("#strength_category_ntd_select")).toBeDisabled();

    await waitForCalculationDbRows(page, 4);
    expect(await dbTemperaturesInTable(page)).toEqual(["20", "100", "200", "300"]);

    await expect(page.locator(".calculation-table thead")).toContainText("T");

    await addCustomCalculationTemperature(page, CUSTOM_TEMP);
    await waitForCustomCalculationRows(page, 1);

    await expect(page.locator(".calculation-table-separator")).toContainText("РАСЧЁТ");

    const customRow = page.locator(".calculation-table-row--custom").first();
    await expect(customRow.locator(".calculation-table-col--temp")).toHaveText(
      CUSTOM_TEMP,
    );
    const yieldCell = customRowCellByColumnKey(page, "yield_strength");
    await expect(yieldCell.locator(".calculation-cell--interp")).toHaveText("218.5");
    await expect(yieldCell.locator(".calculation-cell--interp")).toHaveAttribute(
      "title",
      "Рассчитано интерполяцией между точками",
    );
  });
});
