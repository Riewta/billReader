"""ทำความสะอาดข้อความ OCR ภาษาไทยก่อน parse

เรื่องเฉพาะของสลิปไทยที่ต้องจัดการ:
- เลขไทย ๐-๙ (บางแอป/บาง OCR ให้ผลเป็นเลขไทย)
- เดือนย่อ "พ.ย." ซึ่ง OCR มักทำจุดหาย -> "พย" หรือมีช่องว่างแทรก "พ. ย."
- ปี พ.ศ. ทั้ง 2 หลัก (68) และ 4 หลัก (2568) ปนกับสลิปภาษาอังกฤษที่เป็น ค.ศ.
- สระ/วรรณยุกต์ที่ encode ได้หลายแบบ (เช่น "ำ" vs "ํา") -> NFC + แก้เคสที่พบบ่อย
"""

from __future__ import annotations

import re
import unicodedata
from decimal import Decimal, InvalidOperation

_THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")

_MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
_MONTHS_TH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                   "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
_MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def _month_table() -> dict[str, int]:
    t: dict[str, int] = {}
    for i, (abbr, full, en) in enumerate(zip(_MONTHS_TH, _MONTHS_TH_FULL, _MONTHS_EN), 1):
        t[abbr] = t[abbr.replace(".", "")] = t[full] = t[en] = i
    return t


MONTHS: dict[str, int] = _month_table()


def normalize_text(s: str) -> str:
    s = unicodedata.normalize("NFC", s).translate(_THAI_DIGITS)
    s = s.replace("ํา", "ำ")  # นิคหิต+สระอา -> สระอำ
    s = s.replace("​", "")  # zero-width space ที่ OCR บางตัวแทรก
    # "พ. ย." -> "พ.ย." : ยุบช่องว่างระหว่างอักษรไทยตัวเดียวกับจุด
    s = re.sub(r"(?<=[ก-ฮ]\.)\s+(?=[ก-ฮ]{1,2}\.)", "", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def lookup_month(token: str) -> int | None:
    token = token.strip().lower()
    return MONTHS.get(token) or MONTHS.get(token.replace(".", "").replace(" ", ""))


def to_gregorian(year: int) -> int:
    """ทำให้ปีเป็น ค.ศ. 4 หลัก

    2 หลัก: >= 60 ถือเป็น พ.ศ. (68 -> 2568 -> 2025), < 60 ถือเป็น ค.ศ. (25 -> 2025)
    heuristic นี้ใช้ได้ถึงปี ค.ศ. 2059 — เขียนไว้ให้รู้ว่ามีวันหมดอายุ
    """
    if year < 100:
        return year + 2500 - 543 if year >= 60 else year + 2000
    return year - 543 if year > 2400 else year


def parse_amount(s: str) -> Decimal | None:
    try:
        return Decimal(s.replace(",", "").replace(" ", ""))
    except InvalidOperation:
        return None
