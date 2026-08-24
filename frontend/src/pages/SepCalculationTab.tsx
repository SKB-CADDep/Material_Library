import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApplicationAreaFilter } from "../components/ApplicationAreaFilter";
import { CalculationTable } from "../components/CalculationTable";
import { useWorkspace } from "../context/WorkSpaceContext";
import { listMaterials, getMaterial } from "../api/materials";
import { materialListLabel } from "../lib/materialDraft";
import {
  buildStrengthCategoryNtdOptions,
  indicesForStrengthCategoryName,
  uniqueStrengthCategoryNames,
} from "../lib/strengthCategory";
import {
  formatCalculationTemperature,
  isDuplicateCalculationTemperature,
  parseCalculationTemperature,
} from "../lib/calculationTemperature";
import { useSourcesCatalog } from "../hooks/useSourcesCatalog";
import { postSingleCalculation } from "../api/selection";
import { CalculationColumnMenu } from "../components/CalculationColumnMenu";
import { CalculationTableLegend } from "../components/CalculationTableLegend";
import { TabErrorBoundary } from "../components/TabErrorBoundary";
import { useColumnUnitConfigs } from "../hooks/useColumnUnitConfigs";
import { buildColumnAcceptance } from "../lib/columnAcceptance";
import { mergeColumnUnits } from "../lib/columnUnits";
import { buildColumnComments } from "../lib/columnComments";
import { buildColumnSourceRefs } from "../lib/calculationColumnSources";
import { buildSourcesNavigatePath } from "../lib/sourcesNavigation";
import {
  filterVisibleColumns,
  mergeColumnVisibility,
} from "../lib/columnVisibility";

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

export function SepCalculationTab() {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const areaOptions = workspace?.application_areas ?? [];
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [customTemps, setCustomTemps] = useState<number[]>([]);
  const [calcTempInput, setCalcTempInput] = useState("");
  const [calcTempError, setCalcTempError] = useState<string | null>(null);
  const [selectedCustomRowIndex, setSelectedCustomRowIndex] = useState<
    number | null
  >(null);
  const [scrollToCustomRowIndex, setScrollToCustomRowIndex] = useState<
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
  const sourcesQuery = useSourcesCatalog();
  const mechanicalSources = sourcesQuery.data?.strength_sources ?? [];
  const propertySources = sourcesQuery.data?.property_sources ?? [];
  const mechanical_properties = (detail.data?.mechanical_properties ??
    {}) as MechanicalProperties;
  const categories = mechanical_properties.strength_category ?? [];
  const hasCategories = categories.length > 0;
  const activeCategoryIndex = useMemo(() => {
    if (!hasCategories || categoryIndex < 0 || categoryIndex >= categories.length) {
      return null;
    }
    return categoryIndex;
  }, [hasCategories, categoryIndex, categories.length]);
  const activeCategory = activeCategoryIndex !== null
    ? (categories[activeCategoryIndex] as Record<string, unknown>)
    : undefined;
  const categoryNames = useMemo(
    () => uniqueStrengthCategoryNames(categories),
    [categories],
  );
  const ntdOptions = useMemo(
    () =>
      buildStrengthCategoryNtdOptions(
        categories,
        selectedCategoryName,
        mechanicalSources,
      ),
    [categories, selectedCategoryName, mechanicalSources],
  );
  const categoryPlaceholder = !selectedId
    ? "— выберите материал —"
    : "Нет категорий прочности";

  useEffect(() => {
    setCustomTemps([]);
    setCalcTempInput("");
    setCalcTempError(null);
    setSelectedCustomRowIndex(null);
    setScrollToCustomRowIndex(null);
  }, [selectedId, categoryIndex]);

  const calcQueryEnabled =
    selectedId !== null &&
    Boolean(workspace) &&
    activeCategoryIndex !== null &&
    detail.isFetched;

  const sepCalculate = useQuery({
    queryKey: [
      "selection",
      "calculate",
      selectedId,
      activeCategoryIndex,
      customTemps,
    ],
    queryFn: () =>
      postSingleCalculation({
        material_id: selectedId!,
        category_index: activeCategoryIndex!,
        custom_temperatures: customTemps,
      }),
    enabled: calcQueryEnabled,
  });

  const columns = sepCalculate.data?.columns ?? [];
  const rows = sepCalculate.data?.db_rows ?? [];
  const customRows = sepCalculate.data?.custom_rows ?? [];
  const { configs: unitConfigs } = useColumnUnitConfigs(columns, {
    includeTemperature: true,
  });

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
        activeCategory,
      ),
    [columns, detail.data, activeCategory],
  );

  const columnAcceptance = useMemo(
    () => buildColumnAcceptance(columns, activeCategory),
    [columns, activeCategory],
  );

  const columnSourceRefs = useMemo(
    () =>
      buildColumnSourceRefs(
        columns,
        detail.data?.physical_properties as Record<string, unknown> | undefined,
        activeCategory,
        propertySources,
        mechanicalSources,
      ),
    [columns, detail.data, activeCategory, propertySources, mechanicalSources],
  );

  const hasColumnComments = Object.keys(columnComments).length > 0;
  const hasColumnAcceptance = columnAcceptance.size > 0;
  const hasColumnSourceRefs = Object.keys(columnSourceRefs).length > 0;

  const filteredMaterials = useMemo(() => {
    if (selectedAreas.length === 0) return material;
    return material.filter((m) =>
      (m.areas ?? []).some((a) => selectedAreas.includes(a)),
    );
  }, [material, selectedAreas]);

  useEffect(() => {
    if (filteredMaterials.length === 0) {
      setSelectedId(null);
      setCategoryIndex(0);
      return;
    }

    setSelectedId((prev) => {
      if (prev !== null && filteredMaterials.some((m) => m.id === prev)) {
        return prev;
      }
      return filteredMaterials[0]?.id ?? null;
    });
  }, [filteredMaterials]);

  useEffect(() => {
    if (!selectedId || categories.length === 0) {
      setSelectedCategoryName("");
      setCategoryIndex(0);
      return;
    }

    setSelectedCategoryName((prev) => {
      const names = uniqueStrengthCategoryNames(categories);
      return names.includes(prev) ? prev : (names[0] ?? "");
    });
  }, [selectedId, categories]);

  useEffect(() => {
    if (!selectedCategoryName || categories.length === 0) {
      return;
    }

    const indices = indicesForStrengthCategoryName(
      categories,
      selectedCategoryName,
    );
    setCategoryIndex((prev) =>
      indices.includes(prev) ? prev : (indices[0] ?? 0),
    );
  }, [categories, selectedCategoryName]);

  useEffect(() => {
    if (ntdOptions.length === 0) {
      return;
    }
    if (!ntdOptions.some((option) => option.index === categoryIndex)) {
      setCategoryIndex(ntdOptions[0].index);
    }
  }, [ntdOptions, categoryIndex]);

  useEffect(() => {
    if (
      selectedCustomRowIndex !== null &&
      selectedCustomRowIndex >= customTemps.length
    ) {
      setSelectedCustomRowIndex(null);
    }
  }, [customTemps.length, selectedCustomRowIndex]);

  useEffect(() => {
    if (sepCalculate.isError) {
      setScrollToCustomRowIndex(null);
    }
  }, [sepCalculate.isError]);

  function addCustomCalculation() {
    const temp = parseCalculationTemperature(calcTempInput);
    if (temp === null) {
      setCalcTempError("Некорректная температура");
      return;
    }

    if (isDuplicateCalculationTemperature(temp, customTemps, rows)) {
      setCalcTempError(
        `Температура ${formatCalculationTemperature(temp)} °C уже есть в таблице`,
      );
      return;
    }

    const newIndex = customTemps.length;
    setCalcTempError(null);
    setCustomTemps((prev) => [...prev, temp]);
    setCalcTempInput("");
    setSelectedCustomRowIndex(newIndex);
    setScrollToCustomRowIndex(newIndex);
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

  const calcDataMatches =
    sepCalculate.data?.material_id === selectedId &&
    sepCalculate.data?.category_index === activeCategoryIndex;

  const isDetailLoading = Boolean(selectedId && detail.isPending);
  const isCalcLoading =
    calcQueryEnabled &&
    (sepCalculate.isLoading || sepCalculate.isFetching);

  const showTable =
    workspace &&
    selectedId &&
    activeCategoryIndex !== null &&
    sepCalculate.isSuccess &&
    calcDataMatches &&
    rows.length > 0;

  const showBodyPlaceholder =
    workspace &&
    selectedId &&
    hasCategories &&
    activeCategoryIndex !== null &&
    !showTable &&
    !isDetailLoading &&
    !isCalcLoading &&
    !sepCalculate.isError &&
    !(sepCalculate.isSuccess && calcDataMatches && rows.length === 0);

  const columnMenuDisabled = isCalcLoading;

  return (
    <TabErrorBoundary resetKey={`${selectedId ?? ""}:${activeCategoryIndex ?? ""}`}>
    <div className="temp-selection-tab sep-calculation-tab">
        <div className="selection-controls">
        <div
          className="selection-control selection-control--area"
          data-tour="sep-calc-area"
        >
          <label htmlFor="area-filter-select">Область применения:</label>
          <ApplicationAreaFilter
            id="area-filter-select"
            options={areaOptions}
            selected={selectedAreas}
            onChange={setSelectedAreas}
          />
        </div>
        <div
          className="selection-control selection-control--material"
          data-tour="sep-calc-material"
        >
          <label htmlFor="material-select">Материал:</label>
          <select
            id="material-select"
            className="input"
            value={selectedId ?? ""}
            onChange={(event) => {
              setSelectedId(event.target.value || null);
            }}
          >
            <option value="">— не выбран —</option>
            {filteredMaterials.map((item) => (
              <option key={item.id} value={item.id}>
                {materialListLabel(item)}
              </option>
            ))}
          </select>
        </div>
        <div
          className="selection-control selection-control--category"
          data-tour="sep-calc-category"
        >
          <label htmlFor="strength_category_select">Категория прочности:</label>
          <select
            id="strength_category_select"
            className="input"
            value={hasCategories ? selectedCategoryName : ""}
            onChange={(event) => {
              const name = event.target.value;
              setSelectedCategoryName(name);
              const indices = indicesForStrengthCategoryName(categories, name);
              setCategoryIndex(indices[0] ?? 0);
            }}
            disabled={!hasCategories}
          >
            {!hasCategories && (
              <option value="">{categoryPlaceholder}</option>
            )}
            {categoryNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div
          className="selection-control selection-control--ntd"
          data-tour="sep-calc-ntd"
        >
          <label htmlFor="strength_category_ntd_select">НТД:</label>
          <select
            id="strength_category_ntd_select"
            className="input"
            value={hasCategories ? categoryIndex : ""}
            onChange={(event) => setCategoryIndex(Number(event.target.value))}
            disabled={!hasCategories || ntdOptions.length <= 1}
            title={
              ntdOptions.length <= 1
                ? "Для выбранной КП доступен один источник"
                : undefined
            }
          >
            {!hasCategories && <option value="">—</option>}
            {ntdOptions.map((option) => (
              <option key={option.index} value={option.index}>
                {option.label}
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

        {workspace && selectedId && (isDetailLoading || isCalcLoading) && (
          <p className="tab-placeholder">Загрузка…</p>
        )}

        {workspace && selectedId && detail.isError && (
          <p className="tab-placeholder tab-placeholder--error">
            {detail.error.message}
          </p>
        )}

        {workspace &&
          selectedId &&
          detail.isFetched &&
          !hasCategories &&
          !isDetailLoading && (
            <p className="tab-placeholder">
              Нет категорий прочности — расчёт недоступен
            </p>
          )}

        {workspace && selectedId && sepCalculate.isError && (
          <p className="tab-placeholder tab-placeholder--error">
            {sepCalculate.error.message}
          </p>
        )}

        {workspace &&
          selectedId &&
          sepCalculate.isSuccess &&
          calcDataMatches &&
          rows.length === 0 && (
          <p className="tab-placeholder">
            Нет температурных данных для выбранной категории прочности
          </p>
        )}

        {showBodyPlaceholder && (
          <p className="tab-placeholder">Подготовка расчёта…</p>
        )}

        {showTable && visibleColumns.length === 0 && (
          <div className="selection-table-panel calculation-table-panel">
            <div className="calculation-table-toolbar">
              <CalculationColumnMenu
                columns={columns}
                visibility={columnVisibility}
                columnUnits={columnUnits}
                unitConfigs={unitConfigs}
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
          <div
            className="selection-table-panel calculation-table-panel"
            data-tour="sep-calc-table"
          >
            <div className="calculation-table-toolbar">
              <CalculationColumnMenu
                columns={columns}
                visibility={columnVisibility}
                columnUnits={columnUnits}
                unitConfigs={unitConfigs}
                onChange={setColumnVisibility}
                disabled={columnMenuDisabled}
              />
              <CalculationTableLegend
                showAcceptance={hasColumnAcceptance}
                showComments={hasColumnComments}
                showSourceRefs={hasColumnSourceRefs}
              />
            </div>
            <CalculationTable
              columns={visibleColumns}
              dbRows={rows}
              customRows={customRows}
              columnComments={columnComments}
              columnSourceRefs={columnSourceRefs}
              onSourceRefClick={(ref) => {
                if (!ref.sourceId) return;
                navigate(buildSourcesNavigatePath(ref));
              }}
              columnAcceptance={columnAcceptance}
              columnUnits={columnUnits}
              unitConfigs={unitConfigs}
              onColumnUnitChange={(columnKey, unit) =>
                setColumnUnits((prev) => ({ ...prev, [columnKey]: unit }))
              }
              selectedCustomRowIndex={selectedCustomRowIndex}
              onCustomRowClick={setSelectedCustomRowIndex}
              scrollToCustomRowIndex={scrollToCustomRowIndex}
              onScrollToCustomRowComplete={() => setScrollToCustomRowIndex(null)}
            />
          </div>
        )}

        {workspace && selectedId && (
          <fieldset
            className="sep-calculation-calc-panel"
            data-tour="sep-calc-custom-panel"
          >
            <legend>Расчёт произвольной точки</legend>
            <div className="sep-calculation-calc-toolbar">
              <label htmlFor="calc-temp-input">Температура, °C:</label>
              <input
                id="calc-temp-input"
                type="text"
                className="input sep-calculation-calc-input"
                value={calcTempInput}
                data-tour="sep-calc-custom-temp"
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
                data-tour="sep-calc-add-custom"
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
    </TabErrorBoundary>
  );
}
