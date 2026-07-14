from src.core.math.interpolation import MathUtils
import pytest


q = MathUtils()


@pytest.mark.parametrize("input_value, expected", [
    ("27.89", 27.89),
    ("27,89", 27.89),
    (None, "q"),
    ("2b nm.fd9", "q"),
    ("    27.89 ", 27.89),
    (27.89, 27.89)
])
def test_safe_float(input_value, expected):
    assert q.safe_float(input_value, "q") == expected
    assert isinstance(q.safe_float(input_value, "q"), (float, str))


@pytest.mark.parametrize("input_value, target_x, expected", [
    ([(1, -2), (3, -4)], 2, -3),
    ([(1, -2), (3, -4)], 8, None),
    ([(1, -2), (3, -4)], 0, None),
    pytest.param([(1, -1), (3, -4), (4, -8)], 2, None, marks=pytest.mark.xfail(reason="Функция не распознает неправильные входные данные")),
    ([], 2, None),
    ([(1, 2)], 1, 2),
    ([(1, 2), (3, 4)], 1, 2)
])
def test_interpolation(input_value, target_x, expected):
    assert q.linear_interpolate(input_value, target_x) == expected