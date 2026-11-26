import { test, expect } from "./test";
import {
  openEditorTab,
  selectMaterialByName,
  startEditing,
} from "./helpers/editor";

test.describe("E2E-8: unsaved guard + save lock", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.prompt = (_message, defaultValue) => defaultValue ?? "saved.json";
    });
  });

  test("discard confirm: Cancel keeps dirty draft on material switch", async ({
    page,
  }) => {
    await openEditorTab(page);
    await selectMaterialByName(page, "FixtureFull");
    await startEditing(page);

    const comment = page.locator("#comment");
    await comment.fill("dirty-unsaved-comment");

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toMatch(/несохранённ/i);
      await dialog.dismiss();
    });

    await selectMaterialByName(page, "Z-FixtureBare");

    await expect(page.locator("#name-standard")).toHaveValue("FixtureFull");
    await expect(comment).toHaveValue("dirty-unsaved-comment");
  });

  test("discard confirm: OK switches material and drops dirty draft", async ({
    page,
  }) => {
    await openEditorTab(page);
    await selectMaterialByName(page, "FixtureFull");
    await startEditing(page);
    await page.locator("#comment").fill("will-be-discarded");

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });

    await selectMaterialByName(page, "Z-FixtureBare");
    await expect(page.locator("#name-standard")).toHaveValue("Z-FixtureBare");
    await expect(page.locator("#comment")).not.toHaveValue("will-be-discarded");
  });

  test("double-click Save issues a single POST", async ({ page }) => {
    await openEditorTab(page);
    await selectMaterialByName(page, "FixtureFull");
    await startEditing(page);
    await page.locator("#comment").fill(`e2e8-double-${Date.now()}`);

    const posts: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes("/api/materials") &&
        request.method() === "POST"
      ) {
        posts.push(request.url());
      }
    });

    const saveButton = page.getByRole("button", { name: "Сохранить" });
    await expect(saveButton).toBeEnabled();

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/materials") &&
        response.request().method() === "POST" &&
        response.ok(),
    );

    await Promise.all([saveButton.click(), saveButton.click()]);
    await saveResponse;
    await expect(page.getByText("успешно сохранён")).toBeVisible();

    expect(posts.length).toBe(1);
  });
});
