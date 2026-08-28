import { test, expect } from "./test";
import { openTemperatureSelectionTab } from "./helpers/selection";
import { selectCalculationMaterial } from "./helpers/calculation";
import { selectMaterialByName } from "./helpers/editor";

test.describe("E2E: tab keep-alive (1.4)", () => {
  test("keeps filters, selected material, chem scenario and editor draft", async ({
    page,
  }) => {
    await openTemperatureSelectionTab(page);
    await page.locator("#temperature-input").fill("55");

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
});
