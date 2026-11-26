"""อ่าน ref และธนาคารผู้โอนจาก payload ของ QR บนสลิป (stdlib ล้วน)

ทำไมใช้ QR: QR บนสลิปเก็บเลขอ้างอิงเป็นข้อความดิจิทัล ไม่ต้องเดาจากรูปตัวอักษร
OCR สับสน BTF→87f, 00→OO, ตัวเล็ก/ใหญ่ แต่ QR ถอดได้ตรงตัวเสมอ หรือถอดไม่ได้เลย (ไม่มี "ผิดแบบเนียน")

รูปแบบ (TLV แบบ EMVCo: tag 2 หลัก, ความยาว 2 หลัก, ค่า) ที่เจอบนสลิป K+, make, SCB:
    00 <len> [ 00 06 000001 | 01 03 <รหัสธนาคาร> | 02 <len> <ref> ]
    51 02 TH
    91 04 <CRC16>
ถอดรูปเป็นข้อความต้องใช้ opencv ซึ่งอยู่นอก core: ดู slipsense_ml/ocr/qr_image.py
"""

from __future__ import annotations

from dataclasses import dataclass

# รหัสธนาคารไทย 3 หลักมาตรฐาน (ใช้ใน PromptPay/ITMX ด้วย)
BANK_CODES = {
    "002": "bbl", "004": "kbank", "006": "ktb", "011": "ttb",
    "014": "scb", "025": "krungsri", "030": "gsb",
}


@dataclass
class SlipQR:
    bank: str | None  # ธนาคารผู้ออกสลิป (ผู้โอน) — None ถ้ารหัสไม่อยู่ในตาราง
    bank_code: str
    ref: str


def parse_tlv(payload: str) -> dict[str, str]:
    """แตก TLV ชั้นเดียว; โยน ValueError ถ้ารูปแบบเพี้ยน (ความยาวเกินข้อความ ฯลฯ)"""
    out, i = {}, 0
    while i < len(payload):
        tag, ln = payload[i : i + 2], payload[i + 2 : i + 4]
        if len(tag) < 2 or not ln.isdigit():
            raise ValueError(f"TLV เสียที่ตำแหน่ง {i}")
        n = int(ln)
        val = payload[i + 4 : i + 4 + n]
        if len(val) != n:
            raise ValueError(f"tag {tag} ยาวเกินข้อความ")
        out[tag] = val
        i += 4 + n
    return out


def crc16_ccitt(data: str) -> str:
    """CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) แบบเดียวกับ PromptPay QR"""
    crc = 0xFFFF
    for b in data.encode("ascii"):
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else (crc << 1)
            crc &= 0xFFFF
    return f"{crc:04X}"


def parse_slip_qr(payload: str | None) -> SlipQR | None:
    """payload -> SlipQR หรือ None ถ้าไม่ใช่ QR สลิป/CRC ไม่ตรง

    ตรวจ CRC ก่อนเสมอ: QR ที่ถอดผิดบางส่วน (หรือ QR อื่นบนรูป เช่น QR ร้าน) จะไม่ผ่าน
    ทำให้ค่าที่ได้จากฟังก์ชันนี้ "เชื่อได้" — เป็นแหล่งที่ parser ควรให้ความสำคัญเหนือ OCR
    """
    if not payload or len(payload) < 12:
        return None
    try:
        body, crc = payload[:-4], payload[-4:]
        if not body.endswith("9104") or crc16_ccitt(body) != crc.upper():
            return None
        top = parse_tlv(payload)
        inner = parse_tlv(top["00"])
        code, ref = inner["01"], inner["02"]
    except (ValueError, KeyError, UnicodeEncodeError):
        return None
    if not ref.isalnum():
        return None
    return SlipQR(bank=BANK_CODES.get(code), bank_code=code, ref=ref)
