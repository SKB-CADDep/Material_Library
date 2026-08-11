import type { UnitResponse } from "../types/api";

export type UnitConfig = Pick<UnitResponse, "system_unit" | "factors">;

export function toSystem(
  value: number,
  fromUnit: string,
  config: UnitConfig,
): number {
  if (fromUnit === config.system_unit) {
    return value;
  }

  const factors = config.factors ?? {};
  const factor = factors[fromUnit];
  if (factor === undefined) {
    return value;
  }

  if (factor === "offset_k") {
    return value - 273.15;
  }
  if (factor === "offset_f") {
    return (value - 32) * (5 / 9);
  }

  return value * factor;
}

export function fromSystem(
  value: number,
  toUnit: string,
  config: UnitConfig,
): number {
  if (toUnit === config.system_unit) {
    return value;
  }

  const factors = config.factors ?? {};
  const factor = factors[toUnit];
  if (factor === undefined) {
    return value;
  }

  if (factor === "offset_k") {
    return value + 273.15;
  }
  if (factor === "offset_f") {
    return (value * 9) / 5 + 32;
  }

  return value / factor;
}

export function convertBetweenUnits(
  value: number,
  fromUnit: string,
  toUnit: string,
  config: UnitConfig,
): number {
  if (fromUnit === toUnit) {
    return value;
  }

  const systemValue = toSystem(value, fromUnit, config);
  return fromSystem(systemValue, toUnit, config);
}
