import { useEffect, useMemo, useState } from "react";
import { ApplicationAreaFilter } from "../components/ApplicationAreaFilter";
import { useWorkspace } from "../context/WorkSpaceContext";
import { useQuery } from "@tanstack/react-query";
import { postTemperatureSelection } from "../api/selection";
import { SelectionTable } from "../components/SelectionTable";
import { useColumnUnitConfigs } from "../hooks/useColumnUnitConfigs";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  TABLE_SORT_HINT,
  TableSortHint,
} from "../lib/tableSortHeader";
import { mergeColumnUnits } from "../lib/columnUnits";
import {
  calculationColumnUnitLabel,
  TEMPERATURE_UNIT_TYPE,
} from "../lib/calculationColumnHeader";
import { syncHardnessColumnUnits } from "../lib/formatSelectionCellValue";
import {
  ALL_NTD_FILTER,
  collectNtdFilterOptions,
  filterRowsByNtd,
} from "../lib/ntdFilter";
import {
  type SelectionSortColumn,
  type SelectionSortState,
  sortSelectionRows,
  toggleSortDirection,
} from "../lib/sortSelectionRows";

const TEMPERATURE_DEBOUNCE_MS = 300;


const PROP_TYPE_OPTIONS = [
  { value: "physical", label: "Физические свойства" },
  { value: "mechanical", label: "Механические свойства" },
  { value: "hardness", label: "Твердость" },
] as const;

type PropType = (typeof PROP_TYPE_OPTIONS)[number]["value"];


export function TempSelectionTab() {
  const { workspace } = useWorkspace();
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [propType, setPropType] = useState<PropType>("physical");
  const [temperatureInput, setTemperatureInput] = useState("20");
  const debouncedTemperature = useDebouncedValue(
    temperatureInput,
    TEMPERATURE_DEBOUNCE_MS,
  );
  const [sortState, setSortState] = useState<SelectionSortState>(null);
  const [selectedNtd, setSelectedNtd] = useState(ALL_NTD_FILTER);
  const [columnUnits, setColumnUnits] = useState<Record<string, string>>({});

  const areaOptions = workspace?.application_areas ?? [];

  const result = useQuery({
    queryKey: [
      "selection",
      "temperature",
      propType,
      selectedAreas,
      debouncedTemperature,
    ],
    queryFn: () =>
      postTemperatureSelection({
        prop_type: propType,
        temperature: Number(debouncedTemperature) || 0,
        ...(selectedAreas.length > 0 ? { areas: selectedAreas } : {}),
      }),
    enabled: Boolean(workspace),
  });

  const columns = result.data?.columns ?? [];
  const rows = result.data?.rows ?? [];
  const ntdOptions = useMemo(() => collectNtdFilterOptions(rows), [rows]);
  const { configs: unitConfigs } = useColumnUnitConfigs(columns, {
    includeTemperature: true,
  });
  const temperatureUnitLabel = useMemo(() => {
    const config = unitConfigs[TEMPERATURE_UNIT_TYPE];
    return (
      calculationColumnUnitLabel(config?.system_unit ?? "C", config) || "°C"
    );
  }, [unitConfigs]);

  useEffect(() => {
    setSortState(null);
    setSelectedNtd(ALL_NTD_FILTER);
  }, [propType, debouncedTemperature, selectedAreas]);

  useEffect(() => {
    if (!selectedNtd) {
      return;
    }
    if (!ntdOptions.includes(selectedNtd)) {
      setSelectedNtd(ALL_NTD_FILTER);
    }
  }, [ntdOptions, selectedNtd]);

  useEffect(() => {
    setColumnUnits({});
  }, [propType]);

  useEffect(() => {
    if (columns.length === 0) {
      return;
    }
    setColumnUnits((prev) => mergeColumnUnits(columns, prev, unitConfigs));
  }, [columns, unitConfigs]);

  const filteredRows = useMemo(
    () => filterRowsByNtd(rows, selectedNtd),
    [rows, selectedNtd],
  );

  const displayRows = useMemo(() => {
    if (!sortState || filteredRows.length === 0) {
      return filteredRows;
    }
    return sortSelectionRows(filteredRows, sortState.column, sortState.direction);
  }, [filteredRows, sortState]);

  const handleSortColumn = (column: SelectionSortColumn) => {
    setSortState((prev) => {
      if (prev?.column === column) {
        return { column, direction: toggleSortDirection(prev.direction) };
      }
      return { column, direction: "asc" };
    });
  };

  const handleColumnUnitChange = (columnKey: string, unit: string) => {
    setColumnUnits((prev) =>
      propType === "hardness"
        ? syncHardnessColumnUnits(columnKey, unit, prev)
        : { ...prev, [columnKey]: unit },
    );
  };

  return (
    <div className="temp-selection-tab">
      <div className="selection-controls">
        <div
          className="selection-control selection-control--prop-type"
          data-tour="temp-prop-type"
        >
          <label htmlFor="prop-type-select">Тип свойств:</label>
          <select
            id="prop-type-select"
            className="input"
            value={propType}
            onChange={(event) =>
              setPropType(event.target.value as PropType)
            }
          >
            {PROP_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div
          className="selection-control selection-control--area"
          data-tour="temp-area"
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
          className="selection-control selection-control--temperature"
          data-tour="temp-temperature"
        >
          <label htmlFor="temperature-input">
            Температура, {temperatureUnitLabel}:
          </label>
          <input
            id="temperature-input"
            type="number"
            className="input"
            value={temperatureInput}
            onChange={(event) => setTemperatureInput(event.target.value)}
          />
        </div>

        <div className="selection-control selection-control--ntd" data-tour="temp-ntd">
          <label htmlFor="ntd-filter-select">НТД:</label>
          <select
            id="ntd-filter-select"
            className="input"
            value={selectedNtd}
            onChange={(event) => setSelectedNtd(event.target.value)}
            disabled={ntdOptions.length === 0}
            title={
              ntdOptions.length === 0
                ? "Нет данных для фильтрации по НТД"
                : undefined
            }
          >
            <option value={ALL_NTD_FILTER}>Все</option>
            {ntdOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

<p
  className="selection-unit-hint"
  title={TABLE_SORT_HINT}
  data-tour="temp-unit-hint"
>
  <TableSortHint />
</p>
        </p>
      </div>

      <section className="selection-body">
        {!workspace && (
          <p className="tab-placeholder">Откройте workspace с материалами</p>
        )}

        {workspace && result.isLoading && (
          <p className="tab-placeholder">Загрузка…</p>
        )}

        {workspace && result.isError && (
          <p className="tab-placeholder tab-placeholder--error">
            {result.error.message}
          </p>
        )}

        {workspace && result.isSuccess && rows.length === 0 && (
          <p className="tab-placeholder">Нет данных для отображения</p>
        )}

        {workspace &&
          result.isSuccess &&
          rows.length > 0 &&
          filteredRows.length === 0 && (
            <p className="tab-placeholder">
              Нет строк для выбранного НТД
            </p>
          )}

        {workspace && result.isSuccess && filteredRows.length > 0 && (
          <div className="selection-table-panel" data-tour="temp-table">
              <SelectionTable
                scrollColumns={columns}
                rows={displayRows}
                unitConfigs={unitConfigs}
                columnUnits={columnUnits}
                onColumnUnitChange={handleColumnUnitChange}
                sortState={sortState}
                onSortColumn={handleSortColumn}
              />
          </div>
        )}
      </section>
    </div>
  );
}
