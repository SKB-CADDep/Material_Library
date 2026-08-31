import { test, expect } from "./test";
import { openTemperatureSelectionTab } from "./helpers/selection";
import {
  addCustomCalculationTemperature,
  selectCalculationMaterial,
} from "./helpers/calculation";
import {
  openEditorTab,
  selectMaterialByName,
  startEditing,
} from "./helpers/editor";

test.describe("E2E: tab keep-alive (1.4)", () => {
  test("keeps filters, selected material, chem scenario and editor draft", async ({
    page,
  }) => {
    await openTemperatureSelectionTab(page);
    await page.locator("#temperature-input").fill("55");
    await page.locator("#temperature-input").press("Enter");

    await page.getByRole("link", { name: "Расчёт отдельно" }).click();
    await expect(page).toHaveURL(/\/selection\/calc/);
    await selectCalculationMaterial(page, "FixtureFull");
    const calcMaterialId = await page.locator("#sep-material-select").inputValue();
    expect(calcMaterialId).not.toBe("");

    await page.getByRole("link", { name: "Подбор по температуре" }).click();
    await expect(page.locator("#temperature-input")).toHaveValue("55");

    await page.getByRole("link", { name: "Расчёт отдельно" }).click();
    await expect(page.locator("#sep-material-select")).toHaveValue(calcMaterialId);

    await page.getByRole("link", { name: "Добавление / Редактирование" }).click();
    await expect(page).toHaveURL(/\/editor/);
    await selectMaterialByName(page, "FixtureFull");
    await expect(page.locator("#name-standard")).toHaveValue("FixtureFull");

    await page.getByRole("link", { name: "Подбор материала" }).click();
    await page.getByRole("link", { name: "Добавление / Редактирование" }).click();
    await expect(page.locator("#name-standard")).toHaveValue("FixtureFull");

    await page.getByRole("link", { name: "Подбор материала" }).click();
    await page
      .getByRole("link", { name: "Сравнение материалов (хим. состав)" })
      .click();
    await expect(page).toHaveURL(/\/selection\/compare-chem/);
    await page.getByRole("button", { name: "Подбор по целевому составу" }).click();
    await expect(
      page.getByRole("button", { name: "Подбор по целевому составу" }),
    ).toHaveClass(/active/);

    await page.getByRole("link", { name: "Подбор по температуре" }).click();
    await expect(page.locator("#temperature-input")).toHaveValue("55");
    await page
      .getByRole("link", { name: "Сравнение материалов (хим. состав)" })
      .click();
    await expect(
      page.getByRole("button", { name: "Подбор по целевому составу" }),
    ).toHaveClass(/active/);
  });

  test("keeps editor sub-tab and draft across main tabs", async ({ page }) => {
    await openEditorTab(page);
    await selectMaterialByName(page, "FixtureFull");
    await startEditing(page);

    const comment = "E2E keep-alive draft comment";
    await page.locator("#comment").fill(comment);

    await page.getByRole("link", { name: "Физические свойства" }).click();
    await expect(page).toHaveURL(/\/editor\/physical/);

    await page.getByRole("link", { name: "Подбор материала" }).click();
    await page.getByRole("link", { name: "Добавление / Редактирование" }).click();

    await expect(page).toHaveURL(/\/editor\/physical/);
    await page.getByRole("link", { name: "Общие данные" }).click();
    await expect(page.locator("#comment")).toHaveValue(comment);
  });

  test("keeps selection sub-tab when returning via main nav", async ({ page }) => {
    await openTemperatureSelectionTab(page);
    await page.getByRole("link", { name: "Диаграмма Эшби" }).click();
    await expect(page).toHaveURL(/\/selection\/ashby/);

    await page.getByRole("link", { name: "Добавление / Редактирование" }).click();
    await page.getByRole("link", { name: "Подбор материала" }).click();

    await expect(page).toHaveURL(/\/selection\/ashby/);
  });

  test("keeps calc custom temperature row across tabs", async ({ page }) => {
    await openTemperatureSelectionTab(page);
    await page.getByRole("link", { name: "Расчёт отдельно" }).click();
    await selectCalculationMaterial(page, "FixtureFull");
    await addCustomCalculationTemperature(page, "150");
    await expect(page.locator(".calculation-table-row--custom")).toHaveCount(1);

    await page.getByRole("link", { name: "Добавление / Редактирование" }).click();
    await page.getByRole("link", { name: "Подбор материала" }).click();
    await page.getByRole("link", { name: "Расчёт отдельно" }).click();

    await expect(page.locator(".calculation-table-row--custom")).toHaveCount(1);
    await expect(
      page.locator(".calculation-table-row--custom .calculation-table-col--temp"),
    ).toHaveText("150");
  });

  test("keeps larson-miller material selection across tabs", async ({ page }) => {
    await openTemperatureSelectionTab(page);
    await page.getByRole("link", { name: "Ларсон–Миллер" }).click();
    await expect(page).toHaveURL(/\/selection\/larson-miller/);

    await page.locator("#lm-material-select").selectOption({ label: "FixtureFull" });
    const materialId = await page.locator("#lm-material-select").inputValue();
    expect(materialId).not.toBe("");

    await page.getByRole("link", { name: "Подбор по температуре" }).click();
    await page.getByRole("link", { name: "Ларсон–Миллер" }).click();

    await expect(page.locator("#lm-material-select")).toHaveValue(materialId);
  });
});
