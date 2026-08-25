from src.services.unit_manager import UnitManager

TYPE_NAME = "Коэффициент линейного расширения"


def test_system_unit_is_scaled_per_celsius() -> None:
    assert UnitManager.get_system_unit(TYPE_NAME) == "10^-6/C"


def test_scaled_value_converts_to_true_per_c() -> None:
    si = UnitManager.to_system(10.5, "10^-6/C", TYPE_NAME)
    assert si == 10.5
    assert UnitManager.from_system(si, "1/С", TYPE_NAME) == 1.05e-5


def test_true_per_c_converts_back_to_scaled() -> None:
    system = UnitManager.to_system(1.05e-5, "1/С", TYPE_NAME)
    assert system == 10.5
    assert UnitManager.from_system(system, "10^-6/C", TYPE_NAME) == 10.5
