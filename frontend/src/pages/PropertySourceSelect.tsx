import type { SourceItem } from "../types/api";

export type PropertySourceFields = {
  property_subsource?: string | number | readonly string[] | null;
  source_ref_id?: string | null;
};

/** Имя источника свойства: сначала по source_ref_id, иначе legacy property_subsource (как в Tkinter). */
export function resolvePropertySourceName(
  prop: PropertySourceFields | undefined,
  sources: SourceItem[],
): string {
  const refId = String(prop?.source_ref_id ?? "").trim();
  if (refId) {
    return sources.find((src) => src.id_source === refId)?.name_source ?? refId;
  }
  return String(prop?.property_subsource ?? "").trim();
}

export function isOrphanSource(current: string, sourceNames: string[]): boolean {
  return current !== "" && !sourceNames.includes(current);
}

type PropertySourceSelectProps = {
  id: string;
  value: string;
  showOrphan: boolean;
  sources: SourceItem[];
  onChange: (name: string, sourceRefId: string) => void;
};

export function PropertySourceSelect({
  id,
  value,
  showOrphan,
  sources,
  onChange,
}: PropertySourceSelectProps) {
  return (
    <select
      id={id}
      className="input"
      value={value}
      onChange={(e) => {
        const name = e.target.value;
        const matched = sources.find((src) => src.name_source === name);
        onChange(name, matched?.id_source ?? "");
      }}
    >
      <option value="">— не выбран —</option>
      {showOrphan && (
        <option key={`orphan-${value}`} value={value}>
          {value}
        </option>
      )}
      {sources.map((src) => (
        <option key={src.id_source ?? src.name_source} value={src.name_source}>
          {src.name_source}
        </option>
      ))}
    </select>
  );
}
