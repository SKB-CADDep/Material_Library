from src.services.hardness_table import HardnessTable
import pytest


ht = HardnessTable()
HT = HardnessTable

def test_json_load():
    assert ht is not None


def test_column_names():
    assert ht.columns_name() == ["d10", "HB", "HRA", "HRC", "HRB", "HV", "HSD"]


def test_system_unit():
    assert HT.SYSTEM_UNIT == "HB"


def test_supported_unit():
    assert ht.is_supported_unit("HB") is True


def test_not_supported_unit():
    assert ht.is_supported_unit("Brinell") == False


def test_identify_int():
    assert ht.convert(200, "HB", "HB") == 200.0


def test_identify_float():
    assert ht.convert(653.0, "HB", "HB") == 653.0


def test_HB_to_HRC():
    assert ht.convert(653, "HB", "HRC") == 62.9


def test_HB_to_HV():
    assert ht.convert(653, "HB", "HV")  == 866


def test_HRC_to_HB():
    assert ht.convert(62.9, "HRC", "HB") == 653.0


def test_interpolate_HB_to_HRC():
    pass


def test_lower_than_HB():
    assert ht.convert(10, "HB", "HRC") is None


def test_higher_than_HB():
    assert ht.convert(1000, "HB", "HRC") is None


@pytest.mark.xfail(reason="convert не обрабатывает value=None")
def test_value_is_None():
    assert ht.convert(None, "HB", "HRC") is None


def test_unfamiliar_from():
    assert ht.convert(200, "XXX", "HRC") is None


def test_unfamiliar_to():
    assert ht.convert(200, "HB", "YYY") is None


def test_null_in_table():
    assert ht.convert(653, "HB", "HRB") is None