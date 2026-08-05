import { useState } from "react";
import { ApplicationAreaFilter } from "../components/ApplicationAreaFilter";
import { useWorkspace } from "../context/WorkSpaceContext";
import { useQuery } from "@tanstack/react-query";
import { postTemperatureSelection } from "../api/selection";
import { SelectionTable } from "../components/SelectionTable";


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
  const [temperature, setTemperature] = useState("20");

  const areaOptions = workspace?.application_areas ?? [];

  const result = useQuery({
    queryKey: ["selection", "temperature", propType, selectedAreas, temperature],
    queryFn: () =>
      postTemperatureSelection({
        prop_type: propType,
        temperature: Number(temperature) || 0,
        ...(selectedAreas.length > 0 ? { areas: selectedAreas } : {}),
      }),
    enabled: Boolean(workspace),
  });

  const columns = result.data?.columns ?? [];
  const rows = result.data?.rows ?? [];

  return (
    <div className="temp-selection-tab">
      <div className="selection-controls">
        <div className="selection-control selection-control--prop-type">
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

        <div className="selection-control selection-control--area">
          <label htmlFor="area-filter-select">Область применения:</label>
          <ApplicationAreaFilter
            id="area-filter-select"
            options={areaOptions}
            selected={selectedAreas}
            onChange={setSelectedAreas}
          />
        </div>

        <div className="selection-control selection-control--temperature">
          <label htmlFor="temperature-input">Температура, °C:</label>
          <input
            id="temperature-input"
            type="number"
            className="input"
            value={temperature}
            onChange={(event) => setTemperature(event.target.value)}
          />
        </div>
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

        {workspace && result.isSuccess && rows.length > 0 && (
          <div className="selection-table-panel">
              <SelectionTable scrollColumns={columns} rows={rows}/>
          </div>
        )}
      </section>
    </div>
  );
}
