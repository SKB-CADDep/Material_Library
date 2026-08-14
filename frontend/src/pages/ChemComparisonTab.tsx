import { useState } from "react";
import { ChemComparisonScenario1Tab } from "./ChemComparisonScenario1Tab";
import { ChemComparisonScenario2Tab } from "./ChemComparisonScenario2Tab";

type ChemScenario = "standards" | "target";

function scenarioTabClass(isActive: boolean): string {
  return isActive
    ? "chem-comparison-subtab active"
    : "chem-comparison-subtab";
}

export function ChemComparisonTab() {
  const [scenario, setScenario] = useState<ChemScenario>("standards");

  return (
    <div className="chem-comparison-tab">
      <nav className="chem-comparison-subtabs" aria-label="Сценарии сравнения состава">
        <button
          type="button"
          className={scenarioTabClass(scenario === "standards")}
          onClick={() => setScenario("standards")}
        >
          По стандартам для материала
        </button>
        <button
          type="button"
          className={scenarioTabClass(scenario === "target")}
          onClick={() => setScenario("target")}
        >
          Подбор по целевому составу
        </button>
      </nav>

      {scenario === "standards" ? (
        <ChemComparisonScenario1Tab />
      ) : (
        <ChemComparisonScenario2Tab />
      )}
    </div>
  );
}
