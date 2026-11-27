"""regression tests จากรูปแบบที่เจอบนสลิปจริงชุด dev

ข้อความทั้งหมดเป็นของปลอม (ชื่อ/เลขบัญชี/ref สมมติ) แต่จำลองโครงสร้าง OCR ที่ทำ parser พังจริง
"""

from decimal import Decimal

from slipsense_ml.eval.validate_labels import summary
from slipsense_ml.parsing.parser import parse_slip
from slipsense_ml.parsing.qr import crc16_ccitt, parse_slip_qr


def make_payload(bank_code: str, ref: str) -> str:
    inner = f"0006000001" f"0103{bank_code}" f"02{len(ref):02d}{ref}"
    body = f"00{len(inner):02d}{inner}5102TH9104"
    return body + crc16_ccitt(body)


# --- QR ---

def test_qr_valid_payload():
    q = parse_slip_qr(make_payload("004", "015999123456BTF00001"))
    assert q.bank == "kbank" and q.ref == "015999123456BTF00001"


def test_qr_keeps_case_and_maps_scb():
    q = parse_slip_qr(make_payload("014", "20990101aBcDeFgHiJ"))
    assert q.bank == "scb" and q.ref == "20990101aBcDeFgHiJ"


def test_qr_bad_crc_rejected():
    p = make_payload("004", "015999123456BTF00001")
    bad = p[:-1] + ("0" if p[-1] != "0" else "1")
    assert parse_slip_qr(bad) is None


def test_qr_unknown_bank_code_keeps_ref():
    q = parse_slip_qr(make_payload("999", "015999123456BTF00001"))
    assert q.bank is None and q.ref == "015999123456BTF00001"


def test_qr_garbage_and_none():
    assert parse_slip_qr(None) is None
    assert parse_slip_qr("https://example.com/menu") is None


def test_qr_overrides_ocr_ref_and_bank():
    # OCR อ่าน ref เพี้ยน (BTF -> 87f) และไม่เห็นโลโก้ธนาคาร: QR ต้องชนะ
    text = "โอนเงินสำเร็จ\nจำนวน:\n10.00 บาท\nเลขที่รายการ:\n01599912345687f00001\n"
    s = parse_slip(text, make_payload("004", "015999123456BTF00001"))
    assert s.bank == "kbank" and s.ref == "015999123456BTF00001"


# --- layout K+ ---

KPLUS_PROMPTPAY = """โอนเงินสำเร็จ
+
3 ม.ค. 69 09:15 น.
นาย สมมติ ใ
ธ.กสิกรไทย
xxx-x-x1234-x
สมหญิง ทดสอบ
prompt pay
006-xxxxxxxx-9999
จำนวน:
51.00 บาท
ค่าธรรมเนียม:
0.00 บาท
เลขทีรายการ:
สแกน
015999123456BPP00001
ตรวจสอบสลิป
"""


def test_kplus_ref_skips_scan_caption_and_label_typo():
    # "สแกน" แทรกระหว่าง label กับค่า และ OCR อ่าน "เลขที่" เป็น "เลขที"
    assert parse_slip(KPLUS_PROMPTPAY).ref == "015999123456BPP00001"


def test_kplus_receiver_without_title_prefix():
    s = parse_slip(KPLUS_PROMPTPAY)
    assert s.receiver_name == "สมหญิง ทดสอบ"
    assert s.amount == Decimal("51.00")


def test_kplus_organization_receiver():
    text = KPLUS_PROMPTPAY.replace("สมหญิง ทดสอบ", "องค์การทดสอบมหาชน")
    assert parse_slip(text).receiver_name == "องค์การทดสอบมหาชน"


def test_bare_title_on_own_line_is_skipped():
    # EasyOCR แยก "นาย" ไปอยู่คนละบรรทัดกับชื่อ
    text = KPLUS_PROMPTPAY.replace("สมหญิง ทดสอบ\nprompt pay", "สมชาย ทดสอบ\nนาย\nธ.กสิกรไทย")
    assert parse_slip(text).receiver_name == "สมชาย ทดสอบ"


def test_tesseract_column_junk_is_trimmed():
    # tesseract อ่านไอคอนวงกลมเป็น "๐" และวางขยะไว้คอลัมน์ขวา
    text = KPLUS_PROMPTPAY.replace("สมหญิง ทดสอบ", "๐  ร้านทดสอบ SHOP (สาขา)      ธี อ")
    assert parse_slip(text).receiver_name == "ร้านทดสอบ SHOP (สาขา)"


def test_make_layout_receiver_and_case_sensitive_ref():
    text = """make
transfer completed
3 Jan 2026 10:43
SOMMUT T
xxx-x-x1234-x
มาลี ทดสอบ
prompt pay- 140 xxxxxxxx-0000
Amount
45.00 Baht
Transaction ID: 0469995o9aB1cD2eF3gH
"""
    s = parse_slip(text)
    assert s.receiver_name == "มาลี ทดสอบ"
    assert s.ref == "0469995o9aB1cD2eF3gH"  # ไม่ .upper(): ref make/SCB มีตัวเล็กใหญ่ปน


def test_amount_line_is_not_a_name():
    text = "TRANSFER\nSOMMUT T\nxxx-x-x0000-x\n1.40-xxxxxxxx-0426\nAmount\n45.00 Baht\n"
    assert parse_slip(text).receiver_name is None  # ไม่มีชื่อดีกว่าได้ชื่อผิด


# --- validate_labels.summary ---

def test_summary_shows_unassigned_separately():
    rows = [{"bank": "kbank", "split": "dev"}, {"bank": "kbank"}]
    out = summary(rows)
    assert "| kbank | 1 | 0 | 1 | 2 |" in out
