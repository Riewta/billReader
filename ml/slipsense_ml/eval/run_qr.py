"""ถอด QR บนสลิปทุกใบแล้ว cache payload (ทำครั้งเดียว ใช้ร่วมกับทุก OCR engine)

    python -m slipsense_ml.eval.run_qr        # ต้องติดตั้ง extra: pip install -e "ml[qr]"

เขียน data/ocr_cache/_qr/<id>.json = {"payload": str|null, "latency_s": float}
QR ไม่ขึ้นกับ OCR engine จึงเก็บแยกโฟลเดอร์ แล้วให้ score จับคู่กับ OCR ของทุก engine ได้
รันบนเครื่อง ไม่ส่งรูปออกไปไหน จึงไม่ต้องดู cloud_ok
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from slipsense_ml.eval.dataset import load_labels
from slipsense_ml.ocr.qr_image import decode_qr
from slipsense_ml.parsing.qr import parse_slip_qr

QR_DIR = "_qr"  # ขึ้นต้นด้วย _ ไม่ให้ชนกับชื่อ engine


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", default="data/labels.jsonl")
    ap.add_argument("--images", default="data/raw")
    ap.add_argument("--cache", default="data/ocr_cache")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    out_dir = Path(args.cache) / QR_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    ok = none = invalid = 0
    for s in load_labels(args.labels):
        out = out_dir / f"{s.id}.json"
        if out.exists() and not args.force:
            continue
        t0 = time.perf_counter()
        payload = decode_qr(str(Path(args.images) / s.file))
        dt = time.perf_counter() - t0
        out.write_text(json.dumps({"payload": payload, "latency_s": dt}), encoding="utf-8")
        # นับแค่ว่าอ่านได้/CRC ผ่านไหม ไม่พิมพ์ payload (มี ref จริง) ออกหน้าจอ
        if payload is None:
            none += 1
        elif parse_slip_qr(payload) is None:
            invalid += 1
        else:
            ok += 1
    print(f"qr: valid={ok} no_qr={none} invalid/crc_fail={invalid}")


if __name__ == "__main__":
    main()
