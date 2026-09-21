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

function unitKnownInConfig(unit: string, config: UnitConfig): boolean {
  if (unit === config.system_unit) {
    return true;
  }
  const factors = config.factors ?? {};
  return factors[unit] !== undefined;
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

  // Не конвертируем, если единица отсутствует в factors: иначе
  // toSystem/fromSystem молча трактуют её как system_unit и дают ложный масштаб
  // (например МПа + factors{"-":100} → 199500/100 = 1995).
  if (!unitKnownInConfig(fromUnit, config) || !unitKnownInConfig(toUnit, config)) {
    return value;
  }

  const systemValue = toSystem(value, fromUnit, config);
  return fromSystem(systemValue, toUnit, config);
}
