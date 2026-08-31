import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { postCompareProps, postComparePropsPool } from "../api/selection";
import { useKeepAlivePaneActive } from "../context/KeepAlivePaneContext";
import { PropertyComparisonChart } from "../components/PropertyComparisonChart";
import { useWorkspace } from "../context/WorkSpaceContext";
import { usePropertiesCatalog } from "../hooks/usePropertiesCatalog";
import { useUnitLabels } from "../hooks/useUnitLabels";
import { formatScientificPlain } from "../lib/scientificNotation";
import type {
  ComparePropsPoolItem,
  ComparePropsResponse,
  PropertyMeta,
} from "../types/api";

type PropertyOption = {
  key: string;
  label: string;
};

function buildPropertyOptions(
  physical: Record<string, PropertyMeta> | undefined,
  mechanical: Record<string, PropertyMeta> | undefined,
): PropertyOption[] {
  const options: PropertyOption[] = [];
  const append = (entries: Record<string, PropertyMeta> | undefined) => {
    if (!entries) return;
    for (const [key, meta] of Object.entries(entries)) {
      if (meta.temperature_dependent === false) continue;
      const symbol = (meta.display_symbol || meta.symbol || "").trim();
      const raw = symbol ? `${meta.name} (${symbol})` : meta.name;
      options.push({
        key,
        label: formatScientificPlain(raw),
      });
    }
  };
  append(physical);
  append(mechanical);
  return options;
}

export function ComparePropsTab() {
  const { workspace } = useWorkspace();
  const paneActive = useKeepAlivePaneActive();
  const catalogQuery = usePropertiesCatalog();
  const areaOptions = workspace?.application_areas ?? [];

  const propertyOptions = useMemo(
    () =>
      buildPropertyOptions(
        catalogQuery.data?.physical,
        catalogQuery.data?.mechanical,
      ),
    [catalogQuery.data],
  );

  const [selectedArea, setSelectedArea] = useState("Все");
  const [propertyKey, setPropertyKey] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<ComparePropsPoolItem[]>(
    [],
  );
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [activeSelectedId, setActiveSelectedId] = useState<string | null>(null);
  const [plotData, setPlotData] = useState<ComparePropsResponse | null>(null);

  const selectedPropertyMeta = useMemo(() => {
    const physical = catalogQuery.data?.physical ?? {};
    const mechanical = catalogQuery.data?.mechanical ?? {};
    return physical[propertyKey] ?? mechanical[propertyKey];
  }, [catalogQuery.data, propertyKey]);

  const { labels: unitLabels } = useUnitLabels(
    selectedPropertyMeta?.unit_type ?? plotData?.property.unit_type ?? "",
  );

  useEffect(() => {
    if (!propertyKey && propertyOptions.length > 0) {
      setPropertyKey(propertyOptions[0].key);
    }
  }, [propertyKey, propertyOptions]);

  const areaFilter =
    selectedArea && selectedArea !== "Все" ? selectedArea : null;

  const poolQuery = useQuery({
    queryKey: ["selection", "compare-props-pool", propertyKey, areaFilter],
    queryFn: () =>
      postComparePropsPool({
        property_key: propertyKey,
        ...(areaFilter ? { area: areaFilter } : {}),
      }),
    enabled: Boolean(workspace && propertyKey && paneActive),
  });

  const poolItems = useMemo(
    () => poolQuery.data?.items ?? [],
    [poolQuery.data],
  );

  const filteredPool = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return poolItems;
    return poolItems.filter((item) => item.label.toLowerCase().includes(term));
  }, [poolItems, searchTerm]);

  const plotMutation = useMutation({
    mutationFn: postCompareProps,
    onSuccess: (data) => setPlotData(data),
  });

  function requestPlot(items = selectedItems, key = propertyKey) {
    if (!key) return;
    plotMutation.mutate({
      property_key: key,
      items: items.map((item) => ({
        id: item.id,
        label: item.label,
        material_id: item.material_id,
        category_index: item.category_index,
      })),
    });
  }

  function handlePropertyChange(nextKey: string) {
    setPropertyKey(nextKey);
    setActiveSearchId(null);
    // Как в desktop: при смене свойства перестраиваем график по текущему выбору.
    if (selectedItems.length > 0) {
      requestPlot(selectedItems, nextKey);
    } else {
      setPlotData(null);
    }
  }

  function addSelectedItem(item: ComparePropsPoolItem) {
    setSelectedItems((prev) => {
      if (prev.some((entry) => entry.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
    setActiveSelectedId(item.id);
  }

  function removeSelectedItem(itemId: string) {
    setSelectedItems((prev) => prev.filter((entry) => entry.id !== itemId));
    if (activeSelectedId === itemId) {
      setActiveSelectedId(null);
    }
  }

  function handleReset() {
    setSelectedItems([]);
    setSearchTerm("");
    setActiveSearchId(null);
    setActiveSelectedId(null);
    setPlotData(null);
    plotMutation.reset();
  }

  const canPlot = Boolean(workspace && propertyKey && !plotMutation.isPending);
  const statusMessage = !workspace
    ? "Откройте workspace с материалами"
    : catalogQuery.isError
      ? "Не удалось загрузить каталог свойств"
      : poolQuery.isError
        ? "Не удалось загрузить список материалов"
        : plotMutation.isError
          ? "Не удалось построить график"
          : null;

  return (
    <div className="compare-props-tab ashby-tab">
      <div className="ashby-layout compare-props-layout">
        <aside className="ashby-controls">
          <div className="ashby-field" data-tour="compare-props-area">
            <label htmlFor="compare-props-area" className="ashby-section-label">
              Область применения:
            </label>
            <div className="ashby-control-shell">
              <select
                id="compare-props-area"
                className="input ashby-field-control"
                value={selectedArea}
                disabled={!workspace}
                onChange={(event) => setSelectedArea(event.target.value)}
              >
                <option value="Все">Все</option>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ashby-field" data-tour="compare-props-property">
            <label htmlFor="compare-props-property" className="ashby-section-label">
              Свойство для сравнения:
            </label>
            <div className="ashby-control-shell">
              <select
                id="compare-props-property"
                className="input ashby-field-control"
                value={propertyKey}
                disabled={!workspace || propertyOptions.length === 0}
                onChange={(event) => handlePropertyChange(event.target.value)}
              >
                {propertyOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ashby-field" data-tour="compare-props-search">
            <label htmlFor="compare-props-search" className="ashby-section-label">
              Поиск материала:
            </label>
            <div className="ashby-control-shell">
              <input
                id="compare-props-search"
                type="search"
                className="input ashby-field-control"
                value={searchTerm}
                disabled={!workspace}
                placeholder="Введите материал или его часть…"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="ashby-selection-stack compare-props-selection-stack">
            <div
              className="ashby-labelframe ashby-class-labelframe compare-props-search-labelframe"
              data-tour="compare-props-search-results"
            >
              <div className="ashby-labelframe-title ashby-section-label">
                Результаты поиска
              </div>
              <ul
                className="ashby-listbox ashby-class-list compare-props-search-list"
                role="listbox"
                aria-label="Результаты поиска"
              >
                {filteredPool.map((item) => (
                  <li key={item.id} role="option" aria-selected={activeSearchId === item.id}>
                    <button
                      type="button"
                      className={
                        activeSearchId === item.id
                          ? "ashby-listbox-item ashby-listbox-item--active"
                          : "ashby-listbox-item"
                      }
                      title={`${item.label} (двойной клик — добавить)`}
                      disabled={!workspace}
                      onClick={() => setActiveSearchId(item.id)}
                      onDoubleClick={() => addSelectedItem(item)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
                {workspace &&
                  !poolQuery.isLoading &&
                  filteredPool.length === 0 && (
                    <li className="ashby-listbox-empty">Нет материалов</li>
                  )}
              </ul>
            </div>

            <div className="ashby-selection-stack-spacer" aria-hidden />

            <div
              className="ashby-labelframe ashby-class-labelframe compare-props-selected-labelframe"
              data-tour="compare-props-selected"
            >
              <div className="ashby-labelframe-title ashby-section-label">
                Выбранные материалы
              </div>
              <ul
                className="ashby-listbox ashby-class-list compare-props-selected-list"
                role="listbox"
                aria-label="Выбранные материалы"
              >
                {selectedItems.map((item) => (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={activeSelectedId === item.id}
                  >
                    <button
                      type="button"
                      className={
                        activeSelectedId === item.id
                          ? "ashby-listbox-item ashby-listbox-item--active"
                          : "ashby-listbox-item"
                      }
                      title={`${item.label} (двойной клик — убрать)`}
                      onClick={() => setActiveSelectedId(item.id)}
                      onDoubleClick={() => removeSelectedItem(item.id)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
                {selectedItems.length === 0 && (
                  <li className="ashby-listbox-empty">Ничего не выбрано</li>
                )}
              </ul>
            </div>

            <div className="ashby-selection-stack-spacer" aria-hidden />

            <div className="ashby-actions" data-tour="compare-props-actions">
              <button
                type="button"
                className="ashby-action-btn"
                disabled={!canPlot}
                onClick={() => requestPlot()}
              >
                Построить график
              </button>
              <button
                type="button"
                className="ashby-action-btn button-secondary"
                disabled={!workspace}
                onClick={handleReset}
              >
                Сбросить
              </button>
            </div>
          </div>
        </aside>

        <section
          className="ashby-chart-panel"
          data-tour="compare-props-chart"
          aria-label="График сравнения свойств"
        >
          <div className="ashby-chart-field">
            {statusMessage && (
              <p
                className={
                  catalogQuery.isError || poolQuery.isError || plotMutation.isError
                    ? "ashby-status ashby-status--error"
                    : "ashby-status"
                }
              >
                {statusMessage}
              </p>
            )}
            <PropertyComparisonChart
              data={plotData}
              unitLabels={unitLabels}
              emptyMessage={
                plotMutation.isPending
                  ? "Построение графика…"
                  : "Выберите материалы и нажмите «Построить график»"
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
