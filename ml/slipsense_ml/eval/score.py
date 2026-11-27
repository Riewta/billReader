"""ขั้นที่ 2: อ่าน OCR cache -> parse -> เทียบ label -> ตาราง markdown

    python -m slipsense_ml.eval.score --engines tesseract easyocr paddle          # dev (ค่าเริ่มต้น)
    python -m slipsense_ml.eval.score --engines paddle --split test               # วัดผลจริงตอนจบเท่านั้น

ถ้ารัน run_qr ไว้แล้ว จะได้ตาราง 2 แบบต่อ engine: OCR อย่างเดียว และ OCR+QR (ref/ธนาคารจาก QR)
เทียบกันเพื่อดูว่า QR ช่วยได้แค่ไหน และ OCR อย่างเดียวพอไหมเวลาสลิปไม่มี QR/ถูกครอป

เขียนผลไปที่ results/benchmark_<split>.md (ตาราง) และ results/errors_<engine>.jsonl
(เฉพาะ dev: รายการที่ผิด ไว้เปิดดูว่าพังเพราะอะไร — ส่วนนี้คือที่ที่เรียนรู้ได้มากที่สุด)
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

from slipsense_ml.eval.dataset import load_labels
from slipsense_ml.eval.metrics import Report, markdown_table
from slipsense_ml.eval.run_qr import QR_DIR
from slipsense_ml.ocr import ENGINES
from slipsense_ml.parsing.parser import parse_slip_detailed


def _qr_payload(cache_dir: str, slip_id: str) -> str | None:
    f = Path(cache_dir) / QR_DIR / f"{slip_id}.json"
    return json.loads(f.read_text(encoding="utf-8"))["payload"] if f.exists() else None


def has_qr_cache(cache_dir: str) -> bool:
    d = Path(cache_dir) / QR_DIR
    return d.is_dir() and any(d.glob("*.json"))


def score_engine(
    engine: str, labels_path: str, cache_dir: str, split: str | None = "dev", use_qr: bool = False,
) -> tuple[Report, list[float]]:
    report, latencies = Report(), []
    for s in load_labels(labels_path, split=split):
        f = Path(cache_dir) / engine / f"{s.id}.json"
        if not f.exists():
            continue  # ไม่ได้รัน (เช่น cloud_ok=false) -> ไม่นับ; ดู n ในตารางประกอบเสมอ
        ocr = json.loads(f.read_text(encoding="utf-8"))
        latencies.append(ocr["latency_s"])
        pred = parse_slip_detailed(ocr["text"], _qr_payload(cache_dir, s.id) if use_qr else None)
        report.add(s.id, s.gold.bank or "unknown", pred.fields, s.gold, ocr["text"], pred.confident)
    return report, latencies


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engines", nargs="+", default=list(ENGINES))
    ap.add_argument("--labels", default="data/labels.jsonl")
    ap.add_argument("--cache", default="data/ocr_cache")
    ap.add_argument("--out", default="results")
    # ค่าเริ่มต้น dev: กันเผลอเปิดดู test ระหว่างปรับ parser (ถ้าเห็น test แล้วแก้ตาม ตัวเลขจะสูงเกินจริง)
    ap.add_argument("--split", choices=["dev", "test", "all"], default="dev")
    args = ap.parse_args()
    split = None if args.split == "all" else args.split

    unassigned = [s.id for s in load_labels(args.labels) if s.split is None]
    if unassigned:
        # ไม่ให้ score จนกว่าจะแบ่งครบ: ถ้าเปิดดู error ก่อนแบ่ง ใบที่เห็นแล้วอาจถูกสุ่มไปอยู่ test
        sys.exit(
            f"มี {len(unassigned)} ใบที่ยังไม่มี split (เช่น {', '.join(unassigned[:3])})\n"
            "รัน: python -m slipsense_ml.eval.validate_labels --assign-splits"
        )

    out = Path(args.out)
    out.mkdir(exist_ok=True)
    sections = [f"# OCR benchmark — split: {args.split}", ""]
    variants = [False, True] if has_qr_cache(args.cache) else [False]
    for eng in args.engines:
        for use_qr in variants:
            name = f"{eng}+qr" if use_qr else eng
            report, lat = score_engine(eng, args.labels, args.cache, split, use_qr)
            if not lat:
                print(f"ข้าม {eng}: ไม่มี cache (รัน run_ocr ก่อน)")
                break
            sections.append(markdown_table(report, f"{name} — n={len(lat)}, median latency {statistics.median(lat):.2f}s"))
            if args.split != "dev":
                continue  # ไม่เขียนรายการผิดของ test (รวมถึง all): ถ้าเปิดดูแล้วแก้ parser ตาม test ก็ไม่ใช่ test แล้ว
            with open(out / f"errors_{name}.jsonl", "w", encoding="utf-8") as fh:
                for e in report.errors:
                    fh.write(json.dumps(e, ensure_ascii=False) + "\n")
    md = "\n".join(sections)
    (out / f"benchmark_{args.split}.md").write_text(md, encoding="utf-8")
    print(md)


if __name__ == "__main__":
    main()
