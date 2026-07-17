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

  const options = unitsQuery.data?.units ?? [];
  const selected =
    value && options.includes(value)
      ? value
      : (unitsQuery.data?.system_unit ?? "");

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

  return (
    <select
      id={id}
      className="input"
      value={selected}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  );
}