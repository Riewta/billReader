"""ขั้นที่ 2: อ่าน OCR cache -> parse -> เทียบ label -> ตาราง markdown

    python -m slipsense_ml.eval.score --engines tesseract easyocr paddle

เขียนผลไปที่ results/benchmark.md (ตาราง) และ results/errors_<engine>.jsonl
(รายการที่ผิด ไว้เปิดดูว่าพังเพราะอะไร — ส่วนนี้คือที่ที่เรียนรู้ได้มากที่สุด)
"""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

from slipsense_ml.eval.dataset import load_labels
from slipsense_ml.eval.metrics import Report, markdown_table
from slipsense_ml.ocr import ENGINES
from slipsense_ml.parsing.parser import parse_slip


def score_engine(engine: str, labels_path: str, cache_dir: str) -> tuple[Report, list[float]]:
    report, latencies = Report(), []
    for s in load_labels(labels_path):
        f = Path(cache_dir) / engine / f"{s.id}.json"
        if not f.exists():
            continue  # ไม่ได้รัน (เช่น cloud_ok=false) -> ไม่นับ; ดู n ในตารางประกอบเสมอ
        ocr = json.loads(f.read_text(encoding="utf-8"))
        latencies.append(ocr["latency_s"])
        pred = parse_slip(ocr["text"])
        report.add(s.id, s.gold.bank or "unknown", pred, s.gold, ocr["text"])
    return report, latencies


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engines", nargs="+", default=list(ENGINES))
    ap.add_argument("--labels", default="data/labels.jsonl")
    ap.add_argument("--cache", default="data/ocr_cache")
    ap.add_argument("--out", default="results")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(exist_ok=True)
    sections = ["# OCR benchmark", ""]
    for eng in args.engines:
        report, lat = score_engine(eng, args.labels, args.cache)
        if not lat:
            print(f"ข้าม {eng}: ไม่มี cache (รัน run_ocr ก่อน)")
            continue
        sections.append(markdown_table(report, f"{eng} — n={len(lat)}, median latency {statistics.median(lat):.2f}s"))
        with open(out / f"errors_{eng}.jsonl", "w", encoding="utf-8") as fh:
            for e in report.errors:
                fh.write(json.dumps(e, ensure_ascii=False) + "\n")
    md = "\n".join(sections)
    (out / "benchmark.md").write_text(md, encoding="utf-8")
    print(md)


if __name__ == "__main__":
    main()
