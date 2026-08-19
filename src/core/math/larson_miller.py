"""Расчёты параметра Ларсона–Миллера."""

from __future__ import annotations

import math
from typing import Iterable


def larson_miller_parameter(
    temperature_c: float,
    service_hours: float,
    constant_c: float,
) -> float:
    """P = (T + 273.15) · (lg τ + C) / 1000, τ в часах, T в °C."""
    if service_hours <= 0:
        raise ValueError("Срок службы должен быть положительным")
    return (temperature_c + 273.15) * (math.log10(service_hours) + constant_c) / 1000


def interpolate_stress_at_p(
    p_target: float,
    points: Iterable[tuple[float, float]],
) -> tuple[float | None, bool]:
    """
    Линейная интер-/экстраполяция σдп по параметру P.
    points: [(P, σдп), ...]
    Возвращает (σдп, is_extrapolated).
    """
    sorted_points = sorted(points, key=lambda item: item[0])
    if not sorted_points:
        return None, False
    if len(sorted_points) == 1:
        return sorted_points[0][1], True

    for p_value, stress in sorted_points:
        if abs(p_value - p_target) < 1e-9:
            return stress, False

    if p_target < sorted_points[0][0]:
        p1, s1 = sorted_points[0]
        p2, s2 = sorted_points[1]
        if p2 - p1 == 0:
            return s1, True
        stress = s1 + (p_target - p1) * (s2 - s1) / (p2 - p1)
        return stress, True

    if p_target > sorted_points[-1][0]:
        p1, s1 = sorted_points[-2]
        p2, s2 = sorted_points[-1]
        if p2 - p1 == 0:
            return s2, True
        stress = s1 + (p_target - p1) * (s2 - s1) / (p2 - p1)
        return stress, True

    for index in range(len(sorted_points) - 1):
        p1, s1 = sorted_points[index]
        p2, s2 = sorted_points[index + 1]
        if p1 < p_target < p2:
            if p2 - p1 == 0:
                return s1, False
            stress = s1 + (p_target - p1) * (s2 - s1) / (p2 - p1)
            return stress, False

    return None, False


SERVICE_HOURS_TO_PROPERTY: dict[int, str] = {
    10_000: "tensile_strength_limit_10_thousands_hours",
    100_000: "tensile_strength_limit_100_thousands_hours",
    200_000: "tensile_strength_limit_200_thousands_hours",
    250_000: "tensile_strength_limit_250_thousands_hours",
}

PREDEFINED_SERVICE_HOURS = tuple(sorted(SERVICE_HOURS_TO_PROPERTY))


def property_key_for_service_hours(service_hours: float) -> str | None:
    hours = int(round(service_hours))
    return SERVICE_HOURS_TO_PROPERTY.get(hours)
