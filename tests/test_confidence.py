"""ความมั่นใจราย field: กติกาคือ "ไม่มั่นใจแล้วผิด" ยอมได้ แต่ "มั่นใจแล้วผิด" ห้าม

ข้อความทั้งหมดเป็นของปลอม
"""

from datetime import datetime

import pytest

from slipsense_ml.parsing.parser import _datetime, extract_datetime, parse_slip_detailed
from test_qr_and_layouts import make_payload

KPLUS = """K+
โอนเงินสำเร็จ
21 ม.ค. 69 09:15 น.
นาย สมมติ ทดสอบ
ธ.กสิกรไทย
xxx-x-x1234-x
ร้านทดสอบ
ธ.กสิกรไทย
xxx-x-x5678-x
เลขที่รายการ:
015999123456BPP00001
จำนวน:
129.50 บาท
ค่าธรรมเนียม:
0.00 บาท
"""


def test_clean_kplus_with_qr_is_confident_everywhere():
    p = parse_slip_detailed(KPLUS, make_payload("004", "015999123456BPP00001"))
    assert p.fields.receiver_name == "ร้านทดสอบ"
    assert all(p.confident.values()), p.confident
    assert p.source["ref"] == "qr" and p.source["bank"] == "qr"


def test_without_qr_bank_and_ref_need_review():
    # ธนาคารจาก keyword และ ref จาก OCR ผิดแบบเนียนได้ -> ต้องให้ผู้ใช้ดู
    p = parse_slip_detailed(KPLUS)
    assert p.fields.ref == "015999123456BPP00001"
    assert not p.confident["ref"] and not p.confident["bank"]
    assert p.source["ref"] == "ocr"


def test_amount_from_fallback_is_not_confident():
    p = parse_slip_detailed("โอนสำเร็จ\nยอดคงเหลือ 5,000.00 บาท\n300.00 บาท")
    assert p.fields.amount is not None
    assert not p.confident["amount"]


def test_numeric_date_is_ambiguous():
    # 05/06/68 อ่านเป็น 5 มิ.ย. หรือ 6 พ.ค. ก็ได้
    dt, ok = _datetime("05/06/68 10:00")
    assert dt == datetime(2025, 6, 5, 10, 0) and not ok


def test_future_date_is_not_confident():
    # OCR อ่านปี 69 เป็น 89 -> ปี 2032 ในอนาคต
    _, ok = _datetime("21 ม.ค. 75 09:15", now=datetime(2026, 1, 22))
    assert not ok
    _, ok = _datetime("21 ม.ค. 69 09:15", now=datetime(2026, 1, 22))
    assert ok


def test_time_far_from_date_is_not_confident():
    _, ok = _datetime("21 ม.ค. 69\nบรรทัด\nอีกบรรทัด\n09:15", now=datetime(2026, 2, 1))
    assert not ok


def test_receiver_without_closing_account_is_not_confident():
    text = "นาย สมมติ ทดสอบ\nxxx-x-x1234-x\nร้านทดสอบ\nจำนวน 50.00 บาท"
    p = parse_slip_detailed(text)
    assert p.fields.receiver_name == "ร้านทดสอบ"
    assert not p.confident["receiver_name"]


def test_receiver_with_junk_trimmed_is_not_confident():
    text = "นาย สมมติ ทดสอบ\nxxx-x-x1234-x\n0  ร้านทดสอบ  =32\nxxx-x-x5678-x"
    p = parse_slip_detailed(text)
    assert p.fields.receiver_name == "ร้านทดสอบ"
    assert not p.confident["receiver_name"]


@pytest.mark.parametrize("text,expected", [
    ("21 January 2026 09:15", datetime(2026, 1, 21, 9, 15)),
    ("5 Sept 2025 10:00", datetime(2025, 9, 5, 10, 0)),
    ("5 Sep. 2025 10:00", datetime(2025, 9, 5, 10, 0)),
    ("1 พฤษภาคม 2568 08:00", datetime(2025, 5, 1, 8, 0)),
])
def test_english_full_and_dotted_months(text, expected):
    assert extract_datetime(text) == expected
