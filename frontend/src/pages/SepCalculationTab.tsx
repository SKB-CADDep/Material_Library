import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApplicationAreaFilter } from "../components/ApplicationAreaFilter";
import { CalculationTable } from "../components/CalculationTable";
import { useWorkspace } from "../context/WorkSpaceContext";
import { listMaterials, getMaterial } from "../api/materials";
import { formatCategoryOptionLabel } from "../lib/strengthCategory";
import { getSources } from "../api/sources";
import { postSingleCalculation } from "../api/selection";
import { CalculationColumnMenu } from "../components/CalculationColumnMenu";
import { useColumnUnitConfigs } from "../hooks/useColumnUnitConfigs";
import { buildColumnAcceptance } from "../lib/columnAcceptance";
import { mergeColumnUnits } from "../lib/columnUnits";
import { buildColumnComments } from "../lib/columnComments";
import {
  filterVisibleColumns,
  mergeColumnVisibility,
} from "../lib/columnVisibility";
import { AcceptanceIndicator } from "../components/AcceptanceIndicator";
import { TempCommentIndicator } from "../components/TempCommentIndicator";

type StrengthCategory = {
  value_strength_category?: string;
  [key: string]: unknown;
  hardness_unit: string;
  source_strength_category?: string | null;
  source_ref_id?: string | null;
};

type MechanicalProperties = {
  strength_category?: StrengthCategory[];
};

function parseTemperature(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SepCalculationTab() {
  const { workspace } = useWorkspace();
  const areaOptions = workspace?.application_areas ?? [];
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [customTemps, setCustomTemps] = useState<number[]>([]);
  const [calcTempInput, setCalcTempInput] = useState("");
  const [calcTempError, setCalcTempError] = useState<string | null>(null);
  const [selectedCustomRowIndex, setSelectedCustomRowIndex] = useState<
    number | null
  >(null);
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [columnUnits, setColumnUnits] = useState<Record<string, string>>({});

  const result = useQuery({
    queryKey: ["materials"],
    queryFn: listMaterials,
  });
  const detail = useQuery({
    queryKey: ["material", selectedId],
    queryFn: () => getMaterial(selectedId!),
    enabled: selectedId !== null,
  });
  const material = result.data ?? [];
  const sourcesQuery = useQuery({ queryKey: ["sources"], queryFn: getSources });
  const mechanicalSources = sourcesQuery.data?.strength_sources ?? [];
  const mechanical_properties = (detail.data?.mechanical_properties ??
    {}) as MechanicalProperties;
  const categories = mechanical_properties.strength_category ?? [];
  const hasCategories = categories.length > 0;
  const categoryPlaceholder = !selectedId
    ? "— выберите материал —"
    : "Нет категорий прочности";

  useEffect(() => {
    setCustomTemps([]);
    setCalcTempInput("");
    setCalcTempError(null);
    setSelectedCustomRowIndex(null);
  }, [selectedId, categoryIndex]);

  const sepCalculate = useQuery({
    queryKey: ["selection", "calculate", selectedId, categoryIndex, customTemps],
    queryFn: () =>
      postSingleCalculation({
        material_id: selectedId!,
        category_index: categoryIndex,
        custom_temperatures: customTemps,
      }),
    enabled: selectedId !== null && Boolean(workspace),
  });

  const columns = sepCalculate.data?.columns ?? [];
  const rows = sepCalculate.data?.db_rows ?? [];
  const customRows = sepCalculate.data?.custom_rows ?? [];
  const { configs: unitConfigs } = useColumnUnitConfigs(columns);

  useEffect(() => {
    const cols = sepCalculate.data?.columns ?? [];
    if (cols.length === 0) return;
    setColumnVisibility((prev) => mergeColumnVisibility(cols, prev));
  }, [sepCalculate.data]);

  useEffect(() => {
    if (columns.length === 0) return;
    setColumnUnits((prev) => mergeColumnUnits(columns, prev, unitConfigs));
  }, [columns, unitConfigs]);

  const visibleColumns = useMemo(
    () => filterVisibleColumns(columns, columnVisibility),
    [columns, columnVisibility],
  );

  const columnComments = useMemo(
    () =>
      buildColumnComments(
        columns,
        detail.data?.physical_properties as Record<string, unknown> | undefined,
        categories[categoryIndex] as Record<string, unknown> | undefined,
      ),
    [columns, detail.data, categories, categoryIndex],
  );

  const columnAcceptance = useMemo(
    () =>
      buildColumnAcceptance(
        columns,
        categories[categoryIndex] as Record<string, unknown> | undefined,
      ),
    [columns, categories, categoryIndex],
  );

  const hasColumnComments = Object.keys(columnComments).length > 0;
  const hasColumnAcceptance = columnAcceptance.size > 0;

  const filteredMaterials = useMemo(() => {
    if (selectedAreas.length === 0) return material;
    return material.filter((m) =>
      m.areas.some((a) => selectedAreas.includes(a)),
    );
  }, [material, selectedAreas]);

  useEffect(() => {
    if (filteredMaterials.length === 0) {
      setSelectedId(null);
      setCategoryIndex(0);
      return;
    }

    setSelectedId((prev) => {
      if (prev === null) return null;
      if (filteredMaterials.some((m) => m.id === prev)) return prev;
      return filteredMaterials[0].id;
    });
  }, [filteredMaterials]);

  useEffect(() => {
    setCategoryIndex(0);
  }, [selectedId]);

  useEffect(() => {
    if (
      selectedCustomRowIndex !== null &&
      selectedCustomRowIndex >= customTemps.length
    ) {
      setSelectedCustomRowIndex(null);
    }
  }, [customTemps.length, selectedCustomRowIndex]);

  function addCustomCalculation() {
    const temp = parseTemperature(calcTempInput);
    if (temp === null) {
      setCalcTempError("Некорректная температура");
      return;
    }
    setCalcTempError(null);
    setCustomTemps((prev) => [...prev, temp]);
    setCalcTempInput("");
    setSelectedCustomRowIndex(null);
  }

  function removeSelectedCustomRow() {
    if (selectedCustomRowIndex === null) return;
    setCustomTemps((prev) =>
      prev.filter((_, index) => index !== selectedCustomRowIndex),
    );
    setSelectedCustomRowIndex(null);
  }

  function sortCustomRows() {
    setCustomTemps((prev) => [...prev].sort((a, b) => a - b));
    setSelectedCustomRowIndex(null);
  }

  function clearCustomRows() {
    setCustomTemps([]);
    setSelectedCustomRowIndex(null);
  }

  const showTable =
    workspace &&
    selectedId &&
    sepCalculate.isSuccess &&
    rows.length > 0;

  const columnMenuDisabled =
    sepCalculate.isPending || sepCalculate.isFetching;

  return (
    <div className="temp-selection-tab">
      <div className="selection-controls">
        <div className="selection-control selection-control--area">
          <label htmlFor="area-filter-select">Область применения:</label>
          <ApplicationAreaFilter
            id="area-filter-select"
            options={areaOptions}
            selected={selectedAreas}
            onChange={setSelectedAreas}
          />
        </div>
        <div className="selection-control selection-control--material">
          <label htmlFor="material-select">Материал:</label>
          <select
            id="material-select"
            className="input"
            value={selectedId ?? ""}
            onChange={(event) => {
              setSelectedId(event.target.value || null);
              setCategoryIndex(0);
            }}
          >
            <option value="">— не выбран —</option>
            {filteredMaterials.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="selection-control selection-control--category">
          <label htmlFor="strength_category_select">Категория прочности:</label>
          <select
            id="strength_category_select"
            className="input"
            value={hasCategories ? categoryIndex : ""}
            onChange={(e) => setCategoryIndex(Number(e.target.value))}
            disabled={!hasCategories}
          >
            {!hasCategories && (
              <option value="">{categoryPlaceholder}</option>
            )}
            {categories.map((cat, index) => (
              <option key={index} value={index}>
                {formatCategoryOptionLabel(cat, index, mechanicalSources)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="selection-body">
        {!workspace && (
          <p className="tab-placeholder">Откройте workspace с материалами</p>
        )}

        {workspace && !selectedId && (
          <p className="tab-placeholder">Выберите материал</p>
        )}

        {workspace && selectedId && (sepCalculate.isPending || sepCalculate.isFetching) && (
          <p className="tab-placeholder">Загрузка…</p>
        )}

        {workspace && selectedId && sepCalculate.isError && (
          <p className="tab-placeholder tab-placeholder--error">
            {sepCalculate.error.message}
          </p>
        )}

        {workspace && selectedId && sepCalculate.isSuccess && rows.length === 0 && (
          <p className="tab-placeholder">Нет данных для отображения</p>
        )}

        {showTable && visibleColumns.length === 0 && (
          <div className="selection-table-panel calculation-table-panel">
            <div className="calculation-table-toolbar">
              <CalculationColumnMenu
                columns={columns}
                visibility={columnVisibility}
                onChange={setColumnVisibility}
                disabled={columnMenuDisabled}
              />
            </div>
            <p className="tab-placeholder calculation-table-empty">
              Все столбцы скрыты — включите свойства в «Настроить столбцы»
            </p>
          </div>
        )}

        {showTable && visibleColumns.length > 0 && (
          <div className="selection-table-panel calculation-table-panel">
            <div className="calculation-table-toolbar">
              <CalculationColumnMenu
                columns={columns}
                visibility={columnVisibility}
                onChange={setColumnVisibility}
                disabled={columnMenuDisabled}
              />
              <div className="calculation-table-legend">
              <span className="calculation-table-legend__item">
                <span className="calculation-table-legend__sample calculation-table-legend__sample--exact">
                  330.0
                </span>
                из БД
              </span>
              <span className="calculation-table-legend__item">
                <span className="calculation-table-legend__sample calculation-table-legend__sample--interp">
                  (330.0)
                </span>
                интерполяция
              </span>
              <span className="calculation-table-legend__item">
                <span className="calculation-table-legend__sample calculation-table-legend__sample--approx">
                  [330.0]
                </span>
                экстраполяция
              </span>
              {hasColumnAcceptance && (
                <span className="calculation-table-legend__item">
                  <AcceptanceIndicator className="acceptance-indicator--legend" />
                  сдаточная
                </span>
              )}
              {hasColumnComments && (
                <span className="calculation-table-legend__item">
                  <TempCommentIndicator
                    comment="Комментарий к свойству"
                    ariaLabel="Пример индикатора комментария к свойству"
                    className="temp-comment-indicator--legend"
                  />
                  комментарий
                </span>
              )}
              <span
                className="calculation-table-legend__separator"
                aria-hidden="true"
              />
              <span className="calculation-table-legend__item calculation-table-legend__item--hint">
                ПКМ по заголовку — смена ед. изм.
              </span>
            </div>
            </div>
            <CalculationTable
              columns={visibleColumns}
              dbRows={rows}
              customRows={customRows}
              columnComments={columnComments}
              columnAcceptance={columnAcceptance}
              columnUnits={columnUnits}
              unitConfigs={unitConfigs}
              onColumnUnitChange={(columnKey, unit) =>
                setColumnUnits((prev) => ({ ...prev, [columnKey]: unit }))
              }
              selectedCustomRowIndex={selectedCustomRowIndex}
              onCustomRowClick={setSelectedCustomRowIndex}
            />
          </div>
        )}

        {workspace && selectedId && (
          <fieldset className="sep-calculation-calc-panel">
            <legend>Расчёт произвольной точки</legend>
            <div className="sep-calculation-calc-toolbar">
              <label htmlFor="calc-temp-input">Температура, °C:</label>
              <input
                id="calc-temp-input"
                type="text"
                className="input sep-calculation-calc-input"
                value={calcTempInput}
                onChange={(event) => {
                  setCalcTempInput(event.target.value);
                  if (calcTempError) setCalcTempError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomCalculation();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCustomCalculation}
              >
                + Добавить расчёт
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={removeSelectedCustomRow}
                disabled={selectedCustomRowIndex === null}
              >
                − Исключить строку
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={sortCustomRows}
                disabled={customTemps.length < 2}
              >
                Сортировать
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={clearCustomRows}
                disabled={customTemps.length === 0}
              >
                Очистить все
              </button>
            </div>
            {calcTempError && (
              <p className="sep-calculation-calc-error">{calcTempError}</p>
            )}
          </fieldset>
        )}
      </section>
    </div>
  );
}
