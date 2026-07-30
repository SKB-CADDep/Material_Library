import { useQuery } from "@tanstack/react-query";
import { getUnits } from "../api/units";

type UnitSelectProps = {
  id: string;
  unitType: string;
  value: string;
  onChange: (nextUnit: string) => void;
};

export function UnitSelect({ id, unitType, value, onChange }: UnitSelectProps) {
  const unitsQuery = useQuery({
    queryKey: ["units", unitType],
    queryFn: () => getUnits(unitType),
  });

  if (unitsQuery.isLoading) {
    return <select id={id} className="input" disabled value="" />;
  }

  if (unitsQuery.isError) {
    return (
      <select id={id} className="input" disabled value="">
        <option value="">Ошибка загрузки единиц</option>
      </select>
    );
  }

  const units = unitsQuery.data?.units ?? [];
  const labels = unitsQuery.data?.display_labels ?? {};
  const selected =
    value && units.includes(value)
      ? value
      : (unitsQuery.data?.system_unit ?? "");

  return (
    <select
      id={id}
      className="input"
      value={selected}
      onChange={(event) => onChange(event.target.value)}
    >
      {units.map((unit) => (
        <option key={unit} value={unit}>
          {labels[unit] ?? unit}
        </option>
      ))}
    </select>
  );
}
