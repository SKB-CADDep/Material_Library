/** Работа со схемой properties[{ property_name, ... }] (как в Material на бэкенде). */

export type NamedProperty = {
  property_name?: string;
  temperature_value_pairs?: Array<[number, number]>;
  value_unit?: string;
  comment?: string;
  property_subsource?: string | number | readonly string[];
  source_ref_id?: string | null;
  min_value?: number;
  is_acceptance?: boolean;
  [key: string]: unknown;
};

export type PropertiesContainer = {
  properties?: NamedProperty[];
  [key: string]: unknown;
};

export function getPropertiesList(
  container: PropertiesContainer | Record<string, unknown> | undefined | null,
): NamedProperty[] {
  if (!container || typeof container !== "object") {
    return [];
  }
  const props = (container as PropertiesContainer).properties;
  return Array.isArray(props) ? props : [];
}

export function findNamedProp(
  container: PropertiesContainer | Record<string, unknown> | undefined | null,
  propName: string,
): NamedProperty | undefined {
  if (!propName) return undefined;
  return getPropertiesList(container).find(
    (item) => item && typeof item === "object" && item.property_name === propName,
  );
}

export function upsertNamedProp(
  props: NamedProperty[] | undefined,
  propName: string,
  patch: Partial<NamedProperty>,
): NamedProperty[] {
  const list = Array.isArray(props) ? [...props] : [];
  const index = list.findIndex(
    (item) => item && typeof item === "object" && item.property_name === propName,
  );
  const prev = index >= 0 ? list[index] : {};
  const next: NamedProperty = {
    ...prev,
    ...patch,
    property_name: propName,
  };
  if (index >= 0) {
    list[index] = next;
  } else {
    list.push(next);
  }
  return list;
}

/** Патч именованного свойства внутри physical_properties / strength_category. */
export function patchNamedPropertyInContainer<T extends PropertiesContainer>(
  container: T | undefined,
  propName: string,
  patch: Partial<NamedProperty>,
): T {
  const base = (container ?? {}) as T;
  return {
    ...base,
    properties: upsertNamedProp(getPropertiesList(base), propName, patch),
  };
}

export function patchPhysicalProperty(
  material: Record<string, unknown>,
  propName: string,
  patch: Partial<NamedProperty>,
): Record<string, unknown> {
  const physical = material.physical_properties as PropertiesContainer | undefined;
  return {
    ...material,
    physical_properties: patchNamedPropertyInContainer(physical, propName, patch),
  };
}

export function resolvePropertyFromContainers(
  propName: string,
  physicalProperties: Record<string, unknown> | undefined,
  category: Record<string, unknown> | undefined,
): NamedProperty | undefined {
  return (
    findNamedProp(physicalProperties, propName) ??
    findNamedProp(category, propName)
  );
}
