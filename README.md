# SlipSense — จดรายจ่ายอัตโนมัติจากสลิปโอนเงิน

> อัปโหลดสลิป → อ่านยอด/วันเวลา/ผู้รับ/ธนาคาร → จัดหมวด → dashboard รายจ่าย
> สถานะ: **Phase 1 — เทียบ OCR + parser baseline**

## โครงสร้าง repo
```
ml/slipsense_ml/      แพ็กเกจ Python กลาง (Phase 2 API จะ import ตัวนี้)
  schema.py           SlipFields / OCRResult: สัญญาข้อมูลระหว่างทุกชั้น
  ocr/                adapter ของแต่ละ engine (สลับได้โดยไม่แตะ parser)
  parsing/            normalize ข้อความไทย + parser (generic + template ต่อธนาคาร)
  eval/               dataset loader, metrics, run_ocr (ขั้น 1), score (ขั้น 2)
tests/                unit tests (parser/normalize/metrics) — รันใน CI
data/                 README ของวิธีเก็บ/label สลิป (สลิปจริงถูก gitignore)
results/              ผล benchmark (commit ได้ เพราะเป็นตัวเลขรวม)
notebooks/            วิเคราะห์ผล/ทดลองโมเดล
api/  web/            Phase 2
```

## Phase 1: วิธีรัน benchmark
```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e "ml[dev,tesseract,easyocr]"     # เลือก extras ตาม engine ที่จะลอง
brew install tesseract tesseract-lang           # ถ้าใช้ tesseract

# 1) ใส่รูปใน data/raw/ และเขียน data/labels.jsonl (ดู data/README.md)
# 2) รัน OCR ครั้งเดียว ผลถูก cache ไว้
python -m slipsense_ml.eval.run_ocr --engine tesseract
python -m slipsense_ml.eval.run_ocr --engine easyocr
# 3) วน แก้ parser -> score ได้เร็ว ไม่ต้องรัน OCR ใหม่
python -m slipsense_ml.eval.score --engines tesseract easyocr
pytest -q
```

## ผลเทียบ OCR
_(ยังไม่มี — จะใส่ตารางจาก results/benchmark.md หลังเก็บสลิปชุดแรก)_

| engine | รันที่ | ค่าใช้จ่าย / 1k รูป | amount | paid_at | receiver | ref | median latency |
|---|---|---|---|---|---|---|---|
| Tesseract | เครื่อง | ฟรี | | | | | |
| EasyOCR | เครื่อง | ฟรี | | | | | |
| PaddleOCR | เครื่อง | ฟรี | | | | | |
| Typhoon OCR | cloud/GPU | free tier | | | | | |
| Google Vision | cloud | ~$1.5 (ฟรี 1k แรก/เดือน) | | | | | |

## Privacy
สลิปจริงไม่เคยถูก commit · engine ที่เป็น cloud จะข้ามสลิปที่ `cloud_ok=false` · ดู [data/README.md](data/README.md)
