"""ข้อความในไฟล์นี้ "จำลอง" ผล OCR ของสลิป (แต่งขึ้น ไม่ใช่ข้อมูลจริง)

เมื่อมีสลิปจริงแล้ว ให้เพิ่มเคสจาก OCR cache จริง (ปิดชื่อ/เลขบัญชีก่อน) ไว้ใน tests/fixtures/
ทุกครั้งที่ parser พังกับสลิปใบไหน -> เพิ่มเป็น test หนึ่งเคส แล้วค่อยแก้ (regression test)
"""

from datetime import datetime
from decimal import Decimal

from slipsense_ml.parsing.parser import detect_bank, extract_amount, parse_slip

KBANK = """
โอนเงินสำเร็จ
3 พ.ย. 68 12:34 น.
K+
นาย ก้องภพ ร
ธ.กสิกรไทย
xxx-x-x1234-x
นาย สมชาย ใจดี
ธ.ไทยพาณิชย์
xxx-x-x5678-x
เลขที่รายการ:
015307123456ABC12345
จำนวน:
150.00 บาท
ค่าธรรมเนียม:
0.00 บาท
"""

# OCR พังแบบที่เจอบ่อย: เลขไทย, จุดในเดือนหาย, สระอำแยก
SCB_NOISY = """
SCB EASY
จ่ายบิลสำเร็จ
๒๘ ตค ๒๕๖๘ - ๐๘:๐๕
จาก
นางสาว มะลิ ส
ไปยัง
ร้านกาแฟดีดี
รหัสอ้างอิง: 2025102808051234567
จํานวนเงิน 1,250.00
"""

KTB_EN = """
Krungthai NEXT
Transfer successful
Amount 12,000.00 THB
Fee 0.00 THB
From MR. SOMSAK P
To MISS NARIN K
Transaction ID: A1B2C3D4E5F6
28/10/2025 21:15:30
"""


def test_kbank_all_fields():
    s = parse_slip(KBANK)
    assert s.bank == "kbank"
    assert s.amount == Decimal("150.00")
    assert s.paid_at == datetime(2025, 11, 3, 12, 34)
    assert s.receiver_name == "นาย สมชาย ใจดี"
    assert s.ref == "015307123456ABC12345"


def test_scb_with_noisy_ocr():
    s = parse_slip(SCB_NOISY)
    assert s.bank == "scb"
    assert s.amount == Decimal("1250.00")
    assert s.paid_at == datetime(2025, 10, 28, 8, 5)
    assert s.receiver_name == "ร้านกาแฟดีดี"
    assert s.ref == "2025102808051234567"


def test_ktb_english_slip():
    s = parse_slip(KTB_EN)
    assert s.bank == "ktb"
    assert s.amount == Decimal("12000.00")
    assert s.paid_at == datetime(2025, 10, 28, 21, 15)
    assert s.receiver_name == "MISS NARIN K"
    assert s.ref == "A1B2C3D4E5F6"


def test_sender_bank_wins_over_receiver_bank():
    # ธ.ไทยพาณิชย์ (ผู้รับ) อยู่ในสลิป KBANK ด้วย แต่ต้องได้ kbank เพราะขึ้นก่อน
    assert detect_bank(KBANK) == "kbank"


def test_amount_fallback_ignores_fee_line():
    text = "ค่าธรรมเนียม 25.00 บาท\nโอนแล้ว 300.00 บาท"
    assert extract_amount(text, None) == Decimal("300.00")


def test_garbage_returns_empty_fields_not_crash():
    s = parse_slip("@@## ???")
    assert s.amount is None and s.paid_at is None and s.ref is None
