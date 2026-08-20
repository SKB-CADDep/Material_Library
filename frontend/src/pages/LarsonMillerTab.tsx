import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LarsonMillerChart } from "../components/LarsonMillerChart";
import { TabErrorBoundary } from "../components/TabErrorBoundary";
import { useWorkspace } from "../context/WorkSpaceContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { listMaterials, getMaterial } from "../api/materials";
import { postLarsonMiller } from "../api/selection";
import type { LarsonMillerCustomPoint } from "../types/api";

const LARSON_MILLER_DEBOUNCE_MS = 600;

const PREDEFINED_HOURS = [10_000, 100_000, 200_000, 250_000] as const;
const MATERIAL_PLACEHOLDER = "— не выбран —";
const HOURS_OTHER_LABEL = "Другое";
const CUSTOM_HOURS_PLACEHOLDER = "Срок службы, ч";
/** Запас под стрелку выпадающего списка (в единицах ch). */
const SELECT_ARROW_PADDING_CH = 4;
/** Минимальная ширина списка срока службы (длиннее «250 000» + стрелка). */
const HOURS_SELECT_MIN_CH = 14;
const P_FORMULA_HINT = "P = (T + 273,15) x (lg τ + C) / 1000";
const STRESS_FORMULA_HINT =
  "σ д.п. определяется на основании параметрической зависимости Ларсона-Миллера";
const FORMULA_HINT_VIEWPORT_GAP = 12;

function selectWidthCh(
  labels: Iterable<string>,
  options?: { minCh?: number; arrowPaddingCh?: number },
): string {
  const minCh = options?.minCh ?? 0;
  const arrowPaddingCh = options?.arrowPaddingCh ?? SELECT_ARROW_PADDING_CH;
  let maxLen = 0;
  for (const label of labels) {
    if (label.length > maxLen) {
      maxLen = label.length;
    }
  }
  return `${Math.max(maxLen + arrowPaddingCh, minCh)}ch`;
}

function selectFitStyle(widthCh: string): { width: string; minWidth: string } {
  return { width: widthCh, minWidth: widthCh };
}

type StrengthCategory = {
  value_strength_category?: string;
  [key: string]: unknown;
};

type MechanicalProperties = {
  strength_category?: StrengthCategory[];
};

type ManualColumn = {
  id: string;
  temperature: string;
  stress: string;
};

function formatServiceHours(hours: number): string {
  return hours.toLocaleString("ru-RU");
}

function parseNumericInput(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function nextColumnId(): string {
  return `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function FormulaHint({
  value,
  formula,
}: {
  value: string;
  formula: string;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{ left: number; top: number } | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;

      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
      left = Math.max(
        FORMULA_HINT_VIEWPORT_GAP,
        Math.min(left, viewportWidth - popoverRect.width - FORMULA_HINT_VIEWPORT_GAP),
      );

      let top = anchorRect.top - popoverRect.height - 10;
      if (top < FORMULA_HINT_VIEWPORT_GAP) {
        top = Math.min(
          viewportHeight - popoverRect.height - FORMULA_HINT_VIEWPORT_GAP,
          anchorRect.bottom + 10,
        );
      }

      setPopoverStyle({ left, top });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [formula, isOpen]);

  return (
    <span
      ref={anchorRef}
      className="larson-miller-formula-hint"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      tabIndex={0}
    >
      <span className="larson-miller-formula-hint__value">{value}</span>
      {isOpen && (
        <span
          ref={popoverRef}
          className="larson-miller-formula-hint__popover larson-miller-formula-hint__popover--open"
          style={
            popoverStyle
              ? { left: `${popoverStyle.left}px`, top: `${popoverStyle.top}px` }
              : undefined
          }
        >
          {formula}
        </span>
      )}
    </span>
  );
}

export function LarsonMillerTab() {
  const { workspace } = useWorkspace();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const materialListRef = useRef<Array<{ id: string; name: string }>>([]);
  const pendingAutoSelectRef = useRef(false);
  const shouldResetAfterTourRef = useRef(false);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  const [hoursChoice, setHoursChoice] = useState<string>("100000");
  const [baseServiceHours, setBaseServiceHours] = useState<number>(100_000);
  const [customHoursInput, setCustomHoursInput] = useState("");
  const [customHoursError, setCustomHoursError] = useState<string | null>(null);
  const [manualColumns, setManualColumns] = useState<ManualColumn[]>([]);
  const [calcTemperatureInput, setCalcTemperatureInput] = useState("470");
  const [calcServiceHoursInput, setCalcServiceHoursInput] = useState("10000");

  const materialsQuery = useQuery({
    queryKey: ["materials"],
    queryFn: listMaterials,
  });

  const detailQuery = useQuery({
    queryKey: ["material", selectedId],
    queryFn: () => getMaterial(selectedId!),
    enabled: selectedId !== null,
  });

  const materialList = materialsQuery.data ?? [];
  useEffect(() => {
    materialListRef.current = materialList.map((m) => ({
      id: m.id,
      name: m.name,
    }));
  }, [materialList]);

  useEffect(() => {
    function handleTourStart() {
      const currentSelected = selectedIdRef.current;
      if (currentSelected == null) {
        pendingAutoSelectRef.current = true;
        shouldResetAfterTourRef.current = true;
        const list = materialListRef.current;
        if (list.length > 0) {
          setSelectedId(list[0].id);
          pendingAutoSelectRef.current = false;
        }
      } else {
        pendingAutoSelectRef.current = false;
        shouldResetAfterTourRef.current = false;
      }
    }

    function handleTourEnd() {
      if (shouldResetAfterTourRef.current) {
        // Сценарий: при старте тура не было выбранного материала → после окончания сбрасываем выбор.
        setSelectedId(null);
      }
      pendingAutoSelectRef.current = false;
      shouldResetAfterTourRef.current = false;
    }

    window.addEventListener("larsonMillerTourStart", handleTourStart);
    window.addEventListener("larsonMillerTourEnd", handleTourEnd);
    return () => {
      window.removeEventListener("larsonMillerTourStart", handleTourStart);
      window.removeEventListener("larsonMillerTourEnd", handleTourEnd);
    };
  }, []);

  useEffect(() => {
    if (!pendingAutoSelectRef.current) return;
    if (selectedIdRef.current != null) return;
    const list = materialListRef.current;
    if (list.length === 0) return;
    setSelectedId(list[0].id);
    pendingAutoSelectRef.current = false;
  }, [materialList]);

  const materialSelectWidth = useMemo(
    () =>
      selectWidthCh([
        MATERIAL_PLACEHOLDER,
        ...materialList.map((item) => item.name),
      ]),
    [materialList],
  );

  const hoursSelectWidth = useMemo(
    () =>
      selectWidthCh(
        [
          ...PREDEFINED_HOURS.map((hours) => formatServiceHours(hours)),
          HOURS_OTHER_LABEL,
        ],
        { minCh: HOURS_SELECT_MIN_CH, arrowPaddingCh: 6 },
      ),
    [],
  );

  const hoursSelectStyle = useMemo(
    () => selectFitStyle(hoursSelectWidth),
    [hoursSelectWidth],
  );

  const materialSelectStyle = useMemo(
    () => selectFitStyle(materialSelectWidth),
    [materialSelectWidth],
  );

  const customHoursInputWidth = useMemo(
    () =>
      selectWidthCh([
        CUSTOM_HOURS_PLACEHOLDER,
        customHoursInput.trim() || "1 000 000",
      ]),
    [customHoursInput],
  );

  const mechanicalProperties = (detailQuery.data?.mechanical_properties ??
    {}) as MechanicalProperties;
  const categories = mechanicalProperties.strength_category ?? [];
  const hasCategories = categories.length > 0;
  const activeCategoryIndex = hasCategories ? 0 : null;

  const materialMetadata = detailQuery.data?.metadata as
    | { larson_miller_constant_c?: number | string }
    | undefined;

  const metadataConstantC = useMemo(() => {
    const raw = materialMetadata?.larson_miller_constant_c;
    if (raw == null || raw === "") return null;
    return parseNumericInput(String(raw));
  }, [materialMetadata?.larson_miller_constant_c]);

  const customHoursMode = hoursChoice === "other";

  const debouncedManualColumns = useDebouncedValue(
    manualColumns,
    LARSON_MILLER_DEBOUNCE_MS,
  );
  const debouncedCalcTemperatureInput = useDebouncedValue(
    calcTemperatureInput,
    LARSON_MILLER_DEBOUNCE_MS,
  );
  const debouncedCalcServiceHoursInput = useDebouncedValue(
    calcServiceHoursInput,
    LARSON_MILLER_DEBOUNCE_MS,
  );
  const debouncedCustomHoursInput = useDebouncedValue(
    customHoursInput,
    LARSON_MILLER_DEBOUNCE_MS,
  );

  const parsedCalcTemperature = parseNumericInput(debouncedCalcTemperatureInput);
  const parsedCalcServiceHours = parseNumericInput(debouncedCalcServiceHoursInput);
  const parsedCustomBaseHoursForUi = customHoursMode
    ? parseNumericInput(customHoursInput)
    : null;
  const parsedCustomBaseHoursForQuery = customHoursMode
    ? parseNumericInput(debouncedCustomHoursInput)
    : null;
  const effectiveBaseServiceHours = customHoursMode
    ? parsedCustomBaseHoursForQuery
    : baseServiceHours;
  const displayBaseServiceHours = customHoursMode
    ? parsedCustomBaseHoursForUi
    : baseServiceHours;

  const manualTablePoints = useMemo((): LarsonMillerCustomPoint[] | null => {
    if (!customHoursMode) return null;
    const points: LarsonMillerCustomPoint[] = [];
    for (const column of debouncedManualColumns) {
      const temperature = parseNumericInput(column.temperature);
      const stress = parseNumericInput(column.stress);
      if (temperature != null && stress != null) {
        points.push({ temperature, stress });
      }
    }
    return points;
  }, [customHoursMode, debouncedManualColumns]);

  const queryEnabled =
    Boolean(workspace) &&
    selectedId !== null &&
    activeCategoryIndex !== null &&
    detailQuery.isFetched &&
    effectiveBaseServiceHours != null &&
    effectiveBaseServiceHours > 0 &&
    (!customHoursMode || manualTablePoints !== null);

  const larsonQuery = useQuery({
    queryKey: [
      "selection",
      "larson-miller",
      selectedId,
      activeCategoryIndex,
      effectiveBaseServiceHours,
      customHoursMode,
      manualTablePoints,
      metadataConstantC,
      parsedCalcTemperature,
      parsedCalcServiceHours,
    ],
    queryFn: () =>
      postLarsonMiller({
        material_id: selectedId!,
        category_index: activeCategoryIndex!,
        base_service_hours: effectiveBaseServiceHours!,
        custom_table_points: customHoursMode ? manualTablePoints : null,
        calc_temperature: parsedCalcTemperature,
        calc_service_hours: parsedCalcServiceHours,
      }),
    enabled: queryEnabled,
  });

  const larsonData = larsonQuery.data ?? null;

  const storedConstantC =
    metadataConstantC ??
    (larsonData?.stored_constant_c != null
      ? parseNumericInput(String(larsonData.stored_constant_c))
      : null) ??
    larsonData?.constant_c ??
    null;

  useEffect(() => {
    if (selectedId === null) return;
    if (!materialList.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [materialList, selectedId]);

  useEffect(() => {
    setManualColumns([]);
    setHoursChoice("100000");
    setBaseServiceHours(100_000);
    setCustomHoursInput("");
    setCustomHoursError(null);
  }, [selectedId]);

  useEffect(() => {
    if (!customHoursMode) return;
    const hours = parseNumericInput(customHoursInput);
    if (hours == null || hours <= 0) {
      setCustomHoursError(
        customHoursInput.trim()
          ? "Укажите положительное число часов"
          : null,
      );
      return;
    }
    setCustomHoursError(null);
    setManualColumns((prev) => {
      if (prev.length > 0) return prev;
      return [
        { id: nextColumnId(), temperature: "470", stress: "" },
        { id: nextColumnId(), temperature: "500", stress: "" },
        { id: nextColumnId(), temperature: "530", stress: "" },
      ];
    });
  }, [customHoursMode, customHoursInput]);

  function handleHoursChoiceChange(value: string) {
    setHoursChoice(value);
    setCustomHoursError(null);
    if (value === "other") {
      setCustomHoursInput("");
      setManualColumns([]);
      return;
    }
    const hours = Number(value);
    if (!Number.isFinite(hours)) return;
    setCustomHoursInput("");
    setManualColumns([]);
    setBaseServiceHours(hours);
  }

  function addManualColumn() {
    setManualColumns((prev) => [
      ...prev,
      { id: nextColumnId(), temperature: "", stress: "" },
    ]);
  }

  function removeManualColumn(columnId: string) {
    setManualColumns((prev) => prev.filter((column) => column.id !== columnId));
  }

  function updateManualColumn(
    columnId: string,
    field: "temperature" | "stress",
    value: string,
  ) {
    setManualColumns((prev) =>
      prev.map((column) =>
        column.id === columnId ? { ...column, [field]: value } : column,
      ),
    );
  }

  const tableColumns = useMemo(() => {
    const tabular = larsonData?.table_points ?? [];
    return [
      ...tabular.map((point, index) => ({
        key: `table-${index}`,
        kind: "table" as const,
        label: index === 0 ? "Данные материала" : "",
        temperature: point.temperature,
        stress: point.stress,
        serviceHours: point.service_hours,
        p: point.p ?? null,
        readOnly: true,
      })),
      {
        key: "calc",
        kind: "calc" as const,
        label: "Расчетные данные",
        temperature: parsedCalcTemperature,
        stress: larsonData?.calc_stress ?? null,
        serviceHours: parsedCalcServiceHours,
        p: larsonData?.calc_p ?? null,
        readOnly: false,
      },
    ];
  }, [
    larsonData?.table_points,
    larsonData?.calc_stress,
    larsonData?.calc_p,
    parsedCalcTemperature,
    parsedCalcServiceHours,
  ]);
  const materialColumnCount = larsonData?.table_points.length ?? 0;

  const titleHoursLabel =
    displayBaseServiceHours != null
      ? formatServiceHours(displayBaseServiceHours)
      : "—";
  const isInitialLoading =
    queryEnabled && larsonQuery.isLoading && larsonData == null;
  const isRefreshing =
    queryEnabled && larsonQuery.isFetching && larsonData != null;
  const showManualEditor =
    customHoursMode &&
    parsedCustomBaseHoursForUi != null &&
    parsedCustomBaseHoursForUi > 0;

  const statusMessage = !workspace
    ? "Откройте workspace с материалами"
    : !selectedId
      ? "Выберите материал"
      : !hasCategories
        ? "Нет категорий прочности"
        : customHoursMode &&
            (parsedCustomBaseHoursForUi == null ||
              parsedCustomBaseHoursForUi <= 0)
          ? "Укажите срок службы в поле ввода"
        : customHoursMode && manualColumns.length === 0
          ? "Добавьте столбцы и заполните табличные данные"
          : larsonQuery.isError
            ? larsonQuery.error.message
            : !customHoursMode &&
                larsonData &&
                !larsonData.from_database &&
                larsonData.table_points.length === 0
              ? "Нет данных в базе для выбранного срока — выберите «Другое» и укажите срок вручную"
              : storedConstantC == null
                ? "Укажите константу C в карточке материала: Добавление / редактирование → Общие данные → «Константа Ларсона–Миллера C»"
                : null;

  return (
    <TabErrorBoundary
      resetKey={`${selectedId ?? ""}:${activeCategoryIndex ?? ""}:${hoursChoice}:${effectiveBaseServiceHours ?? ""}`}
    >
      <div className="temp-selection-tab larson-miller-tab">
        <div className="selection-controls larson-miller-controls">
          <div
            className="selection-control selection-control--material"
            data-tour="lm-material"
          >
            <label htmlFor="lm-material-select">Материал:</label>
            <select
              id="lm-material-select"
              className="input larson-miller-fit-select"
              style={materialSelectStyle}
              value={selectedId ?? ""}
              onChange={(event) => {
                setSelectedId(event.target.value || null);
              }}
            >
              <option value="">{MATERIAL_PLACEHOLDER}</option>
              {materialList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {selectedId && (
            <div
              className="selection-control selection-control--service-hours"
              data-tour="lm-hours"
            >
              <label htmlFor="lm-service-hours">Базовый срок службы, ч:</label>
              <div className="larson-miller-hours-control">
                <select
                  id="lm-service-hours"
                  className="input larson-miller-fit-select larson-miller-hours-select"
                  style={hoursSelectStyle}
                  value={hoursChoice}
                  disabled={!workspace}
                  onChange={(event) => handleHoursChoiceChange(event.target.value)}
                >
                  {PREDEFINED_HOURS.map((hours) => (
                    <option key={hours} value={hours}>
                      {formatServiceHours(hours)}
                    </option>
                  ))}
                  <option value="other">{HOURS_OTHER_LABEL}</option>
                </select>
                {customHoursMode && (
                  <input
                    id="lm-custom-hours-input"
                    type="text"
                    className="input larson-miller-hours-custom-input larson-miller-fit-select"
                    style={{ width: customHoursInputWidth }}
                    value={customHoursInput}
                    placeholder={CUSTOM_HOURS_PLACEHOLDER}
                    onChange={(event) => {
                      setCustomHoursInput(event.target.value);
                      if (customHoursError) setCustomHoursError(null);
                    }}
                  />
                )}
              </div>
              {customHoursMode && (
                <p className="larson-miller-hours-hint">
                  Введите срок в часах и заполните табличные данные из вашего
                  источника. Данные не сохраняются в базу материалов.
                </p>
              )}
              {customHoursError && (
                <p className="sep-calculation-calc-error">{customHoursError}</p>
              )}
            </div>
          )}
        </div>

        <section className="selection-body larson-miller-body">
          {statusMessage && (
            <p
              className={
                larsonQuery.isError
                  ? "tab-placeholder tab-placeholder--error"
                  : "tab-placeholder"
              }
            >
              {statusMessage}
            </p>
          )}

          {isInitialLoading && (
            <p className="tab-placeholder">Загрузка…</p>
          )}

          {showManualEditor && (
            <div className="larson-miller-manual-panel">
              <div className="larson-miller-manual-toolbar">
                <span className="larson-miller-manual-title">
                  Табличные данные для срока {titleHoursLabel} ч (не сохраняются в базу)
                </span>
                <button type="button" onClick={addManualColumn}>
                  + Добавить столбец
                </button>
              </div>
              <div className="larson-miller-manual-grid">
                {manualColumns.map((column) => (
                  <div key={column.id} className="larson-miller-manual-column">
                    <label>T, °C</label>
                    <input
                      type="text"
                      className="input larson-miller-editable-cell"
                      value={column.temperature}
                      onChange={(event) =>
                        updateManualColumn(
                          column.id,
                          "temperature",
                          event.target.value,
                        )
                      }
                    />
                    <label>σдп, МПа</label>
                    <input
                      type="text"
                      className="input larson-miller-editable-cell"
                      value={column.stress}
                      onChange={(event) =>
                        updateManualColumn(column.id, "stress", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => removeManualColumn(column.id)}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {workspace && (
            <div className="larson-miller-results-layout">
              {workspace && selectedId && hasCategories && !isInitialLoading && (
                <div
                  className={`larson-miller-table-panel${isRefreshing ? " larson-miller-table-panel--refreshing" : ""}`}
                  data-tour="lm-table"
                >
                  <h2 className="larson-miller-table-title larson-miller-panel-title">
                    Определение значений длительной прочности при {titleHoursLabel} часов
                    {isRefreshing && (
                      <span className="larson-miller-refresh-hint"> (обновление…)</span>
                    )}
                  </h2>
                  <div className="larson-miller-table-scroll">
                    <table className="larson-miller-table data-table">
                      <thead>
                        <tr>
                          <th scope="col" />
                          {materialColumnCount > 0 && (
                            <th
                              scope="colgroup"
                              colSpan={materialColumnCount}
                              className="larson-miller-table-group-head"
                            >
                              Данные материала
                            </th>
                          )}
                          <th
                            scope="col"
                            className="larson-miller-table-col--calc larson-miller-table-col--calc-head"
                          >
                            Расчетные данные
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th scope="row">Предел длительной прочности, σдп, МПа</th>
                          {tableColumns.map((column) => (
                            <td
                              key={`${column.key}-stress`}
                              className={
                                column.kind === "calc"
                                  ? "larson-miller-table-col--calc"
                                  : undefined
                              }
                            >
                              {column.kind === "calc" ? (
                                <>
                                  <FormulaHint
                                    value={formatNumber(column.stress)}
                                    formula={STRESS_FORMULA_HINT}
                                  />
                                  {larsonData?.is_extrapolated && (
                                    <span className="larson-miller-extrapolated">
                                      *
                                    </span>
                                  )}
                                </>
                              ) : (
                                formatNumber(column.stress)
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th scope="row">Срок службы τ, ч</th>
                          {tableColumns.map((column) => (
                            <td
                              key={`${column.key}-hours`}
                              className={
                                column.kind === "calc"
                                  ? "larson-miller-table-col--calc"
                                  : undefined
                              }
                            >
                              {column.kind === "calc" ? (
                                <input
                                  type="text"
                                  className="input larson-miller-editable-cell"
                                  value={calcServiceHoursInput}
                                  onChange={(event) =>
                                    setCalcServiceHoursInput(event.target.value)
                                  }
                                />
                              ) : (
                                formatNumber(column.serviceHours, 0)
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th scope="row">Постоянная C</th>
                          {tableColumns.map((column) => (
                            <td key={`${column.key}-c`}>
                              {formatNumber(storedConstantC)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th scope="row">Температура T, °C</th>
                          {tableColumns.map((column) => (
                            <td
                              key={`${column.key}-temp`}
                              className={
                                column.kind === "calc"
                                  ? "larson-miller-table-col--calc"
                                  : undefined
                              }
                            >
                              {column.kind === "calc" ? (
                                <input
                                  type="text"
                                  className="input larson-miller-editable-cell"
                                  value={calcTemperatureInput}
                                  onChange={(event) =>
                                    setCalcTemperatureInput(event.target.value)
                                  }
                                />
                              ) : (
                                formatNumber(column.temperature, 0)
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th scope="row">Параметр P</th>
                          {tableColumns.map((column) => (
                            <td
                              key={`${column.key}-p`}
                              className={
                                column.kind === "calc"
                                  ? "larson-miller-table-col--calc"
                                  : undefined
                              }
                            >
                              {column.kind === "calc" ? (
                                <FormulaHint
                                  value={formatNumber(column.p)}
                                  formula={P_FORMULA_HINT}
                                />
                              ) : (
                                formatNumber(column.p)
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {larsonData?.is_extrapolated && (
                    <p className="larson-miller-footnote">
                      * Значение получено экстраполяцией по зависимости Ларсона–Миллера
                    </p>
                  )}
                </div>
              )}

              {workspace && selectedId && hasCategories && !isInitialLoading && (
                <div className="larson-miller-chart-panel" data-tour="lm-chart">
                  <h2 className="larson-miller-chart-title larson-miller-panel-title">
                    Предел длительной прочности через параметрическую зависимость
                    Ларсона–Миллера
                  </h2>
                  <LarsonMillerChart data={larsonData} />
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </TabErrorBoundary>
  );
}
