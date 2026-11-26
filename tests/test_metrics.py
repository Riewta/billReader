from datetime import datetime
from decimal import Decimal

from slipsense_ml.eval.metrics import Report, field_correct, ocr_recall, similarity
from slipsense_ml.schema import SlipFields


def test_similarity_basic():
    assert similarity("abc", "abc") == 1
    assert similarity("abcd", "abcx") == 0.75


def test_name_fuzzy_ignores_prefix_and_one_typo():
    assert field_correct("receiver_name", "สมชาย ใจดี", "นาย สมชาย ใจดี")
    # สระหาย 1 ตัวจาก 9 -> similarity 0.89 >= 0.85 ถือว่าถูก
    assert field_correct("receiver_name", "สมชาย ใจด", "นาย สมชาย ใจดี")
    # คนละคน -> ผิด
    assert not field_correct("receiver_name", "สมศรี มีสุข", "นาย สมชาย ใจดี")


def test_ref_ignores_spaces_and_case():
    assert field_correct("ref", "0153 0712 abc", "01530712ABC")


def test_datetime_ignores_seconds():
    assert field_correct("paid_at", datetime(2025, 1, 1, 9, 0, 59), datetime(2025, 1, 1, 9, 0))


def test_ocr_recall_finds_amount_with_comma():
    gold = SlipFields(amount=Decimal("1250.00"), ref="ABC123")
    r = ocr_recall("ยอด 1,250.00 บาท\nRef AB C123", gold)
    assert r == {"amount": True, "ref": True}


def test_report_skips_null_gold_fields():
    rep = Report()
    gold = SlipFields(bank="kbank", amount=Decimal("1.00"))
    rep.add("x", "kbank", SlipFields(bank="kbank", amount=Decimal("2.00")), gold, "")
    assert rep.e2e[("ALL", "bank")].correct == 1
    assert rep.e2e[("ALL", "amount")].correct == 0
    assert ("ALL", "ref") not in rep.e2e
