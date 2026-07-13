from src.core.math.interpolation import MathUtils


q = MathUtils()

def test_float_normal_value():
    assert q.safe_float("27.89", "q") == 27.89


def test_float_comma_instead_of_dot():
    assert q.safe_float("27,89", "q") == 27.89


def test_float_invalid_value():
    assert q.safe_float("2b nm.fd9", "q") == "q"


def test_float_value_is_None():
    assert q.safe_float(None, "q") == "q"


def test_float_spaces_at_the_edges():
    assert q.safe_float("    27.89 ", "q") == 27.89


def test_float_value_is_int():
    assert q.safe_float(27.89, "q") == 27.89


def test_interpolation_normal_values():
    assert q.linear_interpolate([(1, -2), (3, -4)], 2) == -3


def test_interpolation_extrapolation_higher():
    assert q.linear_interpolate([(1, -2), (3, -4)], 8) is None


def test_interpolation_extrapolation_lower():
    assert q.linear_interpolate([(1, -2), (3, -4)], 0) is None


# def test_interpolation_invalid_values():
#     assert q.linear_interpolate([(1, -1), (3, -4), (4, -8)], 2) is None