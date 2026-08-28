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
    ).toContainText("Маркировка");
    await expect(page.locator("th.selection-table-col--kp")).toContainText("КП");
    await expect(page.locator("th.selection-table-col--source")).toContainText(
      "Нормативно-техническая документация",
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

  test("keeps tприм column aligned with header after temperature change", async ({
    page,
  }) => {
    await openTemperatureSelectionTab(page);
    await waitForSelectionTableRows(page, 3);

    const assertTprimAligned = async () => {
      const header = page
        .locator(
          "thead tr:not(.table-header-resize-rail-row) th.selection-table-col--temp",
        )
        .first();
      const cell = page.locator("tbody td.selection-table-col--temp").first();
      const sourceHeader = page.locator("th.selection-table-col--source").first();

      const [headerBox, cellBox, sourceBox] = await Promise.all([
        header.boundingBox(),
        cell.boundingBox(),
        sourceHeader.boundingBox(),
      ]);

      expect(headerBox).toBeTruthy();
      expect(cellBox).toBeTruthy();
      expect(sourceBox).toBeTruthy();
      expect(Math.abs(headerBox!.x - cellBox!.x)).toBeLessThan(2);
      expect(Math.abs(headerBox!.width - cellBox!.width)).toBeLessThan(2);
      expect(Math.abs(headerBox!.x - (sourceBox!.x + sourceBox!.width))).toBeLessThan(
        2,
      );
    };

    await assertTprimAligned();

    const temperatureInput = page.locator("#temperature-input");
    await temperatureInput.fill("2");
    await temperatureInput.press("Enter");
    await waitForSelectionTableRows(page, 1);

    await assertTprimAligned();
  });

  test("keeps header and marking column visible while scrolling rows", async ({
    page,
  }) => {
    await openTemperatureSelectionTab(page);
    await waitForSelectionTableRows(page, 3);

    const viewport = page.locator(".selection-table-viewport--unified");
    await viewport.evaluate((el) => {
      (el as HTMLElement).style.maxHeight = "140px";
    });

    const header = page.locator("th.selection-table-col--material");
    const markingCell = page
      .locator("tbody td.selection-table-col--material")
      .first();
    const before = await header.boundingBox();
    expect(before).toBeTruthy();

    await viewport.evaluate((el) => {
      el.scrollTop = 80;
    });

    const after = await header.boundingBox();
    expect(after).toBeTruthy();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
    await expect(header).toContainText("Маркировка");
    await expect(markingCell).toBeVisible();
  });
});
