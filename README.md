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
# venv อยู่นอก repo: repo อยู่บน Desktop ที่ iCloud sync ซึ่งจะซ่อนไฟล์ใน .venv/ จน Python 3.13 import ไม่ได้
python3 -m venv ~/.venvs/billreader && source ~/.venvs/billreader/bin/activate
pip install -e "ml[dev,tesseract,easyocr,qr]"  # เลือก extras ตาม engine ที่จะลอง (qr = ถอด QR บนสลิป)
brew install tesseract tesseract-lang           # ถ้าใช้ tesseract

# 1) ใส่รูปใน data/raw/ และเขียน data/labels.jsonl (ดู data/README.md)
# 2) รัน OCR ครั้งเดียว ผลถูก cache ไว้
python -m slipsense_ml.eval.run_ocr --engine tesseract
python -m slipsense_ml.eval.run_ocr --engine easyocr
python -m slipsense_ml.eval.run_qr                # ถอด QR: ได้ ref + ธนาคารแบบตรงตัว (CRC ตรวจแล้ว)
# 3) วน แก้ parser -> score ได้เร็ว ไม่ต้องรัน OCR ใหม่
python -m slipsense_ml.eval.score --engines tesseract easyocr
pytest -q
```

## ผลเทียบ OCR
ตัวเลขจาก test split ([results/benchmark_test.md](results/benchmark_test.md)) ซึ่งไม่เคยใช้ปรับ parser
**n=7 (KBank 6, SCB 1) ยังน้อยมาก**: 1 ใบ = 14% ใช้ดูทิศทาง ไม่ใช่ตัวเลขสุดท้าย · `+QR` = ref และธนาคารอ่านจาก QR บนสลิป

| engine | รันที่ | ค่าใช้จ่าย / 1k รูป | bank | amount | paid_at | receiver | ref | median latency |
|---|---|---|---|---|---|---|---|---|
| Tesseract | เครื่อง | ฟรี | 71% | 86% | 86% | 43% | 57% | 0.46s |
| Tesseract + QR | เครื่อง | ฟรี | 100% | 86% | 86% | 43% | 100% | 0.46s |
| EasyOCR | เครื่อง | ฟรี | 100% | 100% | 100% | 86% | 71% | 7.2s |
| EasyOCR + QR | เครื่อง | ฟรี | 100% | 100% | 100% | 86% | 100% | 7.2s |
| PaddleOCR | เครื่อง | ฟรี | | | | | | |
| Typhoon OCR | cloud/GPU | free tier | | | | | | |
| Google Vision | cloud | ~$1.5 (ฟรี 1k แรก/เดือน) | | | | | | |

## Privacy
สลิปจริงไม่เคยถูก commit · engine ที่เป็น cloud จะข้ามสลิปที่ `cloud_ok=false` · ดู [data/README.md](data/README.md)
