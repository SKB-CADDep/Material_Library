import { useEffect, useMemo, useState } from "react";
import { ChemComparisonScenario1Tab } from "./ChemComparisonScenario1Tab";
import { ChemComparisonScenario2Tab } from "./ChemComparisonScenario2Tab";
import { KeepAlivePanes } from "../components/KeepAlivePanes";

type ChemScenario = "standards" | "target";

function scenarioTabClass(isActive: boolean): string {
  return isActive
    ? "chem-comparison-subtab active"
    : "chem-comparison-subtab";
}

export function ChemComparisonTab() {
  const [scenario, setScenario] = useState<ChemScenario>("standards");
  const scenarioPanes = useMemo(
    () => [
      { key: "standards", node: <ChemComparisonScenario1Tab /> },
      { key: "target", node: <ChemComparisonScenario2Tab /> },
    ],
    [],
  );

  useEffect(() => {
    function handleTourStart() {
      // Чтобы шаги тура попадали в корректный DOM.
      setScenario("standards");
    }

    function handleSetScenario(event: Event) {
      const custom = event as CustomEvent<{ scenario?: ChemScenario }>;
      const next = custom.detail?.scenario;
      if (next === "standards" || next === "target") {
        setScenario(next);
      }
    }
    window.addEventListener("chemComparisonTourStart", handleTourStart);
    window.addEventListener("chemComparisonSetScenario", handleSetScenario);
    return () => {
      window.removeEventListener(
        "chemComparisonTourStart",
        handleTourStart,
      );
      window.removeEventListener(
        "chemComparisonSetScenario",
        handleSetScenario,
      );
    };
  }, []);

  return (
    <div className="chem-comparison-tab">
      <nav className="chem-comparison-subtabs" aria-label="Сценарии сравнения состава">
        <button
          type="button"
          className={scenarioTabClass(scenario === "standards")}
          onClick={() => setScenario("standards")}
          data-tour="chem-scenario-standards"
        >
          По стандартам для материала
        </button>
        <button
          type="button"
          className={scenarioTabClass(scenario === "target")}
          onClick={() => setScenario("target")}
          data-tour="chem-scenario-target"
        >
          Подбор по целевому составу
        </button>
      </nav>

      <KeepAlivePanes activeKey={scenario} panes={scenarioPanes} />
    </div>
  );
}
