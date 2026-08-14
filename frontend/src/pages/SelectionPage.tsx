import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  NavLink,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { TempSelectionTab } from "./TempSelectionTab";
import { SepCalculationTab } from "./SepCalculationTab";
import { TabTour, type TourStep } from "../components/TabTour";
import { ASHBY_TOUR_STEPS } from "../tours/ashbyTour";
import { COMPARE_PROPS_TOUR_STEPS } from "../tours/comparePropsTour";
import { ChemComparisonTab } from "./ChemComparisonTab";

const AshbyTab = lazy(() =>
  import("./AshbyTab").then((module) => ({ default: module.AshbyTab })),
);
const ComparePropsTab = lazy(() =>
  import("./ComparePropsTab").then((module) => ({
    default: module.ComparePropsTab,
  })),
);

function selectionSubtabClass({ isActive }: { isActive: boolean }) {
  return isActive ? "editor-subtab active" : "editor-subtab";
}

/** Тур для текущей субвкладки подбора. */
function tourStepsForPath(pathname: string): TourStep[] | null {
  if (pathname.includes("/selection/ashby")) {
    return ASHBY_TOUR_STEPS;
  }
  if (pathname.includes("/selection/compare-props")) {
    return COMPARE_PROPS_TOUR_STEPS;
  }
  return null;
}

function tourLabelForPath(pathname: string): string {
  if (pathname.includes("/selection/ashby")) {
    return "Обучение по вкладке Диаграмма Эшби";
  }
  if (pathname.includes("/selection/compare-props")) {
    return "Обучение по вкладке Сравнение материалов (свойства)";
  }
  if (pathname.includes("/selection/compare-chem")) {
    return "Обучение по вкладке Сравнение материалов (хим. состав)";
  }
  if (pathname.includes("/selection/calc")) {
    return "Обучение по вкладке Расчёт отдельно";
  }
  if (pathname.includes("/selection/temperature")) {
    return "Обучение по вкладке Подбор по температуре";
  }
  return "Обучение";
}

export function SelectionPage() {
  const location = useLocation();
  const [tourOpen, setTourOpen] = useState(false);

  const tourSteps = useMemo(
    () => tourStepsForPath(location.pathname),
    [location.pathname],
  );
  const tourAvailable = Boolean(tourSteps && tourSteps.length > 0);
  const helpLabel = tourLabelForPath(location.pathname);

  useEffect(() => {
    setTourOpen(false);
  }, [location.pathname]);

  return (
    <div className="selection-page">
      <nav className="editor-subtabs editor-subtabs--with-help">
        <div className="editor-subtabs-links">
          <NavLink to="/selection/temperature" className={selectionSubtabClass}>
            Подбор по температуре
          </NavLink>
          <NavLink to="/selection/calc" className={selectionSubtabClass}>
            Расчёт отдельно
          </NavLink>
          <NavLink to="/selection/compare-props" className={selectionSubtabClass}>
            Сравнение материалов (свойства)
          </NavLink>
          <NavLink to="/selection/compare-chem" className={selectionSubtabClass}>
            Сравнение материалов (хим. состав)
          </NavLink>
          <NavLink to="/selection/ashby" className={selectionSubtabClass}>
            Диаграмма Эшби
          </NavLink>
        </div>
        <button
          type="button"
          className="tab-tour-help-btn"
          title={
            tourAvailable ? helpLabel : "Обучение для этой вкладки пока недоступно"
          }
          aria-label={helpLabel}
          disabled={!tourAvailable}
          onClick={() => {
            if (tourAvailable) {
              setTourOpen(true);
            }
          }}
        >
          ?
        </button>
      </nav>

      <Routes>
        <Route index element={<Navigate to="temperature" replace />} />
        <Route path="temperature" element={<TempSelectionTab />} />
        <Route path="calc" element={<SepCalculationTab />} />
        <Route
          path="compare-props"
          element={
            <Suspense fallback={<p className="tab-placeholder">Загрузка…</p>}>
              <ComparePropsTab />
            </Suspense>
          }
        />
        <Route path="compare-chem" element={<ChemComparisonTab />} />
        <Route
          path="ashby"
          element={
            <Suspense fallback={<p className="tab-placeholder">Загрузка…</p>}>
              <AshbyTab />
            </Suspense>
          }
        />
      </Routes>

      {tourSteps && (
        <TabTour
          open={tourOpen}
          steps={tourSteps}
          onClose={() => setTourOpen(false)}
        />
      )}
    </div>
  );
}