"""ขั้นที่ 1: รัน OCR แล้ว cache ผลดิบลงดิสก์

    python -m slipsense_ml.eval.run_ocr --engine tesseract

ทำไมแยกจากขั้น score: OCR ช้า (และ cloud เสียเงิน) แต่ parser จะถูกแก้เป็นร้อยรอบ
cache ไว้ครั้งเดียว แล้ววน "แก้ parser -> score" ได้ในไม่กี่วินาที
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from slipsense_ml.eval.dataset import load_labels
from slipsense_ml.ocr import get_engine


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", required=True)
    ap.add_argument("--labels", default="data/labels.jsonl")
    ap.add_argument("--images", default="data/raw")
    ap.add_argument("--cache", default="data/ocr_cache")
    ap.add_argument("--force", action="store_true", help="รันใหม่แม้มี cache แล้ว")
    args = ap.parse_args()

    engine = get_engine(args.engine)
    out_dir = Path(args.cache) / engine.name
    out_dir.mkdir(parents=True, exist_ok=True)

    slips = load_labels(args.labels)
    done = skipped = failed = 0
    for s in slips:
        out = out_dir / f"{s.id}.json"
        if out.exists() and not args.force:
            continue
        if engine.is_cloud and not s.cloud_ok:
            skipped += 1  # เจ้าของสลิปไม่ยินยอมให้ส่งรูปออกนอกเครื่อง
            continue
        try:
            res = engine.run(str(Path(args.images) / s.file))
        except Exception as e:
            failed += 1
            print(f"[fail] {s.id}: {e}")
            continue
        out.write_text(json.dumps(asdict(res), ensure_ascii=False, indent=1), encoding="utf-8")
        done += 1
        print(f"[ok] {s.id} {res.latency_s:.2f}s")
    print(f"{engine.name}: ok={done} skipped(cloud_ok=false)={skipped} failed={failed}")


if __name__ == "__main__":
    main()
