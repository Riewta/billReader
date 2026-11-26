"""ตัววัดผลแยกต่อ field

แนวคิด: เราไม่ได้สนใจว่า OCR อ่าน "ทุกตัวอักษร" ถูกไหม (CER ทั้งหน้า) เพราะต้อง label ข้อความเต็มทุกใบ
ซึ่งแพงมาก และสิ่งที่ผู้ใช้เห็นคือ field ไม่ใช่ข้อความ จึงวัด 2 ชั้น:

1. **OCR recall** — ค่าที่ถูกต้อง "ปรากฏอยู่ใน" ข้อความ OCR ไหม (วัด OCR ล้วน ๆ ไม่ขึ้นกับ parser)
2. **End-to-end field accuracy** — parser(OCR(รูป)) ตรงกับ label ไหม

ถ้าชั้น 1 สูงแต่ชั้น 2 ต่ำ = ปัญหาอยู่ที่ parser (แก้ regex/template ได้)
ถ้าชั้น 1 ต่ำ = OCR อ่านไม่ออกเอง parser เก่งแค่ไหนก็ช่วยไม่ได้ -> ต้องเปลี่ยน engine/preprocess
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field

from slipsense_ml.parsing.normalize import normalize_text
from slipsense_ml.schema import FIELDS, SlipFields

NAME_MATCH_THRESHOLD = 0.85

_NAME_PREFIX = re.compile(r"^(นางสาว|น\.ส\.|นาย|นาง|mr\.?|mrs\.?|ms\.?|miss)\s*", re.I)


def levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def similarity(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    return 1 - levenshtein(a, b) / max(len(a), len(b))


def normalize_name(s: str) -> str:
    s = normalize_text(s).strip()
    s = _NAME_PREFIX.sub("", s)
    return re.sub(r"\s+", "", s).lower()


def field_correct(name: str, pred, gold) -> bool:
    if pred is None:
        return False
    if name == "receiver_name":
        # ชื่อใช้ fuzzy: OCR ไทยมักพลาดสระ/วรรณยุกต์ 1-2 ตัว ซึ่งผู้ใช้ยังจำได้ว่าคือใคร
        return similarity(normalize_name(pred), normalize_name(gold)) >= NAME_MATCH_THRESHOLD
    if name == "ref":
        return re.sub(r"\s", "", pred).upper() == re.sub(r"\s", "", gold).upper()
    if name == "paid_at":
        return pred.replace(second=0, microsecond=0) == gold.replace(second=0, microsecond=0)
    return pred == gold  # amount (Decimal), bank


def ocr_recall(text: str, gold: SlipFields) -> dict[str, bool]:
    """ค่าจริงอยู่ในข้อความ OCR ไหม (เฉพาะ field ที่เช็คด้วย string ได้ตรง ๆ)"""
    t = re.sub(r"[\s,]", "", normalize_text(text)).upper()
    out: dict[str, bool] = {}
    if gold.amount is not None:
        out["amount"] = f"{gold.amount:.2f}" in t
    if gold.ref:
        out["ref"] = re.sub(r"\s", "", gold.ref).upper() in t
    if gold.receiver_name:
        # ใช้เกณฑ์ fuzzy เดียวกับ e2e ไม่งั้น recall จะต่ำกว่า e2e ได้ ซึ่งผิดตรรกะ
        g = normalize_name(gold.receiver_name)
        out["receiver_name"] = any(
            g in (n := normalize_name(ln)) or similarity(n, g) >= NAME_MATCH_THRESHOLD
            for ln in text.splitlines()
        )
    return out


@dataclass
class Tally:
    correct: int = 0
    total: int = 0

    @property
    def acc(self) -> float | None:
        return self.correct / self.total if self.total else None


@dataclass
class Report:
    # key: (bank, field) — bank "ALL" คือรวมทุกธนาคาร
    e2e: dict[tuple[str, str], Tally] = field(default_factory=lambda: defaultdict(Tally))
    recall: dict[tuple[str, str], Tally] = field(default_factory=lambda: defaultdict(Tally))
    errors: list[dict] = field(default_factory=list)

    def add(self, slip_id: str, bank: str, pred: SlipFields, gold: SlipFields, text: str) -> None:
        for f in FIELDS:
            g = getattr(gold, f)
            if g is None:
                continue  # สลิปไม่มี field นี้ -> ไม่นับในตัวหาร
            p = getattr(pred, f)
            ok = field_correct(f, p, g)
            for b in (bank, "ALL"):
                self.e2e[(b, f)].total += 1
                self.e2e[(b, f)].correct += ok
            if not ok:
                self.errors.append({"id": slip_id, "field": f, "pred": str(p), "gold": str(g)})
        for f, ok in ocr_recall(text, gold).items():
            for b in (bank, "ALL"):
                self.recall[(b, f)].total += 1
                self.recall[(b, f)].correct += ok


def _pct(t: Tally | None) -> str:
    return "–" if t is None or t.acc is None else f"{t.acc:.0%} ({t.correct}/{t.total})"


def markdown_table(report: Report, title: str) -> str:
    banks = sorted({b for b, _ in report.e2e if b != "ALL"}) + ["ALL"]
    head = "| bank | " + " | ".join(FIELDS) + " |"
    sep = "|" + "---|" * (len(FIELDS) + 1)
    rows = [f"| {b} | " + " | ".join(_pct(report.e2e.get((b, f))) for f in FIELDS) + " |" for b in banks]
    rec_fields = ("amount", "ref", "receiver_name")
    rec_head = "| bank | " + " | ".join(rec_fields) + " |"
    rec_sep = "|" + "---|" * (len(rec_fields) + 1)
    rec_rows = [
        f"| {b} | " + " | ".join(_pct(report.recall.get((b, f))) for f in rec_fields) + " |" for b in banks
    ]
    return "\n".join(
        [f"### {title}", "", "**End-to-end field accuracy**", "", head, sep, *rows, "",
         "**OCR recall (ค่าจริงปรากฏในข้อความ OCR)**", "", rec_head, rec_sep, *rec_rows, ""]
    )
