import { NavLink, Routes, Route, Navigate } from "react-router-dom";

export function SelectionPage() {
  
    return (
      <div className="selection-page">
        <h1>Подбор материала</h1>
        <nav>
            <NavLink to="/selection/temperature">
                Подбор по температуре
            </NavLink>
            <NavLink to="/selection/calc">
                Расчёт отдельно
            </NavLink>
            <NavLink to="/selection/compare-props">
                   Сравнение материалов(свойства)
            </NavLink>
            <NavLink to="/selection/compare-chem">
                   Сравнение материалов(хим.состав)
            </NavLink>
            <NavLink to="/selection/ashby">
                   Диаграмма Эшби
            </NavLink>
        </nav>

        <Routes>
            <Route index element={<Navigate to="temperature" replace />} />
            <Route 
                path="temperature"
                element={
                    <>
                        <h2>
                            Подбор по температуре
                        </h2>
                    </>
                }
            />

            <Route
                path="calc"
                element={
                    <>
                        <h2>
                            Расчёт отдельно
                        </h2>
                    </>
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
                    <>
                        <h2>
                            Диаграмма Эшби
                        </h2>
                    </>
                   }
            />
        </Routes>
      </div>
    );
  }