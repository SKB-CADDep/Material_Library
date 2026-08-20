import { defineConfig } from "vitest/config";

const CORE_LIB_MODULES = [
  "applicationAreaFilter.ts",
  "calculationTemperature.ts",
  "chemComparisonPivot.ts",
  "chemTargetSelection.ts",
  "chemicalEffectiveBounds.ts",
  "columnUnits.ts",
  "elementsCatalog.ts",
  "formatChemElementValue.ts",
  "formatSelectionCellValue.ts",
  "ntdFilter.ts",
  "resolveCompositionSourceLabel.ts",
  "sortCalculationRows.ts",
  "sortSelectionRows.ts",
  "sourceLink.ts",
  "strengthCategory.ts",
  "unitConversion.ts",
] as const;

const coverageInclude = CORE_LIB_MODULES.map(
  (name) => `src/lib/${name}`,
);

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      enabled: false,
      include: coverageInclude,
      exclude: ["src/lib/**/*.test.ts"],
      reporter: ["text", "text-summary"],
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 60,
      },
    },
  },
});
