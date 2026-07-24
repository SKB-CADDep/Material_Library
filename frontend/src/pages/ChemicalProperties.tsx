import { useState, useRef, useEffect } from "react";
import { getSources } from "../api/sources";
import { useQuery } from "@tanstack/react-query";
import elements_catalog from '../config/elements_catalog.json'
import { UnitSelect } from "./UnitSelect";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type ChemicalPropertiesProps = {
  material: Record<string, unknown> | undefined;
  onDraftChange: (next: Record<string, unknown>) => void;
};

type ChemicalElement = {
  element: string;
  unit_value: string;
  min_value: number;
  max_value: number;
  min_value_tolerance: string;
  max_value_tolerance: string;
};

type CompositionEntry = {
  composition_source?: string;
  other_elements?: ChemicalElement[];
  composition_subsource?: string;
  comment?: string;
  base_element?: string;
  note?: string;
};

type ChemicalPropertiesData = {
  composition?: CompositionEntry[];
};

type ElementChartPoint = {
  name: string;
  value: number;
  /** Для log-шкалы: 0 недопустим, рисуем ε, в tooltip — value */
  displayValue: number;
  fill: string;
};

type Elements = {
  symbol: string;
  display_symbol: string;
  name: string;
  color: string | null;
  influence: string | null;
  min?: number | null;
}

type ElementsCatalog = {
  shema_version?: string;
  elements: Elements[];
}

type ChartMode = "min" | "max";


const elements = elements_catalog as ElementsCatalog;


function buildElementChartData(
  elementss: ChemicalElement[],
  baseElement: string,
  mode: ChartMode,
): ElementChartPoint[] {
  const plotData: ElementChartPoint[] = [];
  let total = 0;

  for (const el of elementss) {
    const sym = el.element?.trim();
    if (!sym) continue;

    const raw = mode === "max" ? el.max_value : el.min_value;
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    if (value > 0) total += value;

    plotData.push({
      name: sym,
      value,
      displayValue: value > 0 ? value : 0.0001,
      fill: elements.elements.find(el => el.symbol === sym)?.color ?? "#3D5A80",
    });
  }

  const baseSym = baseElement.trim() || "Основа";
  const basePercent = Math.max(0, 100 - total);
  plotData.push({
    name: baseSym,
    value: basePercent,
    displayValue: basePercent > 0 ? basePercent : 0.0001,
    fill: elements.elements.find(el => el.symbol === baseSym)?.color ?? "#3D5A80",
  });

  plotData.sort((a, b) => a.value - b.value);
  return plotData;
}



type ElementDistributionChartProps = {
  data: ElementChartPoint[];
  unit: string;
  mode: ChartMode;
  onModeChange: (mode: ChartMode) => void;
};



function ElementDistributionChart({
  data,
  unit,
  mode,
  onModeChange,
}: ElementDistributionChartProps) {
  const height = Math.max(280, data.length * 36);

  return (
    <div className="property-section-chart">
      <div className="form-row" style={{ marginBottom: 8 }}>
        <label className="checkbox-item" htmlFor="chem_chart_min">
          <input
            id="chem_chart_min"
            type="checkbox"
            checked={mode === "min"}
            onChange={() => onModeChange("min")}
          />
          Min
        </label>
        <label className="checkbox-item" htmlFor="chem_chart_max">
          <input
            id="chem_chart_max"
            type="checkbox"
            checked={mode === "max"}
            onChange={() => onModeChange("max")}
          />
          Max
        </label>
      </div>
      {data.length === 0 ? (
        <p className="tab-placeholder">Нет данных для графика</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ left: 8, right: 48, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              scale="log"
              domain={[0.0001, "auto"]}
              allowDataOverflow
            />
            <YAxis type="category" dataKey="name" width={48} />
            <Tooltip
              formatter={(_value, _name, item) => {
                const point = item?.payload as ElementChartPoint | undefined;
                const v = point?.value ?? 0;
                const text =
                  v < 0.1 ? v.toFixed(4).replace(/\.?0+$/, "") : v.toFixed(2);
                return [`${text} ${unit}`, mode === "max" ? "Max" : "Min"];
              }}
            />
            <Bar dataKey="displayValue" name="value" maxBarSize={22}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function ChemicalProperties({
  material,
  onDraftChange,
}: ChemicalPropertiesProps) {
  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }
  
  const result = useQuery({
    queryKey: ["sources"],
    queryFn: getSources,
  });
  const [compositionSourceIndex, setCompositionSourceIndex] = useState(0);
  const [chartMode, setChartMode] = useState<ChartMode>("max");
  
  const chemical_properties = (material.chemical_properties ??
    {}) as ChemicalPropertiesData;
  const chemicalSources = result.data?.chemical_sources ?? [];
  const chemicalElements = ["Fe", "Ti", "Cu"];
  const currentElement =
    chemical_properties.composition?.[compositionSourceIndex]?.base_element ??
    "";
  const currentSource =
    chemical_properties.composition?.[compositionSourceIndex]
      ?.composition_source ?? "";
  const sourceNames = chemicalSources.map((src) => src.name_source);
  const showOrphan =
    currentSource !== "" && !sourceNames.includes(currentSource);
  const showOrphanelement =
    currentElement !== "" && !chemicalElements.includes(currentElement);

  const currentComposition =
    chemical_properties.composition?.[compositionSourceIndex];
  const otherElements = currentComposition?.other_elements ?? [];
  const chartUnit = otherElements[0]?.unit_value ?? "%";
  const chartData = buildElementChartData(
    otherElements,
    currentComposition?.base_element ?? "",
    chartMode,
  );

  const [contextMenu, setContextMenu] = useState<{  
    x: number; 
    y: number; 
    rowIndex: number | null;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  
  // Обработчик клика вне меню
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
  
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  
  // Добавление новой пустой строки
const handleAddRow = () => {
  const newElement: ChemicalElement = {
    element: "",
    unit_value: chartUnit,
    min_value: 0,
    max_value: 0,
    min_value_tolerance: "",
    max_value_tolerance: "",
  };

  onDraftChange({
    ...material,
    chemical_properties: {
      ...chemical_properties,
      composition: (chemical_properties.composition ?? []).map((entry, entryIndex) =>
        entryIndex !== compositionSourceIndex
          ? entry
          : {
              ...entry,
              other_elements: [...(entry.other_elements ?? []), newElement],
            },
      ),
    },
  });
};

// Удаление строки
const handleRemoveRow = () => {
  if (selectedRowIndex === null) return; // Ничего не выбрано

  onDraftChange({
    ...material,
    chemical_properties: {
      ...chemical_properties,
      composition: (chemical_properties.composition ?? []).map((entry, entryIndex) =>
        entryIndex !== compositionSourceIndex
          ? entry
          : {
              ...entry,
              other_elements: (entry.other_elements ?? []).filter(
                (_, i) => i !== selectedRowIndex,
              ),
            },
      ),
    },
  });

  // Сбрасываем выделение после удаления
  setSelectedRowIndex(null);
};

// Обработчик выбора элемента из меню (обновленный)
const handleElementSelect = (element: Elements) => {
  if (!contextMenu) return;

  const { rowIndex } = contextMenu;

  if (rowIndex === null) {
    // РЕЖИМ ДОБАВЛЕНИЯ
    const newElement: ChemicalElement = {
      element: element.symbol,
      unit_value: chartUnit,
      min_value: 0,
      max_value: 0,
      min_value_tolerance: "",
      max_value_tolerance: "",
    };

    onDraftChange({
      ...material,
      chemical_properties: {
        ...chemical_properties,
        composition: (chemical_properties.composition ?? []).map((entry, entryIndex) =>
          entryIndex !== compositionSourceIndex
            ? entry
            : {
                ...entry,
                other_elements: [...(entry.other_elements ?? []), newElement],
              },
        ),
      },
    });
  } else {
    // РЕЖИМ РЕДАКТИРОВАНИЯ существующей строки
    onDraftChange({
      ...material,
      chemical_properties: {
        ...chemical_properties,
        composition: (chemical_properties.composition ?? []).map((entry, entryIndex) =>
          entryIndex !== compositionSourceIndex
            ? entry
            : {
                ...entry,
                other_elements: (entry.other_elements ?? []).map((el, elIndex) =>
                  elIndex !== rowIndex
                    ? el
                    : { ...el, element: element.symbol, min_value: element.symbol == "P+S" ? 0: el.min_value },
                ),
              },
        ),
      },
    });
  }

  setContextMenu(null);
};

// Обработчик правого клика (обновленный)
const handleRowContextMenu = (e: React.MouseEvent, index: number) => {
  e.preventDefault();
  setContextMenu({
    x: e.clientX,
    y: e.clientY,
    rowIndex: index, // индекс строки для редактирования
  });
};

// Обработчик правого клика для кнопки "+"
const handleAddButtonContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  setContextMenu({
    x: e.clientX,
    y: e.clientY,
    rowIndex: null, // null = режим добавления
  });
};

const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
const handleRowClick = (index: number) => {
  setSelectedRowIndex(index);
  setContextMenu(null); // Закрываем контекстное меню при клике
};
useEffect(() => {
  setSelectedRowIndex(null);
}, [compositionSourceIndex, otherElements.length]);

  return (
    <form
      className="general-form physical-properties-form"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="form-stack">
        <div className="form-row">
          <label htmlFor="composition_source_select">Набор состава:</label>
          <select
            id="composition_source_select"
            className="input"
            value={
              (chemical_properties.composition?.length ?? 0) > 0
                ? compositionSourceIndex
                : ""
            }
            onChange={(e) => {
              setCompositionSourceIndex(Number(e.target.value));
            }}
            disabled={(chemical_properties.composition?.length ?? 0) === 0}
          >
            {(chemical_properties.composition ?? []).map((cat, index) => (
              <option key={index} value={index}>
                {cat.composition_source?.trim()
                  ? cat.composition_source
                  : `Набор состава #${index + 1}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="table-control-btn"
            title="Добавить набор состава"
            onClick={() => {
              const prev = chemical_properties.composition ?? [];
              const newIndex = prev.length;
              const newEntry: CompositionEntry = {
                composition_source: "",
                other_elements: [],
                comment: "",
                base_element: "Fe",
              };
              onDraftChange({
                ...material,
                chemical_properties: {
                  ...chemical_properties,
                  composition: [...prev, newEntry],
                },
              });
              setCompositionSourceIndex(newIndex);
            }}
          >
            +
          </button>
          <button
            type="button"
            className="table-control-btn"
            title="Удалить набор состава"
            disabled={(chemical_properties.composition?.length ?? 0) === 0}
            onClick={() => {
              const prev = chemical_properties.composition ?? [];
              if (prev.length === 0) return;
              if (
                !window.confirm(
                  "Вы уверены, что хотите удалить этот источник хим. состава?",
                )
              ) {
                return;
              }
              const next = prev.filter((_, i) => i !== compositionSourceIndex);
              onDraftChange({
                ...material,
                chemical_properties: {
                  ...chemical_properties,
                  composition: next,
                },
              });
              setCompositionSourceIndex(0);
            }}
          >
            −
          </button>
        </div>
      </div>
      <div className="form-stack">
        <fieldset className="form-section">
          <legend>Данные источника</legend>
          <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
                <label htmlFor="composition_source">Источник:</label>
                <select
                  id="composition_source"
                  className="input"
                  value={
                    chemical_properties.composition?.[compositionSourceIndex]
                      ?.composition_source ?? ""
                  }
                  onChange={(e) => {
                    onDraftChange({
                      ...material,
                      chemical_properties: {
                        ...chemical_properties,
                        composition: (
                          chemical_properties.composition ?? []
                        ).map((entry, i) =>
                          i === compositionSourceIndex
                            ? { ...entry, composition_source: e.target.value }
                            : entry,
                        ),
                      },
                    });
                  }}> 
                  <option value="">-Выберите источник-</option>
                  {showOrphan && (
  <option key={`orphan-${currentSource}`} value={currentSource}>
    {currentSource}
  </option>
)}
{chemicalSources.map((src) => (
  <option
    key={src.id_source ?? src.name_source}
    value={src.name_source}
  >
    {src.name_source}
  </option>
))}
                  </select>
              </div>
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="commentId">Комментарий:</label>
            <input
              id="commentId"
              type="text"
              value={
                chemical_properties.composition?.[compositionSourceIndex]
                  ?.comment ?? ""
              }
              className="input"
              onChange={(e) => {
                onDraftChange({
                  ...material,
                  chemical_properties: {
                    ...chemical_properties,
                    composition: (chemical_properties.composition ?? []).map(
                      (entry, i) =>
                        i === compositionSourceIndex
                          ? { ...entry, comment: e.target.value }
                          : entry,
                    ),
                  },
                });
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="base_element">Основной элемент:</label>
            <select
              id="base_element"
              className="input"
              value={
                chemical_properties.composition?.[compositionSourceIndex]
                  ?.base_element ?? ""
              }
              onChange={(e) => {
                onDraftChange({
                  ...material,
                  chemical_properties: {
                    ...chemical_properties,
                    composition: (chemical_properties.composition ?? []).map(
                      (entry, i) =>
                        i === compositionSourceIndex
                          ? { ...entry, base_element: e.target.value }
                          : entry,
                    ),
                  },
                });
              }}
            >
              {showOrphanelement && (
                <option key={`orphan-${currentElement}`} value={currentElement}>
                  {currentElement}
                </option>
              )}
              {chemicalElements.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="composition_source_value_unit">Ед. изм:</label>
            <UnitSelect
              id="composition_source_value_unit"
              unitType="Безразмерный"
              value={
                chemical_properties.composition?.[compositionSourceIndex]
                  ?.other_elements?.[0]?.unit_value ?? ""
              }
              onChange={(nextUnit) => {
                onDraftChange({
                  ...material,
                  chemical_properties: {
                    ...chemical_properties,
                    composition: (chemical_properties.composition ?? []).map(
                      (entry, i) =>
                        i === compositionSourceIndex
                          ? {
                              ...entry,
                              other_elements: (entry.other_elements ?? []).map(
                                (el) => ({
                                  ...el,
                                  unit_value: nextUnit,
                                }),
                              ),
                            }
                          : entry,
                    ),
                  },
                });
              }}
            />
          </div>
        </fieldset>
        <div className="property-section-layout">
          <div className="property-section-fields">
          <legend>Элементы(ПКМ для выбора из списка)</legend>
            <div className="table-wrapper">
            
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Название элемента</th>
                    <th>Элемент</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Допуск Min</th>
                    <th>Допуск Max</th>
                  </tr>
                </thead>
                <tbody>
  {otherElements.map((row, i) => (
    <tr 
      key={i} 
      className={selectedRowIndex === i ? 'table-row-selected' : ''}
      onClick={() => handleRowClick(i)}
      onContextMenu={(e) => handleRowContextMenu(e, i)}
    >
      <td>{elements.elements.find(el => el.symbol === row.element)?.name}</td>
                      <td>
                        <input
                          className="table-cell-input"
                          type="text"
                          value={row.element ?? ""}
                          onChange={(e) => {
                            const nextElement = e.target.value;
                            onDraftChange({
                              ...material,
                              chemical_properties: {
                                ...chemical_properties,
                                composition: (
                                  chemical_properties.composition ?? []
                                ).map((entry, entryIndex) =>
                                  entryIndex !== compositionSourceIndex
                                    ? entry
                                    : {
                                        ...entry,
                                        other_elements: (
                                          entry.other_elements ?? []
                                        ).map((el, elIndex) =>
                                          elIndex !== i
                                            ? el
                                            : { ...el, element: nextElement },
                                        ),
                                      },
                                ),
                              },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                          type="number"
                          value={row.min_value ?? ""}
                          onChange={(e) => {
                            const nextValue = Number(e.target.value);
                            onDraftChange({
                              ...material,
                              chemical_properties: {
                                ...chemical_properties,
                                composition: (
                                  chemical_properties.composition ?? []
                                ).map((entry, entryIndex) =>
                                  entryIndex !== compositionSourceIndex
                                    ? entry
                                    : {
                                        ...entry,
                                        other_elements: (
                                          entry.other_elements ?? []
                                        ).map((el, elIndex) =>
                                          elIndex !== i
                                            ? el
                                            : { ...el, min_value: nextValue },
                                        ),
                                      },
                                ),
                              },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                          type="number"
                          value={row.max_value ?? ""}
                          onChange={(e) => {
                            const nextValue = Number(e.target.value);
                            onDraftChange({
                              ...material,
                              chemical_properties: {
                                ...chemical_properties,
                                composition: (
                                  chemical_properties.composition ?? []
                                ).map((entry, entryIndex) =>
                                  entryIndex !== compositionSourceIndex
                                    ? entry
                                    : {
                                        ...entry,
                                        other_elements: (
                                          entry.other_elements ?? []
                                        ).map((el, elIndex) =>
                                          elIndex !== i
                                            ? el
                                            : { ...el, max_value: nextValue },
                                        ),
                                      },
                                ),
                              },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                          type="text"
                          value={row.min_value_tolerance ?? ""}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            onDraftChange({
                              ...material,
                              chemical_properties: {
                                ...chemical_properties,
                                composition: (
                                  chemical_properties.composition ?? []
                                ).map((entry, entryIndex) =>
                                  entryIndex !== compositionSourceIndex
                                    ? entry
                                    : {
                                        ...entry,
                                        other_elements: (
                                          entry.other_elements ?? []
                                        ).map((el, elIndex) =>
                                          elIndex !== i
                                            ? el
                                            : {
                                                ...el,
                                                min_value_tolerance: nextValue,
                                              },
                                        ),
                                      },
                                ),
                              },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                          type="text"
                          value={row.max_value_tolerance ?? ""}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            onDraftChange({
                              ...material,
                              chemical_properties: {
                                ...chemical_properties,
                                composition: (
                                  chemical_properties.composition ?? []
                                ).map((entry, entryIndex) =>
                                  entryIndex !== compositionSourceIndex
                                    ? entry
                                    : {
                                        ...entry,
                                        other_elements: (
                                          entry.other_elements ?? []
                                        ).map((el, elIndex) =>
                                          elIndex !== i
                                            ? el
                                            : {
                                                ...el,
                                                max_value_tolerance: nextValue,
                                              },
                                        ),
                                      },
                                ),
                              },
                            });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="table-controls">
  <button 
    type="button"
    className="table-control-btn"
    onClick={handleAddRow}
    onContextMenu={handleAddButtonContextMenu}
    title="Добавить элемент"
  >
    +
  </button>
  <button 
    type="button"
    className="table-control-btn"
    onClick={handleRemoveRow}
    disabled={selectedRowIndex === null}
    title={selectedRowIndex === null ? "Сначала выберите строку" : "Удалить выбранную строку"}
  >
    −
  </button>
</div>
            </div>
            {contextMenu && (
  <div 
    ref={menuRef}
    className="context-menu"
    style={{
      position: 'fixed',
      top: contextMenu.y,
      left: contextMenu.x,
      zIndex: 1000
    }}
  >
    <div className="context-menu-header">
      {contextMenu.rowIndex === null 
        ? "Добавить элемент:" 
        : "Заменить элемент:"}
    </div>
    {elements.elements.map((element, index) => (
      <div 
        key={index}
        className="context-menu-item"
        onClick={() => handleElementSelect(element)}
      >
        {element.name} ({element.symbol})
      </div>
    ))}
  </div>
)}
          </div>
          <ElementDistributionChart
            data={chartData}
            unit={chartUnit}
            mode={chartMode}
            onModeChange={setChartMode}
          />
        </div>
        <div className="note-field">
      <label className="note-label">Примечание</label>
      <textarea
        className="note-textarea"
        value={
          chemical_properties.composition?.[compositionSourceIndex]
            ?.note ?? ""
        }
        onChange={(e) => {
          onDraftChange({
            ...material,
            chemical_properties: {
              ...chemical_properties,
              composition: (chemical_properties.composition ?? []).map(
                (entry, i) =>
                  i === compositionSourceIndex
                    ? { ...entry, note: e.target.value }
                    : entry,
              ),
            },
          });
        }}
        placeholder="Введите примечание..."
        rows={6}
      />
    </div>
      </div>
    </form>
  );
}
