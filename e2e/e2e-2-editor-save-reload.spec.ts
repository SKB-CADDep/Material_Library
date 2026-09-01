import { test, expect } from "./test";
import {
  openEditorTab,
  selectMaterialByName,
  startEditing,
} from "./helpers/editor";

const SAVED_MATERIAL_NAME = "FixtureFull E2E2";
const SAVED_COMMENT = "E2E-2 persisted comment";

test.describe("E2E-2: editor save survives reload", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.prompt = (_message, defaultValue) => defaultValue ?? "saved.json";
    });
  });

  test("edit field, save, reload — value persists", async ({ page }) => {
    await openEditorTab(page);
    await selectMaterialByName(page, "FixtureFull");
    await expect(page.locator("#name-standard")).toHaveValue("FixtureFull");

    await startEditing(page);
    await expect(page.getByRole("button", { name: "Сохранить" })).toBeEnabled();

    await page.locator("#name-standard").fill(SAVED_MATERIAL_NAME);
    await page.locator("#comment").fill(SAVED_COMMENT);

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/materials") &&
        response.request().method() === "POST" &&
        response.ok(),
    );

    await page.getByRole("button", { name: "Сохранить" }).click();

    await saveResponse;
    await expect(page.getByText("успешно сохранён")).toBeVisible();
    await expect(page.locator(".workspace-info")).toContainText("3 материалов");

    await page.reload();
    await openEditorTab(page);

    await selectMaterialByName(page, "FixtureFull E2E2");
    await expect(page.locator("#name-standard")).toHaveValue(SAVED_MATERIAL_NAME);
    await expect(page.locator("#comment")).toHaveValue(SAVED_COMMENT);
  });
});
