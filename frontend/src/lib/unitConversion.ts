import type { UnitResponse } from "../types/api";
import {
  convertHardness,
  usesHardnessTableConversion,
} from "./hardnessConversion";

export type UnitConfig = Pick<UnitResponse, "system_unit" | "factors">;

function numericFactor(factor: number | string | undefined): number | null {
  return typeof factor === "number" && Number.isFinite(factor) ? factor : null;
}

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

  const linear = numericFactor(factor);
  if (linear === null) {
    return value;
  }

  return value * linear;
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

  const linear = numericFactor(factor);
  if (linear === null) {
    return value;
  }

  return value / linear;
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

  if (usesHardnessTableConversion(config.factors)) {
    const converted = convertHardness(value, fromUnit, toUnit);
    if (converted === null || !Number.isFinite(converted)) {
      throw new Error(
        `Hardness conversion unavailable: ${fromUnit} → ${toUnit}`,
      );
    }
    return converted;
  }

  const systemValue = toSystem(value, fromUnit, config);
  return fromSystem(systemValue, toUnit, config);
}
