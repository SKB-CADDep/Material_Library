import { test, expect } from "./test";
import { openEditorTab, selectMaterialByName } from "./helpers/editor";


const FIXTURE_MATERIALS = ["FixtureFull", "FixtureKpOnly", "Z-FixtureBare"];

test.describe("E2E-1: workspace + editor materials select", () => {
  test("auto-opened workspace lists fixture materials in editor select", async ({
    page,
  }) => {
    await openEditorTab(page);

    const materialSelect = page.locator("#material-select");
    await expect(materialSelect).toBeVisible();

    for (const name of FIXTURE_MATERIALS) {
      await expect(materialSelect.locator("option", { hasText: name })).toHaveCount(
        1,
      );
    }

    await selectMaterialByName(page, "FixtureFull");
    await expect(page.getByText("Только просмотр")).toBeVisible();
    await expect(page.locator("#name-standard")).toHaveValue("FixtureFull");
  });
});
