import { lazy, Suspense } from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { TempSelectionTab } from "./TempSelectionTab";
import { SepCalculationTab } from "./SepCalculationTab";

const AshbyTab = lazy(() =>
  import("./AshbyTab").then((module) => ({ default: module.AshbyTab })),
);

function selectionSubtabClass({ isActive }: { isActive: boolean }) {
    return isActive ? "editor-subtab active" : "editor-subtab";
  }

export function SelectionPage() {
  
    return (
      <div className="selection-page">
        <nav className="editor-subtabs">
            <NavLink to="/selection/temperature" className={selectionSubtabClass}>
                Подбор по температуре
            </NavLink>
            <NavLink to="/selection/calc" className={selectionSubtabClass}>
                Расчёт отдельно
            </NavLink>
            <NavLink to="/selection/compare-props" className={selectionSubtabClass}>
                   Сравнение материалов(свойства)
            </NavLink>
            <NavLink to="/selection/compare-chem" className={selectionSubtabClass}>
                   Сравнение материалов(хим.состав)
            </NavLink>
            <NavLink to="/selection/ashby" className={selectionSubtabClass}>
                   Диаграмма Эшби
            </NavLink>
        </nav>

        <Routes>
            <Route index element={<Navigate to="temperature" replace />} />
            <Route 
                path="temperature"
                element={
                   <TempSelectionTab/>
                }
            />

            <Route 
                path="calc"
                element={
                   <SepCalculationTab/>
                }
            />

            <Route
                path="compare-props"
                element={
                    <>
                        <h2>
                            Сравнение материалов
                        </h2>
                    </>
                   }
            />

            <Route
                path="compare-chem"
                element={
                    <>
                        <h2>
                            Сравнение материалов(хим.состав)
                        </h2>
                    </>
                   }
            />

            <Route
                path="ashby"
                element={
                    <Suspense fallback={<p className="tab-placeholder">Загрузка…</p>}>
                        <AshbyTab />
                    </Suspense>
                }
            />
        </Routes>
      </div>
    );
  }