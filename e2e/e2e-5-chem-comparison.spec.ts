import { test, expect } from "./test";
import {
  addChemTargetRow,
  fillChemTargetRow,
  openChemComparisonTab,
  selectChemMaterial,
  switchToChemTargetScenario,
  waitForChemPivotTable,
  waitForChemTargetResults,
} from "./helpers/chemComparison";

const FIXTURE_MATERIAL = "FixtureFull";
const FIXTURE_CHEM_SOURCE = "Fixture chemical source";

test.describe("E2E-5: chem comparison pivot + sources; target → results", () => {
  test("shows pivot and sources for material; target selection yields full match", async ({
    page,
  }) => {
    await openChemComparisonTab(page);

    await expect(
      page.getByRole("button", { name: "По стандартам для материала" }),
    ).toHaveClass(/active/);

    await selectChemMaterial(page, FIXTURE_MATERIAL);
    await waitForChemPivotTable(page);

    const pivot = page.locator(".chem-comparison-pivot-table");
    await expect(pivot).toContainText("C");
    await expect(pivot).toContainText("Mn");
    await expect(pivot).toContainText("0.17 - 0.24");
    await expect(pivot).toContainText("0.35 - 0.65");

    const sources = page.locator(".chem-comparison-sources-table");
    await expect(sources).toContainText(FIXTURE_CHEM_SOURCE);
    await expect(sources).toContainText("Fe");

    await switchToChemTargetScenario(page);

    await fillChemTargetRow(page, 0, "C", "0.20");
    await addChemTargetRow(page);
    await fillChemTargetRow(page, 1, "Mn", "0.50");

    await waitForChemTargetResults(page, FIXTURE_MATERIAL);

    const resultRow = page
      .locator(".chem-target-results-table tbody tr")
      .filter({ hasText: FIXTURE_MATERIAL });
    await expect(resultRow).toContainText(FIXTURE_CHEM_SOURCE);
    await expect(resultRow).toContainText("Fe");
    await expect(resultRow).toContainText("Полное совпадение");
    await expect(resultRow).toContainText("2");

    const details = page.locator(".chem-target-details-table");
    await expect(details.locator("tbody tr").filter({ hasText: "C" })).toContainText(
      "в диапазоне",
    );
    await expect(details.locator("tbody tr").filter({ hasText: "Mn" })).toContainText(
      "в диапазоне",
    );
  });
});
