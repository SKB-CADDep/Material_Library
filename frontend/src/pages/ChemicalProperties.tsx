import { useSourcesCatalog } from "../hooks/useSourcesCatalog";
import { useState, useRef, useEffect } from "react";
import elements_catalog from '../config/elements_catalog.json'
import { UnitSelect } from "./UnitSelect";
import { RequiredMark } from "../components/RequiredMark";
import { RequiredFieldsFootnote } from "../components/RequiredFieldsFootnote";
import {
  ChemicalCompositionChart,
  buildElementChartData,
  type ChartMode,
} from "../components/ChemicalCompositionChart";
import { usePropertiesCatalog } from "../hooks/usePropertiesCatalog";
import { useResizableTableHeaders } from "../hooks/useResizableTableHeaders";
import { parseDecimalInput } from "../lib/formatDecimal";

type ChemicalPropertiesProps = {
  material: Record<string, unknown> | undefined;
  onDraftChange: (next: Record<string, unknown>) => void;
  readOnly?: boolean;
};

type ToleranceType = "absolute" | "relative";

type ChemicalElement = {
  element: string;
  unit_value: string;
  min_value: number;
  max_value: number;
  min_value_tolerance: string;
  max_value_tolerance: string;
  min_value_tolerance_relative: string;
  max_value_tolerance_relative: string;
};

type CompositionEntry = {
  composition_source?: string;
  other_elements?: ChemicalElement[];
  composition_subsource?: string;
  comment?: string;
  base_element?: string;
  note?: string;
  tolerance_type?: ToleranceType;
};

const EMPTY_ELEMENT: ChemicalElement = {
  element: "",
  unit_value: "%",
  min_value: 0,
  max_value: 0,
  min_value_tolerance: "",
  max_value_tolerance: "",
  min_value_tolerance_relative: "",
  max_value_tolerance_relative: "",
};

function normalizeElement(raw: Partial<ChemicalElement>): ChemicalElement {
  return {
    ...EMPTY_ELEMENT,
    ...raw,
    min_value_tolerance: raw.min_value_tolerance ?? "",
    max_value_tolerance: raw.max_value_tolerance ?? "",
    min_value_tolerance_relative: raw.min_value_tolerance_relative ?? "",
    max_value_tolerance_relative: raw.max_value_tolerance_relative ?? "",
  };
}

function toStoredElement(el: ChemicalElement): ChemicalElement {
  const stored: Record<string, unknown> = {
    element: el.element,
    unit_value: el.unit_value,
    min_value: el.min_value,
    max_value: el.max_value,
  };
  if (el.min_value_tolerance) stored.min_value_tolerance = el.min_value_tolerance;
  if (el.max_value_tolerance) stored.max_value_tolerance = el.max_value_tolerance;
  if (el.min_value_tolerance_relative) {
    stored.min_value_tolerance_relative = el.min_value_tolerance_relative;
  }
  if (el.max_value_tolerance_relative) {
    stored.max_value_tolerance_relative = el.max_value_tolerance_relative;
  }
  return stored as ChemicalElement;
}

type ChemicalPropertiesData = {
  composition?: CompositionEntry[];
};

type Elements = {
  symbol: string;
  display_symbol: string;
  name: string;
  color: string | null;
  influence: string | null;
  min?: number | null;
};

type ElementsCatalog = {
  shema_version?: string;
  elements: Elements[];
};

const elements = elements_catalog as ElementsCatalog;

export function ChemicalProperties({
  material,
  onDraftChange,
  readOnly = false,
}: ChemicalPropertiesProps) {
  const propertiesCatalog = usePropertiesCatalog();
  const result = useSourcesCatalog();
  const [compositionSourceIndex, setCompositionSourceIndex] = useState(0);
  const [chartMode, setChartMode] = useState<ChartMode>("max");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIndex: number | null;
  } | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const elementsTableRef = useRef<HTMLTableElement>(null);
  useResizableTableHeaders(elementsTableRef);

  const materialId = material?.material_id as string | undefined;
  const compositionLength =
    (
      (material?.chemical_properties as ChemicalPropertiesData | undefined)
        ?.composition ?? []
    ).length;
  const previewCompositionIndex =
    compositionLength === 0
      ? 0
      : Math.min(compositionSourceIndex, compositionLength - 1);
  const externalNote =
    (
      (material?.chemical_properties as ChemicalPropertiesData | undefined)
        ?.composition?.[previewCompositionIndex]?.note ?? ""
    );
  const [noteValue, setNoteValue] = useState(externalNote);

  useEffect(() => {
    setNoteValue(externalNote);
  }, [materialId, previewCompositionIndex, externalNote]);

  useEffect(() => {
    setCompositionSourceIndex(0);
    setSelectedRowIndex(null);
    setContextMenu(null);
  }, [materialId]);

  useEffect(() => {
    if (compositionLength === 0) {
      setCompositionSourceIndex(0);
      return;
    }
    setCompositionSourceIndex((prev) =>
      Math.min(prev, compositionLength - 1),
    );
  }, [compositionLength]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    setSelectedRowIndex(null);
  }, [compositionSourceIndex, compositionLength]);

  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }

  const chemical_properties = (material.chemical_properties ??
    {}) as ChemicalPropertiesData;
  const compositionList = chemical_properties.composition ?? [];
  const safeCompositionIndex =
    compositionList.length === 0
      ? 0
      : Math.min(compositionSourceIndex, compositionList.length - 1);
  const chemicalSources = result.data?.chemical_sources ?? [];
  const chemicalElements = ["Fe", "Ti", "Cu"];
  const currentElement =
    compositionList[safeCompositionIndex]?.base_element ?? "";
  const currentSource =
    compositionList[safeCompositionIndex]?.composition_source ?? "";
  const sourceNames = chemicalSources.map((src) => src.name_source);
  const showOrphan =
    currentSource !== "" && !sourceNames.includes(currentSource);
  const showOrphanelement =
    currentElement !== "" && !chemicalElements.includes(currentElement);

  const currentComposition = compositionList[safeCompositionIndex];
  const toleranceType: ToleranceType =
    currentComposition?.tolerance_type === "relative" ? "relative" : "absolute";
  const otherElements = (currentComposition?.other_elements ?? []).map((row) =>
    normalizeElement(row),
  );

  const updateCompositionAt = (
    updater: (entry: CompositionEntry) => CompositionEntry,
  ) => {
    if (compositionList.length === 0) {
      onDraftChange({
        ...material,
        chemical_properties: {
          ...chemical_properties,
          composition: [
            updater({
              composition_source: "",
              other_elements: [],
              comment: "",
              base_element: "Fe",
            }),
          ],
        },
      });
      return;
    }

    onDraftChange({
      ...material,
      chemical_properties: {
        ...chemical_properties,
        composition: compositionList.map((entry, entryIndex) =>
          entryIndex !== safeCompositionIndex ? entry : updater(entry),
        ),
      },
    });
  };

  const updateElementAt = (rowIndex: number, patch: Partial<ChemicalElement>) => {
    updateCompositionAt((entry) => ({
      ...entry,
      other_elements: (entry.other_elements ?? []).map((el, elIndex) =>
        elIndex !== rowIndex
          ? toStoredElement(normalizeElement(el))
          : toStoredElement({ ...normalizeElement(el), ...patch }),
      ),
    }));
  };
  const chartUnit = otherElements[0]?.unit_value ?? "%";
  const chartData = buildElementChartData(
    otherElements,
    currentComposition?.base_element ?? "",
    chartMode,
  );

const handleAddRow = () => {
  updateCompositionAt((entry) => ({
    ...entry,
    other_elements: [
      ...(entry.other_elements ?? []).map((el) => toStoredElement(normalizeElement(el))),
      toStoredElement({ ...EMPTY_ELEMENT, unit_value: chartUnit }),
    ],
  }));
};


const handleRemoveRow = () => {
  if (selectedRowIndex === null) return; // Ничего не выбрано

  onDraftChange({
    ...material,
    chemical_properties: {
      ...chemical_properties,
      composition: compositionList.map((entry, entryIndex) =>
        entryIndex !== safeCompositionIndex
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


  setSelectedRowIndex(null);
};

const handleElementSelect = (element: Elements) => {
  if (!contextMenu) return;

  const { rowIndex } = contextMenu;

  if (rowIndex === null) {
    updateCompositionAt((entry) => ({
      ...entry,
      other_elements: [
        ...(entry.other_elements ?? []).map((el) => toStoredElement(normalizeElement(el))),
        toStoredElement({
          ...EMPTY_ELEMENT,
          element: element.symbol,
          unit_value: chartUnit,
          min_value: element.symbol === "P+S" ? 0 : 0,
        }),
      ],
    }));
  } else {
    updateCompositionAt((entry) => ({
      ...entry,
      other_elements: (entry.other_elements ?? []).map((el, elIndex) =>
        elIndex !== rowIndex
          ? toStoredElement(normalizeElement(el))
          : toStoredElement({
              ...normalizeElement(el),
              element: element.symbol,
              min_value: element.symbol === "P+S" ? 0 : el.min_value,
            }),
      ),
    }));
  }

  setContextMenu(null);
};

const handleRowContextMenu = (e: React.MouseEvent, index: number) => {
  if (readOnly) return;
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
    rowIndex: null,
  });
};

const handleRowClick = (index: number) => {
  setSelectedRowIndex(index);
  setContextMenu(null);
};

  return (
    <form
      className="general-form physical-properties-form"
      inert={readOnly ? true : undefined}
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="form-stack">
        <div className="form-row">
          <label htmlFor="composition_source_select">Набор состава:</label>
          <div className="form-row-inline">
          <select
            id="composition_source_select"
            className="input"
            value={
              (chemical_properties.composition?.length ?? 0) > 0
                ? safeCompositionIndex
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
              const next = prev.filter((_, i) => i !== safeCompositionIndex);
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
      </div>
      <div className="form-stack">
        <fieldset className="form-section">
          <legend>Данные источника</legend>
          <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
                <label htmlFor="composition_source">
                  Источник
                  <RequiredMark />:
                </label>
                <select
                  id="composition_source"
                  className="input"
                  value={
                    compositionList[safeCompositionIndex]
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
                          i === safeCompositionIndex
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
              <RequiredFieldsFootnote />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="commentId">Комментарий:</label>
            <input
              id="commentId"
              type="text"
              value={
                compositionList[safeCompositionIndex]
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
                        i === safeCompositionIndex
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
                compositionList[safeCompositionIndex]
                  ?.base_element ?? ""
              }
              onChange={(e) => {
                onDraftChange({
                  ...material,
                  chemical_properties: {
                    ...chemical_properties,
                    composition: (chemical_properties.composition ?? []).map(
                      (entry, i) =>
                        i === safeCompositionIndex
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
            <label htmlFor="composition_tolerance_type">Тип допуска для подбора:</label>
            <select
              id="composition_tolerance_type"
              className="input"
              value={toleranceType}
              onChange={(e) => {
                const nextType = e.target.value as ToleranceType;
                updateCompositionAt((entry) => {
                  if (nextType === "relative") {
                    return { ...entry, tolerance_type: "relative" };
                  }
                  const { tolerance_type: _removed, ...rest } = entry;
                  return rest;
                });
              }}
            >
              <option value="absolute">Абсолютный</option>
              <option value="relative">Относительный (%)</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="composition_source_value_unit">Ед. изм:</label>
            <UnitSelect
              id="composition_source_value_unit"
              unitType={propertiesCatalog.data?.mechanical["relative_elongation"]?.unit_type ?? ""}
              value={
                compositionList[safeCompositionIndex]
                  ?.other_elements?.[0]?.unit_value ?? ""
              }
              onChange={(nextUnit) => {
                onDraftChange({
                  ...material,
                  chemical_properties: {
                    ...chemical_properties,
                    composition: (chemical_properties.composition ?? []).map(
                      (entry, i) =>
                        i === safeCompositionIndex
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
          <fieldset className="property-section-fields">
          <legend>Элементы(ПКМ для выбора из списка)</legend>
            <div className="table-wrapper table-wrapper--chemical-elements">
              <table ref={elementsTableRef} className="data-table data-table--chemical-elements">
                <thead>
                  <tr>
                    <th>Название элемента</th>
                    <th>Элемент</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Допуск Min (абс.)</th>
                    <th>Допуск Max (абс.)</th>
                    <th>Допуск Min (отн., %)</th>
                    <th>Допуск Max (отн., %)</th>
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
                          onChange={(e) => updateElementAt(i, { element: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                        
                          value={row.min_value ?? ""}
                          onChange={(e) =>
                            updateElementAt(i, {
                              min_value: parseDecimalInput(e.target.value) ?? Number.NaN,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                          value={row.max_value ?? ""}
                          onChange={(e) =>
                            updateElementAt(i, {
                              max_value: parseDecimalInput(e.target.value) ?? Number.NaN,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                          type="text"
                          value={row.min_value_tolerance}
                          title="Абсолютный нижний предел допуска"
                          onChange={(e) =>
                            updateElementAt(i, { min_value_tolerance: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                          type="text"
                          value={row.max_value_tolerance}
                          title="Абсолютный верхний предел допуска"
                          onChange={(e) =>
                            updateElementAt(i, { max_value_tolerance: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                          type="text"
                          value={row.min_value_tolerance_relative}
                          title="Относительный допуск к Min, %"
                          onChange={(e) =>
                            updateElementAt(i, {
                              min_value_tolerance_relative: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="table-cell-input"
                          type="text"
                          value={row.max_value_tolerance_relative}
                          title="Относительный допуск к Max, %"
                          onChange={(e) =>
                            updateElementAt(i, {
                              max_value_tolerance_relative: e.target.value,
                            })
                          }
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
          </fieldset>
          <ChemicalCompositionChart
            data={chartData}
            unit={chartUnit}
            mode={chartMode}
            onModeChange={setChartMode}
          />
        </div>
        <div className="note-field">
      <label className="note-label" htmlFor="composition_note">
        Примечание
      </label>
      <textarea
        id="composition_note"
        className="note-textarea"
        value={noteValue}
        onChange={(event) => {
          const value = event.target.value;
          setNoteValue(value);
          updateCompositionAt((entry) => ({
            ...entry,
            note: value,
          }));
        }}
        placeholder="Введите примечание..."
        rows={6}
      />
    </div>
      </div>
    </form>
  );
}
