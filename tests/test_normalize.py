from decimal import Decimal

import pytest

from slipsense_ml.parsing.normalize import lookup_month, normalize_text, parse_amount, to_gregorian


def test_thai_digits_become_arabic():
    assert normalize_text("๑,๒๕๐.๐๐ บาท") == "1,250.00 บาท"


def test_sara_am_variants_unified():
    assert normalize_text("จํานวนเงิน") == "จำนวนเงิน"


def test_spaced_month_abbreviation_collapsed():
    assert normalize_text("3 พ. ย. 68") == "3 พ.ย. 68"


@pytest.mark.parametrize("token,month", [("พ.ย.", 11), ("พย", 11), ("ม.ค.", 1), ("ธันวาคม", 12), ("Nov", 11)])
def test_lookup_month(token, month):
    assert lookup_month(token) == month


@pytest.mark.parametrize("raw,expected", [(68, 2025), (2568, 2025), (25, 2025), (2025, 2025)])
def test_to_gregorian(raw, expected):
    assert to_gregorian(raw) == expected


def test_parse_amount():
    assert parse_amount("12,345.50") == Decimal("12345.50")
    assert parse_amount("abc") is None
