"""ตรวจ labels.jsonl ก่อนใช้งาน + แบ่ง dev/test ให้อัตโนมัติ

    python -m slipsense_ml.eval.validate_labels                  # ตรวจอย่างเดียว
    python -m slipsense_ml.eval.validate_labels --assign-splits  # ใส่ split ให้ใบที่ยังไม่มี

ทำไมต้องมี: label ผิด = ตัวเลขความแม่นผิด โดยไม่มีใครรู้ตัว
เช่น พิมพ์ปี พ.ศ. (2568) แทน ค.ศ. -> parser ถูกแต่ถูกนับว่าผิดทุกใบ
หรือพิมพ์ key ผิด ("ammount") -> field นั้นกลายเป็น null แล้วหายไปจากตัวหารเงียบ ๆ
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from slipsense_ml.eval.dataset import SPLITS
from slipsense_ml.schema import BANKS

KINDS = ("transfer", "promptpay", "qr_merchant", "bill")
KNOWN_KEYS = {"id", "file", "bank", "amount", "paid_at", "receiver_name", "ref", "kind", "cloud_ok", "split"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".heic", ".webp"}
TEST_RATIO = 1 / 3
MIN_YEAR = 2015

_AMOUNT = re.compile(r"^\d+\.\d{2}$")
_PAID_AT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$")
_REF = re.compile(r"^[A-Za-z0-9]{8,}$")


@dataclass
class Issues:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def read_records(path: Path) -> list[tuple[int, dict | str]]:
    """คืน (เลขบรรทัด, dict) หรือ (เลขบรรทัด, ข้อความ error) ถ้า JSON พัง — ไม่หยุดที่บรรทัดแรกที่พัง"""
    out: list[tuple[int, dict | str]] = []
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            r = json.loads(line)
            out.append((i, r if isinstance(r, dict) else f"ต้องเป็น object ไม่ใช่ {type(r).__name__}"))
        except json.JSONDecodeError as e:
            out.append((i, f"JSON ไม่ถูกต้อง: {e.msg}"))
    return out


def validate(records: list[tuple[int, dict | str]], images_dir: Path | None = None) -> Issues:
    iss = Issues()
    err = lambda ln, msg: iss.errors.append(f"บรรทัด {ln}: {msg}")  # noqa: E731
    warn = lambda ln, msg: iss.warnings.append(f"บรรทัด {ln}: {msg}")  # noqa: E731
    seen_ids: dict[str, int] = {}
    seen_files: dict[str, int] = {}
    max_year = datetime.now().year + 1

    for ln, r in records:
        if isinstance(r, str):
            err(ln, r)
            continue

        for k in r.keys() - KNOWN_KEYS:
            warn(ln, f"key ที่ไม่รู้จัก '{k}' (พิมพ์ผิดหรือเปล่า?) — field นี้จะถูกเมิน")
        for k in ("id", "file", "bank"):
            if not r.get(k):
                err(ln, f"ต้องมี '{k}'")

        if (sid := r.get("id")) is not None:
            if sid in seen_ids:
                err(ln, f"id '{sid}' ซ้ำกับบรรทัด {seen_ids[sid]}")
            seen_ids.setdefault(sid, ln)
        if (f := r.get("file")) is not None:
            if f in seen_files:
                err(ln, f"file '{f}' ซ้ำกับบรรทัด {seen_files[f]}")
            seen_files.setdefault(f, ln)
            if images_dir is not None and not (images_dir / f).is_file():
                err(ln, f"ไม่พบรูป {images_dir / f}")

        if r.get("bank") and r["bank"] not in BANKS:
            err(ln, f"bank '{r['bank']}' ไม่อยู่ใน {BANKS}")

        amt = r.get("amount")
        if amt is not None:
            if not isinstance(amt, str):
                # ตัวเลขใน JSON จะถูกอ่านเป็น float -> 0.1+0.2 ปัญหาเดิม; บังคับเป็น string
                err(ln, f"amount ต้องเป็น string เช่น \"150.00\" ไม่ใช่ {amt!r}")
            elif not _AMOUNT.match(amt):
                err(ln, f"amount '{amt}' ต้องเป็นรูป 1250.00 (ไม่มีลูกน้ำ ทศนิยม 2 ตำแหน่ง)")

        pa = r.get("paid_at")
        if pa is not None:
            if not isinstance(pa, str) or not _PAID_AT.match(pa):
                err(ln, f"paid_at '{pa}' ต้องเป็นรูป YYYY-MM-DDTHH:MM")
            else:
                try:
                    year = datetime.fromisoformat(pa).year
                    if year > max_year:
                        err(ln, f"paid_at ปี {year} — น่าจะเป็น พ.ศ. ให้ลบ 543 (= {year - 543})")
                    elif year < MIN_YEAR:
                        err(ln, f"paid_at ปี {year} เก่าผิดปกติ")
                except ValueError:
                    err(ln, f"paid_at '{pa}' ไม่ใช่วันที่จริง")

        name = r.get("receiver_name")
        if name is not None and (not isinstance(name, str) or not name.strip()):
            err(ln, "receiver_name ต้องเป็นข้อความหรือ null (ไม่ใช่ string ว่าง)")

        ref = r.get("ref")
        if ref is not None and (not isinstance(ref, str) or not _REF.match(ref)):
            err(ln, f"ref '{ref}' ต้องเป็นตัวอักษร/ตัวเลขติดกัน ≥ 8 ตัว ไม่มีช่องว่าง")

        kind = r.get("kind")
        if kind is None:
            warn(ln, "ไม่มี kind — จะวิเคราะห์ว่า parser พังกับสลิปประเภทไหนไม่ได้")
        elif kind not in KINDS:
            err(ln, f"kind '{kind}' ไม่อยู่ใน {KINDS}")

        if "cloud_ok" in r and not isinstance(r["cloud_ok"], bool):
            err(ln, "cloud_ok ต้องเป็น true/false")

        sp = r.get("split")
        if sp is None:
            warn(ln, "ไม่มี split (จะถือเป็น dev) — รันด้วย --assign-splits")
        elif sp not in SPLITS:
            err(ln, f"split '{sp}' ต้องเป็น {SPLITS}")

    if images_dir is not None and images_dir.is_dir():
        labeled = set(seen_files)
        for p in sorted(images_dir.iterdir()):
            if p.suffix.lower() in IMAGE_EXT and p.name not in labeled:
                iss.warnings.append(f"รูป {p.name} ยังไม่มี label")
    return iss


def _stable_key(slip_id: str) -> str:
    # hash แทน random: รันกี่ครั้งก็ได้ผลเดิม และเพิ่มสลิปใหม่ทีหลังก็ไม่ทำให้ใบเก่าย้าย split
    return hashlib.sha1(slip_id.encode()).hexdigest()


def assign_splits(records: list[dict], test_ratio: float = TEST_RATIO) -> int:
    """ใส่ split ให้ใบที่ยังไม่มี แบ่งแยกตามธนาคาร (stratified) ให้แต่ละธนาคารมี test ~1/3

    ใบที่มี split อยู่แล้วไม่แตะ — โดยเฉพาะ test ห้ามย้ายกลับมา dev เด็ดขาด
    (เพราะถ้าเคยเห็นแล้วเอามาปรับ parser ก็ไม่ใช่ข้อสอบที่ไม่เคยเห็นอีกต่อไป)
    คืนจำนวนใบที่ถูกใส่ split
    """
    by_bank: dict[str, list[dict]] = {}
    for r in records:
        by_bank.setdefault(r.get("bank") or "unknown", []).append(r)
    changed = 0
    for rows in by_bank.values():
        have_test = sum(r.get("split") == "test" for r in rows)
        need_test = max(0, round(len(rows) * test_ratio) - have_test)
        todo = sorted((r for r in rows if r.get("split") is None), key=lambda r: _stable_key(r.get("id", "")))
        for i, r in enumerate(todo):
            r["split"] = "test" if i < need_test else "dev"
            changed += 1
    return changed


def summary(records: list[dict]) -> str:
    c = Counter((r.get("bank"), r.get("split", "dev")) for r in records)
    kinds = Counter(r.get("kind") for r in records)
    banks = sorted({b for b, _ in c if b})
    lines = ["| bank | dev | test | รวม |", "|---|---|---|---|"]
    for b in banks:
        d, t = c[(b, "dev")], c[(b, "test")]
        lines.append(f"| {b} | {d} | {t} | {d + t} |")
    lines.append("")
    lines.append("kind: " + ", ".join(f"{k or 'ไม่ระบุ'}={n}" for k, n in kinds.most_common()))
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", default="data/labels.jsonl")
    ap.add_argument("--images", default="data/raw")
    ap.add_argument("--assign-splits", action="store_true", help="ใส่ split ให้ใบที่ยังไม่มี (สำรองไฟล์เดิมเป็น .bak)")
    args = ap.parse_args()

    path = Path(args.labels)
    records = read_records(path)
    iss = validate(records, Path(args.images))
    for w in iss.warnings:
        print(f"[warn]  {w}")
    for e in iss.errors:
        print(f"[error] {e}")

    if args.assign_splits:
        if iss.errors:
            sys.exit("แก้ error ก่อนแล้วค่อย --assign-splits")
        rows = [r for _, r in records]
        n = assign_splits(rows)
        if n:
            shutil.copy(path, path.with_suffix(path.suffix + ".bak"))
            path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        print(f"ใส่ split ให้ {n} ใบ")

    good = [r for _, r in records if isinstance(r, dict)]
    print()
    print(summary(good))
    print(f"\n{len(good)} ใบ · error {len(iss.errors)} · warning {len(iss.warnings)}")
    sys.exit(1 if iss.errors else 0)


if __name__ == "__main__":
    main()
