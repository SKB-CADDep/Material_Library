import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { LARSON_MILLER_TOUR_STEPS } from "../tours/larsonMillerTour";
import { TEMP_SELECTION_TOUR_STEPS } from "../tours/tempSelectionTour";
import { SEP_CALCULATION_TOUR_STEPS } from "../tours/sepCalculationTour";
import { ChemComparisonTab } from "./ChemComparisonTab";
import { CHEM_COMPARISON_TOUR_STEPS } from "../tours/chemComparisonTour";

const LarsonMillerTab = lazy(() =>
  import("./LarsonMillerTab").then((module) => ({
    default: module.LarsonMillerTab,
  })),
);

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
  if (pathname.includes("/selection/temperature")) {
    return TEMP_SELECTION_TOUR_STEPS;
  }
  if (pathname.includes("/selection/calc")) {
    return SEP_CALCULATION_TOUR_STEPS;
  }
  if (pathname.includes("/selection/ashby")) {
    return ASHBY_TOUR_STEPS;
  }
  if (pathname.includes("/selection/compare-props")) {
    return COMPARE_PROPS_TOUR_STEPS;
  }
  if (pathname.includes("/selection/compare-chem")) {
    return CHEM_COMPARISON_TOUR_STEPS;
  }
  if (pathname.includes("/selection/larson-miller")) {
    return LARSON_MILLER_TOUR_STEPS;
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
  if (pathname.includes("/selection/larson-miller")) {
    return "Обучение по вкладке Ларсон–Миллер";
  }
  return "Обучение";
}

export function SelectionPage() {
  const location = useLocation();
  const [tourOpen, setTourOpen] = useState(false);
  const prevTourOpenRef = useRef(false);

  const tourSteps = useMemo(
    () => tourStepsForPath(location.pathname),
    [location.pathname],
  );
  const tourAvailable = Boolean(tourSteps && tourSteps.length > 0);
  const helpLabel = tourLabelForPath(location.pathname);

  useEffect(() => {
    setTourOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const isLarsonPage = location.pathname.includes("/selection/larson-miller");
    const isChemPage = location.pathname.includes("/selection/compare-chem");

    if (!isLarsonPage && !isChemPage) {
      prevTourOpenRef.current = tourOpen;
      return;
    }

    const prev = prevTourOpenRef.current;
    if (!prev && tourOpen) {
      if (isLarsonPage) {
        window.dispatchEvent(new CustomEvent("larsonMillerTourStart"));
      } else if (isChemPage) {
        window.dispatchEvent(new CustomEvent("chemComparisonTourStart"));
      }
    }
    if (prev && !tourOpen) {
      if (isLarsonPage) {
        window.dispatchEvent(new CustomEvent("larsonMillerTourEnd"));
      } else if (isChemPage) {
        window.dispatchEvent(new CustomEvent("chemComparisonTourEnd"));
      }
    }
    prevTourOpenRef.current = tourOpen;
  }, [location.pathname, tourOpen]);

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
          <NavLink to="/selection/larson-miller" className={selectionSubtabClass}>
            Ларсон–Миллер
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
        <Route
          path="larson-miller"
          element={
            <Suspense fallback={<p className="tab-placeholder">Загрузка…</p>}>
              <LarsonMillerTab />
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