import { test, expect } from "./test";
import {
  materialNamesInTable,
  openTemperatureSelectionTab,
  waitForSelectionTableRows,
} from "./helpers/selection";

const FIXTURE_NTD = "Fixture property source";

test.describe("E2E-3: temperature selection table, sort, NTD filter", () => {
  test("shows table, sorts by material, filters by NTD", async ({ page }) => {
    await openTemperatureSelectionTab(page);

    await expect(page.locator("#prop-type-select")).toHaveValue("physical");
    await expect(page.locator("#temperature-input")).toHaveValue("20");

    await waitForSelectionTableRows(page, 3);

    await expect(
      page.locator("th.selection-table-col--material"),
    ).toContainText("Материал");
    await expect(page.locator("th.selection-table-col--kp")).toContainText("КП");
    await expect(page.locator("th.selection-table-col--source")).toContainText(
      "НТД",
    );

    const materialHeader = page.locator("th.selection-table-col--material");
    await materialHeader.click();
    await expect(
      page.locator("th.selection-table-col--material .sort-indicator.active"),
    ).toContainText("▲");

    const ascNames = await materialNamesInTable(page);
    expect(ascNames).toEqual(["FixtureFull", "FixtureKpOnly", "Z-FixtureBare"]);

    await materialHeader.click();
    await expect(
      page.locator("th.selection-table-col--material .sort-indicator.active"),
    ).toContainText("▼");

    const descNames = await materialNamesInTable(page);
    expect(descNames).toEqual(["Z-FixtureBare", "FixtureKpOnly", "FixtureFull"]);

    await materialHeader.click();
    await expect(
      page.locator("th.selection-table-col--material .sort-indicator.active"),
    ).toContainText("▲");

    const ntdSelect = page.locator("#ntd-filter-select");
    await expect(ntdSelect.locator("option", { hasText: FIXTURE_NTD })).toHaveCount(
      1,
    );

    await ntdSelect.selectOption(FIXTURE_NTD);
    await waitForSelectionTableRows(page, 2);
    expect(await materialNamesInTable(page)).toEqual([
      "FixtureFull",
      "FixtureKpOnly",
    ]);

    await ntdSelect.selectOption("");
    await waitForSelectionTableRows(page, 3);
  });
});
