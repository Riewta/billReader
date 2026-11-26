"""Baseline parser: ข้อความ OCR -> SlipFields

กลยุทธ์ "generic + template":
1. หาว่าสลิปมาจากธนาคารไหน
2. ใช้ label ทั่วไปที่ทุกธนาคารใช้ (จำนวนเงิน, Amount, ...) รวมกับ label เฉพาะธนาคารนั้น (BankTemplate)
3. หา field แบบ "anchor": เจอ label แล้วดูค่าที่ตามมาในบรรทัดเดียวกันหรือบรรทัดถัดไป

ทำไมไม่เขียน template ตายตัวตามตำแหน่งบรรทัด: layout สลิปเปลี่ยนตามเวอร์ชันแอป/ประเภทธุรกรรม
และ OCR แต่ละตัวตัดบรรทัดไม่เหมือนกัน การยึด label ทนกว่าการยึดเลขบรรทัด

!! label ใน TEMPLATES เขียนจากความจำ/สลิปทั่วไป ยังไม่ได้ยืนยันกับสลิปจริงครบทุกธนาคาร
   ให้ปรับจาก results/errors_*.jsonl หลังรัน benchmark รอบแรก
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from slipsense_ml.parsing.normalize import (
    MONTHS, lookup_month, normalize_text, parse_amount, to_gregorian,
)
from slipsense_ml.schema import SlipFields


@dataclass
class BankTemplate:
    keywords: list[str]  # ข้อความที่บอกว่าเป็นธนาคารนี้
    amount_labels: list[str] = field(default_factory=list)
    ref_labels: list[str] = field(default_factory=list)
    receiver_labels: list[str] = field(default_factory=list)


TEMPLATES: dict[str, BankTemplate] = {
    "kbank": BankTemplate(["K PLUS", "KPLUS", "K+", "กสิกรไทย", "KBank", "KASIKORN"], ref_labels=["เลขที่รายการ"]),
    "scb": BankTemplate(["SCB EASY", "SCB", "ไทยพาณิชย์"], ref_labels=["รหัสอ้างอิง"]),
    "ktb": BankTemplate(["Krungthai NEXT", "Krungthai", "กรุงไทย"], ref_labels=["รหัสอ้างอิง"]),
    "bbl": BankTemplate(["Bualuang", "Bangkok Bank", "ธนาคารกรุงเทพ"], ref_labels=["หมายเลขอ้างอิง"]),
    "krungsri": BankTemplate(["Krungsri", "KMA", "กรุงศรี"], ref_labels=["เลขที่อ้างอิง"]),
    "ttb": BankTemplate(["ttb touch", "ttb", "ทีทีบี", "ทหารไทยธนชาต"]),
    "gsb": BankTemplate(["MyMo", "ออมสิน", "GSB"]),
}

GENERIC_AMOUNT = ["จำนวนเงิน", "จำนวน", "ยอดเงิน", "ยอดโอน", "Amount"]
GENERIC_REF = ["เลขที่รายการ", "รหัสอ้างอิง", "เลขอ้างอิง", "หมายเลขอ้างอิง", "เลขที่อ้างอิง",
               "Transaction ID", "Ref No", "Ref. No", "Reference No", "Ref"]
GENERIC_RECEIVER = ["ผู้รับเงิน", "ผู้รับ", "ไปยัง", "ไปที่", "ถึง", "To"]

_NUM = r"(\d{1,3}(?:,\d{3})+|\d+)\.\d{2}"  # ต้องมีทศนิยม 2 ตำแหน่ง กันไปจับเลขบัญชี/เวลา
_FEE = re.compile(r"ค่าธรรมเนียม|fee", re.I)
_NAME_PREFIX = r"(?:นางสาว|น\.ส\.|นาย|นาง|MR\.?|MRS\.?|MS\.?|MISS|บจก\.|บริษัท|หจก\.)"
# บรรทัดที่ "ไม่ใช่ชื่อ": เลขบัญชี (xxx-x-x1234-x), เบอร์, ชื่อธนาคาร
_NOT_NAME = re.compile(r"^[\dxX\-\s*•]+$|ธนาคาร|bank|พร้อมเพย์|promptpay", re.I)


def _alt(labels: list[str]) -> str:
    # เรียงยาวไปสั้น ไม่งั้น "จำนวน" จะ match ก่อน "จำนวนเงิน"
    # lookaround กัน label อังกฤษไปติดกลางคำ เช่น "To" ใน "Total", "Ref" ใน "Prefix"
    alts = "|".join(re.escape(x) for x in sorted(set(labels), key=len, reverse=True))
    return rf"(?<![A-Za-z])(?:{alts})(?![A-Za-z])"


def detect_bank(text: str) -> str | None:
    """ธนาคารที่ keyword ปรากฏ "เร็วสุด" ในข้อความ

    เหตุผล: สลิปมีทั้งธนาคารผู้โอนและผู้รับ แต่เกือบทุกแอปวางชื่อ/โลโก้แอปและฝั่งผู้โอนไว้ด้านบน
    จุดอ่อน: ถ้า OCR อ่านโลโก้ไม่ออก (โลโก้เป็นรูป ไม่ใช่ตัวอักษร) จะไปเจอธนาคารผู้รับแทน
    -> ถ้าความแม่นต่ำ ทางแก้ต่อไปคือจำแนกจากสี/layout ของรูป (image classifier เล็ก ๆ)
    """
    best: tuple[int, str] | None = None
    for code, tpl in TEMPLATES.items():
        for kw in tpl.keywords:
            # \b ใช้กับตัวอังกฤษ กัน "SCB" ไปเจอในคำอื่น; ไทยไม่มีช่องว่างระหว่างคำเลยใช้ไม่ได้
            pat = rf"(?<![A-Za-z]){re.escape(kw)}(?![A-Za-z])" if kw.isascii() else re.escape(kw)
            m = re.search(pat, text, re.I)
            if m and (best is None or m.start() < best[0]):
                best = (m.start(), code)
    return best[1] if best else None


def extract_amount(text: str, tpl: BankTemplate | None) -> Decimal | None:
    labels = GENERIC_AMOUNT + (tpl.amount_labels if tpl else [])
    # 1) anchor: label แล้วตามด้วยตัวเลขภายใน ~40 ตัวอักษร (ข้ามบรรทัดได้ 1 ครั้ง)
    m = re.search(rf"(?:{_alt(labels)})[^\d\n]{{0,20}}\n?[^\d\n]{{0,20}}({_NUM})", text, re.I)
    if m:
        return parse_amount(m.group(1))
    # 2) fallback: ตัวเลขที่ตามด้วย บาท/THB/฿ ที่ไม่ใช่บรรทัดค่าธรรมเนียม เอาค่ามากสุด
    cands = [
        parse_amount(m.group(1))
        for line in text.splitlines() if not _FEE.search(line)
        for m in re.finditer(rf"({_NUM})\s*(?:บาท|THB|฿)", line, re.I)
    ]
    cands = [c for c in cands if c is not None]
    return max(cands) if cands else None


_MONTH_ALT = "|".join(re.escape(k) for k in sorted(MONTHS, key=len, reverse=True))
_DATE_TEXT = re.compile(rf"(\d{{1,2}})\s*({_MONTH_ALT})\s*(\d{{2,4}})", re.I)
_DATE_NUM = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2,4})")
_TIME = re.compile(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?!\d)")


def extract_datetime(text: str) -> datetime | None:
    m = _DATE_TEXT.search(text)
    if m:
        day, month, year = int(m.group(1)), lookup_month(m.group(2)), int(m.group(3))
    else:
        m = _DATE_NUM.search(text)
        if not m:
            return None
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    # เวลามักอยู่หลังวันที่ทันที ค้นหลังวันที่ก่อน ค่อย fallback ทั้งข้อความ
    t = _TIME.search(text, m.end()) or _TIME.search(text)
    hh, mm = (int(t.group(1)), int(t.group(2))) if t else (0, 0)
    try:
        return datetime(to_gregorian(year), month or 0, day, hh, mm)
    except ValueError:
        return None


def extract_ref(text: str, tpl: BankTemplate | None) -> str | None:
    labels = (tpl.ref_labels if tpl else []) + GENERIC_REF
    m = re.search(rf"(?:{_alt(labels)})\.?\s*[:：]?\s*\n?\s*([A-Za-z0-9]{{8,}})", text, re.I)
    return m.group(1).upper() if m else None


def extract_receiver(text: str, tpl: BankTemplate | None) -> str | None:
    """field ที่ยากสุด: ไม่มี label ตายตัว และชื่อร้านไม่มีคำนำหน้า

    1) ถ้าเจอ label ผู้รับ -> บรรทัดแรกหลังจากนั้นที่ดูเป็นชื่อ
    2) ไม่งั้น: บรรทัดที่ขึ้นต้นด้วยคำนำหน้าชื่อ "บรรทัดที่สอง" (บรรทัดแรกมักเป็นผู้โอน)
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    labels = (tpl.receiver_labels if tpl else []) + GENERIC_RECEIVER
    lab = re.compile(rf"^(?:{_alt(labels)})\s*[:：]?\s*(.*)$", re.I)
    for i, ln in enumerate(lines):
        m = lab.match(ln)
        if not m:
            continue
        rest = [m.group(1)] + lines[i + 1 : i + 4]
        for cand in rest:
            if cand and not _NOT_NAME.search(cand):
                return cand
    named = [ln for ln in lines if re.match(_NAME_PREFIX, ln, re.I)]
    if len(named) >= 2:
        return named[1]
    return None


def parse_slip(raw_text: str) -> SlipFields:
    text = normalize_text(raw_text)
    bank = detect_bank(text)
    tpl = TEMPLATES.get(bank) if bank else None
    return SlipFields(
        bank=bank,
        amount=extract_amount(text, tpl),
        paid_at=extract_datetime(text),
        receiver_name=extract_receiver(text, tpl),
        ref=extract_ref(text, tpl),
    )
