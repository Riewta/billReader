"""โหลด labels.jsonl -> (meta, SlipFields) ที่พร้อมเทียบกับผล parser"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from slipsense_ml.schema import SlipFields


@dataclass
class LabeledSlip:
    id: str
    file: str
    gold: SlipFields
    kind: str | None = None
    cloud_ok: bool = True
    split: str = "dev"  # dev = ไว้ดู error/ปรับ parser, test = ห้ามเปิดดู ใช้วัดผลตอนจบเท่านั้น


SPLITS = ("dev", "test")


def load_labels(path: str | Path, split: str | None = None) -> list[LabeledSlip]:
    """split=None คืนทุกใบ; "dev"/"test" กรองเฉพาะชุดนั้น"""
    out: list[LabeledSlip] = []
    for i, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        r = json.loads(line)
        try:
            gold = SlipFields(
                bank=r.get("bank"),
                amount=Decimal(r["amount"]) if r.get("amount") else None,
                paid_at=datetime.fromisoformat(r["paid_at"]) if r.get("paid_at") else None,
                receiver_name=r.get("receiver_name"),
                ref=r.get("ref"),
            )
        except Exception as e:  # label พังให้รู้ทันทีว่าบรรทัดไหน
            raise ValueError(f"{path}:{i} label ไม่ถูกต้อง: {e}") from e
        out.append(
            LabeledSlip(
                id=r["id"], file=r["file"], gold=gold,
                kind=r.get("kind"), cloud_ok=r.get("cloud_ok", True),
                split=r.get("split", "dev"),
            )
        )
    return [s for s in out if split is None or s.split == split]
