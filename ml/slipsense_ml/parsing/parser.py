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
from datetime import datetime, timedelta
from decimal import Decimal

from slipsense_ml.parsing.normalize import (
    MONTHS, lookup_month, normalize_text, parse_amount, to_gregorian,
)
from slipsense_ml.parsing.qr import parse_slip_qr
from slipsense_ml.schema import SlipFields


@dataclass
class BankTemplate:
    keywords: list[str]  # ข้อความที่บอกว่าเป็นธนาคารนี้
    amount_labels: list[str] = field(default_factory=list)
    ref_labels: list[str] = field(default_factory=list)
    receiver_labels: list[str] = field(default_factory=list)


TEMPLATES: dict[str, BankTemplate] = {
    "kbank": BankTemplate(["K PLUS", "KPLUS", "K+", "กสิกรไทย", "KBank", "KASIKORN"], ref_labels=["เลขที่รายการ", "เลขทีรายการ"]),
    "scb": BankTemplate(["SCB EASY", "SCB", "ไทยพาณิชย์"], ref_labels=["รหัสอ้างอิง"]),
    "ktb": BankTemplate(["Krungthai NEXT", "Krungthai", "กรุงไทย"], ref_labels=["รหัสอ้างอิง"]),
    "bbl": BankTemplate(["Bualuang", "Bangkok Bank", "ธนาคารกรุงเทพ"], ref_labels=["หมายเลขอ้างอิง"]),
    "krungsri": BankTemplate(["Krungsri", "KMA", "กรุงศรี"], ref_labels=["เลขที่อ้างอิง"]),
    "ttb": BankTemplate(["ttb touch", "ttb", "ทีทีบี", "ทหารไทยธนชาต"]),
    "gsb": BankTemplate(["MyMo", "ออมสิน", "GSB"]),
}

GENERIC_AMOUNT = ["จำนวนเงิน", "จำนวน", "ยอดเงิน", "ยอดโอน", "Amount"]
GENERIC_REF = ["เลขที่รายการ", "รหัสอ้างอิง", "เลขอ้างอิง", "หมายเลขอ้างอิง", "เลขที่อ้างอิง",
               "Transaction ID", "Transaction", "Ref No", "Ref. No", "Reference No", "Ref"]
GENERIC_RECEIVER = ["ผู้รับเงิน", "ผู้รับ", "ไปยัง", "ไปที่", "ถึง", "To"]

_NUM = r"(\d{1,3}(?:,\d{3})+|\d+)\.\d{2}"  # ต้องมีทศนิยม 2 ตำแหน่ง กันไปจับเลขบัญชี/เวลา
_FEE = re.compile(r"ค่าธรรมเนียม|fee", re.I)
_NAME_PREFIX = r"(?:นางสาว|น\.ส\.|นาย|นาง|MR\.?|MRS\.?|MS\.?|MISS|บจก\.|บริษัท|หจก\.)"
# บรรทัดที่ "ไม่ใช่ชื่อ": เลขบัญชี (xxx-x-x1234-x), เบอร์, ชื่อธนาคาร
_NOT_NAME = re.compile(r"^[\dxX\-\s*•]+$|ธนาคาร|^ธ\.|bank|พร้อมเพย์|promptpay|^\+$|^(?:amount|fee|baht|บาท|จำนวน|ค่าธรรมเนียม)|\d\.\d\d\b", re.I)
# บรรทัดเลขบัญชี/เบอร์ที่ถูกปิดบาง: xxx-x-x6887-x, 006-xxxxxxxx-2584 หรือแบบที่ tesseract อ่านเพี้ยน 2000(-%-%6887-%
_ACCOUNT = re.compile(r"[xX%]{3}|\d{3,}-|-\d{3,}|\d{4}-?[xX%]")
_BARE_PREFIX = re.compile(rf"^{_NAME_PREFIX}$", re.I)


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
    return _amount(text, tpl)[0]


def _amount(text: str, tpl: BankTemplate | None) -> tuple[Decimal | None, bool]:
    """คืน (ยอด, มั่นใจไหม)

    มั่นใจ = เจอผ่าน label "และ" ค่าบวกไม่เป็นศูนย์ ส่วน fallback (เลขมากสุดที่ตามด้วย "บาท") ไม่มั่นใจ
    เพราะเดาจากรูปแบบล้วน ๆ อาจไปจับยอดคงเหลือหรือตัวเลขอื่นที่บังเอิญมีคำว่าบาท
    """
    labels = GENERIC_AMOUNT + (tpl.amount_labels if tpl else [])
    # 1) anchor: label แล้วตามด้วยตัวเลขภายใน ~40 ตัวอักษร (ข้ามบรรทัดได้ 1 ครั้ง)
    m = re.search(rf"(?:{_alt(labels)})[^\d\n]{{0,20}}\n?[^\d\n]{{0,20}}({_NUM})", text, re.I)
    if m:
        v = parse_amount(m.group(1))
        return v, v is not None and v > 0
    # 2) fallback: ตัวเลขที่ตามด้วย บาท/THB/฿ ที่ไม่ใช่บรรทัดค่าธรรมเนียม เอาค่ามากสุด
    cands = [
        parse_amount(m.group(1))
        for line in text.splitlines() if not _FEE.search(line)
        for m in re.finditer(rf"({_NUM})\s*(?:บาท|THB|฿)", line, re.I)
    ]
    cands = [c for c in cands if c is not None]
    return (max(cands) if cands else None), False


_MONTH_ALT = "|".join(re.escape(k) for k in sorted(MONTHS, key=len, reverse=True))
# \.? หลังเดือน: สลิปอังกฤษบางแบบเขียน "Sep." (เดือนไทยมีจุดอยู่ใน key แล้ว)
_DATE_TEXT = re.compile(rf"(\d{{1,2}})\s*({_MONTH_ALT})\.?\s*(\d{{2,4}})", re.I)
_DATE_NUM = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2,4})")
_TIME = re.compile(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?!\d)")


def extract_datetime(text: str) -> datetime | None:
    return _datetime(text)[0]


def _datetime(text: str, now: datetime | None = None) -> tuple[datetime | None, bool]:
    """คืน (วันเวลา, มั่นใจไหม)

    มั่นใจเมื่อครบ 3 ข้อ:
    - วันที่มีชื่อเดือนเป็นตัวอักษร (ไม่ใช่ 05/06/68 ที่อ่านเป็น วัน/เดือน หรือ เดือน/วัน ก็ได้)
    - เจอเวลาภายในบรรทัดเดียวกันหรือบรรทัดถัดไปของวันที่ (ถ้าต้องไปควานทั้งข้อความ อาจได้เวลาจากที่อื่น)
    - ปีอยู่ในช่วงที่เป็นไปได้ และไม่อยู่ในอนาคต (ปีเพี้ยนเพราะ OCR อ่าน 68 เป็น 88 จะหลุดตรงนี้)
    """
    m = _DATE_TEXT.search(text)
    textual = m is not None
    if m:
        day, month, year = int(m.group(1)), lookup_month(m.group(2)), int(m.group(3))
    else:
        m = _DATE_NUM.search(text)
        if not m:
            return None, False
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    # เวลามักอยู่หลังวันที่ทันที ค้นหลังวันที่ก่อน ค่อย fallback ทั้งข้อความ
    near = _TIME.search(text, m.end())
    near_ok = near is not None and text.count("\n", m.end(), near.start()) <= 1
    t = near or _TIME.search(text)
    hh, mm = (int(t.group(1)), int(t.group(2))) if t else (0, 0)
    try:
        dt = datetime(to_gregorian(year), month or 0, day, hh, mm)
    except ValueError:
        return None, False
    now = now or datetime.now()
    plausible = 2015 <= dt.year and dt <= now + timedelta(days=1)  # เผื่อ timezone 1 วัน
    return dt, textual and near_ok and plausible


# ค่า ref: ตัวอักษร/ตัวเลขติดกัน >=10 ตัว และต้องมีตัวเลขอย่างน้อย 1 ตัว (กันไปจับคำอย่าง "completed")
_REF_VALUE = re.compile(r"(?<![A-Za-z0-9])(?=[A-Za-z]*\d)([A-Za-z0-9]{10,})(?![A-Za-z0-9])")


def extract_ref(text: str, tpl: BankTemplate | None) -> str | None:
    """หลัง label ref มองหาค่าในบรรทัดเดียวกันหรือ 2 บรรทัดถัดไป

    ทำไมยอมข้ามบรรทัด: บน K+ คำ "สแกน" ข้าง QR แทรกอยู่ระหว่าง "เลขที่รายการ:" กับเลข
    ทำไมไม่ .upper(): ref ของ SCB/make มีตัวเล็กใหญ่ปน (เช่น fT29...ixqb) ตัวพิมพ์เป็นส่วนของค่า
    """
    return _ref(text, tpl)[0]


def _ref(text: str, tpl: BankTemplate | None) -> tuple[str | None, bool]:
    """OCR ref ไม่เคยมั่นใจ: OCR สับสน 0/O, 8/B, ตัวเล็ก/ใหญ่ แบบที่ดูไม่ออกด้วยตา
    ค่าที่ผิดแบบเนียนพวกนี้ทำให้กันสลิปซ้ำพลาด จึงให้ผู้ใช้ดูทุกครั้งที่ไม่มี QR"""
    labels = (tpl.ref_labels if tpl else []) + GENERIC_REF
    for m in re.finditer(_alt(labels), text, re.I):
        window = "\n".join(text[m.end():].split("\n")[:3])
        v = _REF_VALUE.search(window)
        if v:
            return v.group(1), False
    return None, False


def _clean_name(line: str) -> str:
    """ตัดขยะที่ OCR แปะมากับบรรทัดชื่อ

    - tesseract อ่านไอคอน/โลโก้ข้าง ๆ เป็นข้อความแยกด้วยช่องว่างยาว: เลือกช่วงแรกที่มีตัวอักษร >=3 ตัว
    - token หัว/ท้ายที่ไม่มีตัวอักษร ("0", "@", "=32", "5") หรือเป็นอักษรไทยตัวเดียว ("จ")
      อักษรอังกฤษตัวเดียวเก็บไว้ เพราะเป็นอักษรย่อนามสกุล ("NARIN K")
    - ขยะอักษรละติน/ตัวเลขที่อยู่หน้าคำนำหน้าชื่อไทย ("WBwRE นาย...": Paddle อ่านไอคอนเป็นตัวอักษร)
      ตัดได้เพราะชื่อคนไทยไม่มีคำอังกฤษนำหน้า "นาย/นาง/น.ส." แต่ตัดเฉพาะเมื่อของที่ตัดไม่มีอักษรไทยเลย
      ไม่งั้นนามสกุลที่ขึ้นต้นด้วย "นาย" (เช่น "นายกวงศ์") จะทำให้ชื่อจริงหายไป
    """
    chunks = [c.strip() for c in re.split(r"\s{2,}", line) if c.strip()]
    chunk = next((c for c in chunks if len(re.findall(r"[^\W\d_]", c)) >= 3), line.strip())
    toks = chunk.split()
    for i in range(1, len(toks)):
        if re.match(r"(?:นางสาว|น\.ส\.|นาย|นาง)", toks[i]):
            if not any(re.search(r"[ก-๙]", t) for t in toks[:i]):
                toks = toks[i:]
            break
    def junk(t: str) -> bool:
        return not re.search(r"[^\W\d_]", t) or (len(t) <= 2 and not re.fullmatch(r"[A-Za-z]", t) and re.search(r"[ก-๙]", t))

    while len(toks) > 1 and junk(toks[0]):
        toks.pop(0)
    while len(toks) > 1 and junk(toks[-1]):
        toks.pop()
    return " ".join(toks)


def _looks_like_name(line: str) -> bool:
    return (
        len(re.findall(r"[^\W\d_]", line)) >= 3
        and not _NOT_NAME.search(line)
        and not _ACCOUNT.search(line)
        and not _BARE_PREFIX.match(line)
    )


def extract_receiver(text: str, tpl: BankTemplate | None) -> str | None:
    return _receiver(text, tpl)[0]


def _receiver(text: str, tpl: BankTemplate | None) -> tuple[str | None, bool]:
    """field ที่ยากสุด: ไม่มี label ตายตัว และชื่อร้าน/PromptPay ไม่มีคำนำหน้า

    1) ถ้าเจอ label ผู้รับ (SCB: "ไปยัง") -> บรรทัดแรกหลังจากนั้นที่ดูเป็นชื่อ
    2) layout แบบ K+/make: ผู้โอน -> เลขบัญชีผู้โอน -> **ผู้รับ** -> ธนาคาร/เลขบัญชีผู้รับ
       จึงเอาบรรทัดแรกที่ดูเป็นชื่อหลังบรรทัดเลขบัญชีแรก
       ไม่พึ่งคำนำหน้า เลยได้ทั้งชื่อร้าน องค์กร และชื่อ PromptPay ที่ไม่มี "นาย"
    3) สุดท้าย: บรรทัดที่ขึ้นต้นด้วยคำนำหน้าชื่อ "บรรทัดที่สอง" (บรรทัดแรกมักเป็นผู้โอน)
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
            cleaned = _clean_name(cand) if cand else cand
            if cleaned and not _NOT_NAME.search(cleaned):
                # มั่นใจเมื่อไม่ต้องตัดขยะออก: ถ้าต้องตัด แปลว่า OCR อ่านบรรทัดนี้ไม่สะอาด
                return cleaned, cleaned == cand.strip() and _looks_like_name(cleaned)
    accts = [i for i, ln in enumerate(lines) if _ACCOUNT.search(ln)]
    if accts:
        for j in range(accts[0] + 1, min(accts[0] + 4, len(lines))):
            name = _clean_name(lines[j])
            if _looks_like_name(name):
                # มั่นใจเมื่อโครงสร้างครบ: เลขบัญชีผู้โอน -> ชื่อ -> เลขบัญชีผู้รับ (ภายใน 3 บรรทัด)
                # ถ้าไม่มีเลขบัญชีปิดท้าย ชื่อนี้อาจเป็นข้อความอื่นที่บังเอิญอยู่ตรงนั้น
                closed = any(j < k <= j + 3 for k in accts[1:])
                return name, closed and name == lines[j]
    named = [ln for ln in lines if re.match(_NAME_PREFIX, ln, re.I)]
    if len(named) >= 2:
        return named[1], False
    return None, False


@dataclass
class ParsedSlip:
    """ผล parser พร้อมความมั่นใจราย field — ตรงกับ FieldValue ใน web/src/lib/types.ts

    confident=False -> หน้า review ต้องให้ผู้ใช้ดู field นั้น
    กติกา: ยอมให้ "ไม่มั่นใจ" ผิดเยอะ (ผู้ใช้แค่กดยืนยัน) ดีกว่า "มั่นใจ" แล้วผิด (ค่าผิดหลุดเข้า dashboard เงียบ ๆ)
    """

    fields: SlipFields
    confident: dict[str, bool]
    source: dict[str, str]  # "qr" | "ocr"


def parse_slip(raw_text: str, qr_payload: str | None = None) -> SlipFields:
    return parse_slip_detailed(raw_text, qr_payload).fields


def parse_slip_detailed(raw_text: str, qr_payload: str | None = None) -> ParsedSlip:
    """qr_payload: ข้อความที่ถอดจาก QR บนสลิป (ถ้ามี) — ref และธนาคารจาก QR ชนะ OCR

    ทำไม QR ชนะ: ผ่าน CRC แล้ว ค่าตรงตัว 100% ส่วน OCR เดาจากรูป
    ถ้า QR ไม่มี/อ่านไม่ได้/ธนาคารไม่อยู่ในตาราง ค่อยใช้ค่าจาก OCR
    """
    text = normalize_text(raw_text)
    qr = parse_slip_qr(qr_payload)
    ocr_bank = detect_bank(text)
    bank = (qr.bank if qr else None) or ocr_bank
    tpl = TEMPLATES.get(bank) if bank else None
    amount, amount_ok = _amount(text, tpl)
    paid_at, paid_ok = _datetime(text)
    receiver, receiver_ok = _receiver(text, tpl)
    ref, ref_ok = (qr.ref, True) if qr else _ref(text, tpl)
    bank_src = "qr" if qr and qr.bank else "ocr"
    return ParsedSlip(
        fields=SlipFields(bank=bank, amount=amount, paid_at=paid_at, receiver_name=receiver, ref=ref),
        confident={
            # ธนาคารจาก OCR = keyword ที่ขึ้นก่อน ซึ่งพลาดได้ถ้าโลโก้เป็นรูป -> มั่นใจเฉพาะจาก QR
            "bank": bank_src == "qr",
            "amount": amount_ok,
            "paid_at": paid_ok,
            "receiver_name": receiver_ok,
            "ref": ref_ok,
        },
        source={"bank": bank_src, "amount": "ocr", "paid_at": "ocr", "receiver_name": "ocr",
                "ref": "qr" if qr else "ocr"},
    )
