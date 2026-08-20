import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { ApplicationAreaFilter } from "../components/ApplicationAreaFilter";
import { TabErrorBoundary } from "../components/TabErrorBoundary";
import { useWorkspace } from "../context/WorkSpaceContext";
import { useSourcesCatalog } from "../hooks/useSourcesCatalog";
import { PanelResizeHandle } from "../components/PanelResizeHandle";
import { useDragResize } from "../hooks/useDragResize";
import { useResizableTableHeaders } from "../hooks/useResizableTableHeaders";
import { getChemCompositionEntries } from "../api/selection";
import type { CompositionEntry } from "../lib/chemComparisonPivot";
import {
  buildChemCompositionCache,
  candidateRowClass,
  collectTargets,
  DETAIL_STATE_LABELS,
  detailRowClass,
  evaluateAllCandidates,
  formatDetailNumber,
  type CandidateEvaluation,
} from "../lib/chemTargetSelection";
import {
  ELEMENTS_SORTED,
  elementDisplayName,
  parseElementInfluence,
} from "../lib/elementsCatalog";

type TargetRow = {
  id: string;
  element: string;
  target: string;
};

function createTargetRow(element = "-", target = ""): TargetRow {
  return {
    id: crypto.randomUUID(),
    element,
    target,
  };
}

export function ChemComparisonScenario2Tab() {
  const { workspace } = useWorkspace();
  const areaOptions = workspace?.application_areas ?? [];
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [targetRows, setTargetRows] = useState<TargetRow[]>([createTargetRow()]);
  const [selectedTargetRowId, setSelectedTargetRowId] = useState<string | null>(
    null,
  );
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const targetTableRef = useRef<HTMLTableElement>(null);
  const resultsTableRef = useRef<HTMLTableElement>(null);
  const detailsTableRef = useRef<HTMLTableElement>(null);
  const targetScrollRef = useRef<HTMLDivElement>(null);
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const detailsScrollRef = useRef<HTMLDivElement>(null);
  useResizableTableHeaders(targetTableRef, { eventRootRef: targetScrollRef });
  useResizableTableHeaders(resultsTableRef, { eventRootRef: resultsScrollRef });
  useResizableTableHeaders(detailsTableRef, { eventRootRef: detailsScrollRef });
  const [pickerState, setPickerState] = useState<{
    rowId: string;
    x: number;
    y: number;
  } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const entriesQuery = useQuery({
    queryKey: ["chem-composition-entries"],
    queryFn: getChemCompositionEntries,
    enabled: Boolean(workspace),
  });
  const sourcesQuery = useSourcesCatalog();
  const chemicalSources = sourcesQuery.data?.chemical_sources ?? [];

  const compositionCache = useMemo(() => {
    const entries = entriesQuery.data?.entries ?? [];
    return buildChemCompositionCache(
      entries.map((entry) => ({
        material_id: entry.material_id,
        material_name: entry.material_name,
        areas: entry.areas,
        composition: entry.composition as CompositionEntry,
      })),
      chemicalSources,
    );
  }, [entriesQuery.data, chemicalSources]);

  const targets = useMemo(
    () => collectTargets(targetRows),
    [targetRows],
  );

  const candidates = useMemo(
    () => evaluateAllCandidates(compositionCache, targets, selectedAreas),
    [compositionCache, targets, selectedAreas],
  );

  useEffect(() => {
    if (candidates.length === 0) {
      setSelectedCandidateIndex(0);
      return;
    }
    setSelectedCandidateIndex((prev) =>
      prev < candidates.length ? prev : 0,
    );
  }, [candidates.length]);

  const selectedCandidate: CandidateEvaluation | null =
    candidates[selectedCandidateIndex] ?? null;

  const closePicker = useCallback(() => setPickerState(null), []);

  const sidebarResize = useDragResize({
    axis: "x",
    initial: 320,
    min: 260,
    max: 480,
    storageKey: "chem-s2-sidebar-width",
  });
  const resultsResize = useDragResize({
    axis: "y",
    initial: 220,
    min: 120,
    max: 600,
    storageKey: "chem-s2-results-height",
  });
  const detailsResize = useDragResize({
    axis: "y",
    initial: 220,
    min: 120,
    max: 600,
    storageKey: "chem-s2-details-height",
  });

  useEffect(() => {
    if (!pickerState) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        closePicker();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [pickerState, closePicker]);

  const updateTargetRow = (
    rowId: string,
    field: "element" | "target",
    value: string,
  ) => {
    setTargetRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addTargetRow = () => {
    const row = createTargetRow();
    setTargetRows((prev) => [...prev, row]);
    setSelectedTargetRowId(row.id);
  };

  const removeSelectedTargetRows = () => {
    setTargetRows((prev) => {
      const removeId = selectedTargetRowId ?? prev.at(-1)?.id;
      if (!removeId || prev.length <= 1) {
        return prev;
      }
      const next = prev.filter((row) => row.id !== removeId);
      setSelectedTargetRowId(next.at(-1)?.id ?? null);
      return next;
    });
  };

  const handleElementContextMenu = (
    event: ReactMouseEvent,
    rowId: string,
  ) => {
    event.preventDefault();
    setPickerState({ rowId, x: event.clientX, y: event.clientY });
  };

  const pickElement = (symbol: string) => {
    if (!pickerState) {
      return;
    }
    updateTargetRow(pickerState.rowId, "element", symbol);
    closePicker();
  };

  const toleranceType = selectedCandidate?.composition.tolerance_type;
  const unit = selectedCandidate?.unit || "%";
  const tolUnit =
    toleranceType === "relative" ? "%" : unit;

  if (!workspace) {
    return <p className="tab-placeholder">Откройте workspace с материалами</p>;
  }

  return (
    <TabErrorBoundary resetKey={`${selectedAreas.join(",")}-${targetRows.length}`}>
      <div className="chem-comparison-layout chem-comparison-layout--target chem-comparison-layout--resizable">
        <aside
          className="chem-comparison-sidebar chem-comparison-sidebar--target chem-comparison-sidebar--resizable"
          style={sidebarResize.style}
        >
          <div
            className="chem-comparison-sidebar-field"
            data-tour="chem-s2-area"
          >
            <label htmlFor="chem-s2-area-filter">Область применения:</label>
            <ApplicationAreaFilter
              id="chem-s2-area-filter"
              options={areaOptions}
              selected={selectedAreas}
              onChange={setSelectedAreas}
            />
          </div>

          <section className="chem-target-panel">
            <h3 className="chem-target-panel-title">Целевой химический состав</h3>

            <div className="chem-target-toolbar">
              <button type="button" className="btn btn--icon" onClick={addTargetRow} title="Добавить строку">
                +
              </button>
              <button
                type="button"
                className="btn btn--icon"
                onClick={removeSelectedTargetRows}
                title="Удалить строку"
              >
                −
              </button>
            </div>

            <div
              ref={targetScrollRef}
              className="chem-target-table-wrap"
              data-tour="chem-s2-target-table"
            >
              <table ref={targetTableRef} className="data-table chem-target-table">
                <thead>
                  <tr>
                    <th>Элемент</th>
                    <th>Target, %</th>
                  </tr>
                </thead>
                <tbody>
                  {targetRows.map((row) => (
                    <tr
                      key={row.id}
                      data-row-id={row.id}
                      className={
                        row.id === selectedTargetRowId ? "is-selected" : undefined
                      }
                      onClick={() => setSelectedTargetRowId(row.id)}
                    >
                      <td>
                        <input
                          type="text"
                          className="input input--table"
                          value={row.element}
                          onChange={(event) =>
                            updateTargetRow(row.id, "element", event.target.value)
                          }
                          onContextMenu={(event) =>
                            handleElementContextMenu(event, row.id)
                          }
                          title="ПКМ — выбор из справочника элементов"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="input input--table"
                          value={row.target}
                          onChange={(event) =>
                            updateTargetRow(row.id, "target", event.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="chem-target-hint">
              Заполните элементы и целевые значения.
              Таблица справа будет обновляться автоматически.
            </p>
          </section>
        </aside>

        <PanelResizeHandle
          direction="vertical"
          onMouseDown={sidebarResize.onHandleMouseDown}
        />

        <main className="chem-comparison-main chem-comparison-main--target chem-comparison-main--resizable">
          {entriesQuery.isPending && (
            <p className="tab-placeholder">Загрузка данных составов…</p>
          )}
          {entriesQuery.isError && (
            <p className="tab-placeholder tab-placeholder--error">
              {entriesQuery.error.message}
            </p>
          )}

          {entriesQuery.isSuccess && (
            <>
              <section
                className="chem-target-panel chem-target-panel--results chem-target-panel-slot"
                style={resultsResize.style}
              >
                <h3 className="chem-target-panel-title">
                  Результаты подбора материалов
                </h3>
                <div ref={resultsScrollRef} className="chem-target-results-scroll">
                  <table
                    ref={resultsTableRef}
                    className="data-table chem-target-results-table"
                    data-tour="chem-s2-results-table"
                  >
                    <thead>
                      <tr>
                        <th>Материал</th>
                        <th>Источник</th>
                        <th>Основа</th>
                        <th>Совпавших</th>
                        <th>Всего</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(targets).length === 0 && (
                        <tr>
                          <td colSpan={6} className="chem-target-empty">
                            Укажите целевой состав слева
                          </td>
                        </tr>
                      )}
                      {Object.keys(targets).length > 0 &&
                        candidates.length === 0 && (
                          <tr>
                            <td colSpan={6} className="chem-target-empty">
                              Кандидаты не найдены
                            </td>
                          </tr>
                        )}
                      {candidates.map((candidate, index) => (
                        <tr
                          key={`${candidate.materialId}-${candidate.sourceLabel}-${index}`}
                          className={`${candidateRowClass(candidate.status)}${
                            index === selectedCandidateIndex
                              ? " is-selected"
                              : ""
                          }`}
                          onClick={() => setSelectedCandidateIndex(index)}
                        >
                          <td>{candidate.materialName}</td>
                          <td>{candidate.sourceLabel}</td>
                          <td>{candidate.baseElement}</td>
                          <td>{candidate.matched}</td>
                          <td>{candidate.totalTargets}</td>
                          <td>{candidate.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <PanelResizeHandle
                direction="horizontal"
                onMouseDown={resultsResize.onHandleMouseDown}
              />

              <section
                className="chem-target-panel chem-target-panel--details chem-target-panel-slot"
                style={detailsResize.style}
              >
                <h3 className="chem-target-panel-title">
                  Детализированное сравнение по выбранному источнику
                </h3>
                <div ref={detailsScrollRef} className="chem-target-details-scroll">
                  <table ref={detailsTableRef} className="data-table chem-target-details-table">
                    <thead>
                      <tr>
                        <th>Элемент</th>
                        <th>{`Target, ${unit}`}</th>
                        <th>{`Min, ${unit}`}</th>
                        <th>{`Max, ${unit}`}</th>
                        <th>{`Допуск Min, ${tolUnit}`}</th>
                        <th>{`Допуск Max, ${tolUnit}`}</th>
                        <th>Статус</th>
                        <th>{`Δ до границы, ${unit}`}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!selectedCandidate && (
                        <tr>
                          <td colSpan={8} className="chem-target-empty">
                            Выберите кандидата в таблице результатов
                          </td>
                        </tr>
                      )}
                      {selectedCandidate &&
                        Object.keys(selectedCandidate.details)
                          .sort()
                          .map((symbol) => {
                            const detail = selectedCandidate.details[symbol]!;
                            const deltaStr =
                              detail.delta !== null &&
                              detail.delta !== undefined &&
                              detail.delta > 0
                                ? formatDetailNumber(detail.delta)
                                : "-";
                            return (
                              <tr
                                key={symbol}
                                className={detailRowClass(detail.state)}
                              >
                                <td>{symbol}</td>
                                <td>{formatDetailNumber(detail.target)}</td>
                                <td>{formatDetailNumber(detail.min)}</td>
                                <td>{formatDetailNumber(detail.max)}</td>
                                <td>{formatDetailNumber(detail.minTol)}</td>
                                <td>{formatDetailNumber(detail.maxTol)}</td>
                                <td>
                                  {DETAIL_STATE_LABELS[detail.state] ??
                                    "нет данных"}
                                </td>
                                <td>{deltaStr}</td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
              </section>

              <PanelResizeHandle
                direction="horizontal"
                onMouseDown={detailsResize.onHandleMouseDown}
              />

              <section className="chem-target-panel chem-target-panel--influence chem-target-panel-slot chem-target-panel-slot--flex">
                <h3 className="chem-target-panel-title">
                  Влияние элементов на свойства стали
                </h3>
                <div className="chem-target-influence-scroll">
                  {!selectedCandidate && (
                    <p className="chem-target-empty">
                      Выберите кандидата для просмотра влияния элементов
                    </p>
                  )}
                  {selectedCandidate &&
                    Object.keys(selectedCandidate.details)
                      .sort()
                      .map((symbol) => {
                        const lines = parseElementInfluence(symbol);
                        return (
                          <article
                            key={symbol}
                            className="chem-target-influence-item"
                          >
                            <p className="chem-target-influence-header">
                              {lines.header}
                            </p>
                            {lines.improves && (
                              <p className="chem-target-influence-line">
                                {lines.improves}
                              </p>
                            )}
                            {lines.reduces && (
                              <p className="chem-target-influence-line">
                                {lines.reduces}
                              </p>
                            )}
                          </article>
                        );
                      })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {pickerState && (
        <div
          ref={pickerRef}
          className="chem-target-element-picker"
          style={{ top: pickerState.y, left: pickerState.x }}
          role="listbox"
          aria-label="Выбор элемента"
        >
          <ul>
            {ELEMENTS_SORTED.map((item) => (
              <li key={item.symbol}>
                <button
                  type="button"
                  onClick={() => pickElement(item.symbol)}
                >
                  {elementDisplayName(item.symbol)} ({item.symbol})
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </TabErrorBoundary>
  );
}
