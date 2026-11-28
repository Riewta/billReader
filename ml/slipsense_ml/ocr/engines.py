"""Adapter ของแต่ละ OCR engine

หมายเหตุ: API ของไลบรารี OCR เปลี่ยนบ่อย (โดยเฉพาะ PaddleOCR 2.x -> 3.x และ typhoon-ocr)
ถ้ารันแล้ว error ให้เช็ค docs เวอร์ชันที่ติดตั้งจริง แก้แค่ในไฟล์นี้ ส่วนอื่นไม่ต้องแตะ
cost_per_1k_usd เป็นตัวเลขประมาณการ ณ ตอนเขียน — ตรวจราคาล่าสุดก่อนใส่ README
"""

from __future__ import annotations

import os
import time

from slipsense_ml.schema import OCRResult


def _result(engine: str, lines: list[str], t0: float) -> OCRResult:
    lines = [ln.strip() for ln in lines if ln and ln.strip()]
    return OCRResult(engine=engine, text="\n".join(lines), lines=lines, latency_s=time.perf_counter() - t0)


class TesseractEngine:
    """Baseline ฟรี/เก่า — ต้องลง binary: `brew install tesseract tesseract-lang`
    ไว้เป็น "พื้น" ให้รู้ว่า engine อื่นดีกว่าแค่ไหน"""

    name, is_cloud, cost_per_1k_usd = "tesseract", False, 0.0

    def __init__(self) -> None:
        import pytesseract  # noqa: F401

    def run(self, image_path: str) -> OCRResult:
        import pytesseract
        from PIL import Image

        t0 = time.perf_counter()
        text = pytesseract.image_to_string(Image.open(image_path), lang="tha+eng")
        return _result(self.name, text.splitlines(), t0)


class EasyOCREngine:
    """โมเดล deep learning รันในเครื่อง รองรับไทย ใช้ง่ายสุด แต่ช้าถ้าไม่มี GPU"""

    name, is_cloud, cost_per_1k_usd = "easyocr", False, 0.0

    def __init__(self) -> None:
        import easyocr

        self.reader = easyocr.Reader(["th", "en"], gpu=False)

    def run(self, image_path: str) -> OCRResult:
        t0 = time.perf_counter()
        # r = (box 4 มุม, text, conf) -> ใช้มุมซ้ายบน (x, y) จัดเรียงเป็นบรรทัด
        res = self.reader.readtext(image_path, detail=1, paragraph=False)
        return _result(self.name, _group_by_row([(r[0][0][1], r[0][0][0], r[1]) for r in res]), t0)


class PaddleEngine:
    """PaddleOCR 3.x (PP-OCRv5) โมเดลอ่านไทย th_PP-OCRv5_mobile_rec
    paddlepaddle 3.1+ มี wheel สำหรับ Python 3.13 แล้ว แต่ให้ลงใน venv แยก (dependency ชนกับ torch ของ EasyOCR ได้)

    ตัวหากรอบข้อความ (detection) ค่าเริ่มต้นคือ PP-OCRv5_server_det: ทำมาสำหรับ GPU
    บน CPU ของ Mac ช้า ~35 วิ/ใบ จึงมีอีกตัว PaddleMobileEngine ไว้เทียบ
    """

    name, is_cloud, cost_per_1k_usd = "paddle", False, 0.0
    det_model = "PP-OCRv5_server_det"
    rec_model = "th_PP-OCRv5_mobile_rec"

    def __init__(self) -> None:
        from paddleocr import PaddleOCR

        # ระบุชื่อโมเดลทั้งสองตัวเสมอ ไม่พึ่ง lang="th":
        # ถ้าส่งชื่อโมเดลตัวใดตัวหนึ่ง PaddleOCR จะไม่สน lang แล้วใช้โมเดลอ่านจีน/อังกฤษเป็นค่าเริ่มต้นแบบเงียบ ๆ
        # ผลคืออักษรไทยออกมาเป็นอักษรละตินหน้าตาคล้าย (โอนเงิน -> "laulu", บาท -> "unn") ส่วนตัวเลขยังถูก
        # (เจอจริงตอน benchmark: recall ยอดเงิน 100% แต่ parse ได้ 8%)
        self.ocr = PaddleOCR(
            text_detection_model_name=self.det_model,
            text_recognition_model_name=self.rec_model,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,  # สลิปเป็น screenshot ตรงอยู่แล้ว ปิดไว้เร็วขึ้น
            use_textline_orientation=False,
        )

    def run(self, image_path: str) -> OCRResult:
        t0 = time.perf_counter()
        items: list[tuple[float, float, str]] = []
        for page in self.ocr.predict(image_path):
            for text, box in zip(page["rec_texts"], page["rec_boxes"]):
                items.append((float(box[1]), float(box[0]), text))
        return _result(self.name, _group_by_row(items), t0)


class PaddleMobileEngine(PaddleEngine):
    """PaddleOCR ที่ใช้ตัวหากรอบรุ่น mobile: เร็วกว่า server ~5 เท่าบน CPU (~7 วิ/ใบ) แลกกับความแม่นที่ต้องวัด"""

    name = "paddle_mobile"
    det_model = "PP-OCRv5_mobile_det"


class TyphoonEngine:
    """Typhoon OCR (SCB 10X) — vision-language model ที่เทรนกับเอกสารไทยโดยเฉพาะ
    ใช้ผ่าน API (ต้องมี TYPHOON_OCR_API_KEY) หรือรันโมเดลเองด้วย vLLM ถ้ามี GPU
    ผลเป็น markdown ไม่มี bounding box"""

    name, is_cloud, cost_per_1k_usd = "typhoon", True, 0.0  # มี free tier; ตรวจ rate limit

    def __init__(self) -> None:
        if not os.getenv("TYPHOON_OCR_API_KEY"):
            raise RuntimeError("ตั้ง TYPHOON_OCR_API_KEY ก่อน (สมัครที่ opentyphoon.ai)")

    def run(self, image_path: str) -> OCRResult:
        from typhoon_ocr import ocr_document

        t0 = time.perf_counter()
        md = ocr_document(image_path)
        return _result(self.name, md.splitlines(), t0)


class GoogleVisionEngine:
    """Google Cloud Vision DOCUMENT_TEXT_DETECTION — มักแม่นสุดกับไทย ฟรี 1,000 รูป/เดือน
    ต้องตั้ง GOOGLE_APPLICATION_CREDENTIALS ชี้ไปที่ service account key"""

    name, is_cloud, cost_per_1k_usd = "gcv", True, 1.5

    def __init__(self) -> None:
        from google.cloud import vision

        self.vision = vision
        self.client = vision.ImageAnnotatorClient()

    def run(self, image_path: str) -> OCRResult:
        t0 = time.perf_counter()
        with open(image_path, "rb") as f:
            image = self.vision.Image(content=f.read())
        resp = self.client.document_text_detection(
            image=image, image_context={"language_hints": ["th", "en"]}
        )
        if resp.error.message:
            raise RuntimeError(resp.error.message)
        return _result(self.name, resp.full_text_annotation.text.splitlines(), t0)


def _group_by_row(items: list[tuple[float, float, str]], tol: float = 12.0) -> list[str]:
    """รวมกล่องข้อความที่อยู่ "แถวเดียวกัน" (y ใกล้กัน) เป็นบรรทัดเดียว เรียงซ้าย -> ขวา

    สำคัญมากสำหรับสลิป: label กับค่ามักอยู่คนละฝั่งของบรรทัด เช่น
    "จำนวนเงิน ........ 150.00 บาท" ถ้าไม่รวมแถว parser จะจับคู่ label-ค่าไม่ได้
    """
    rows: list[list[tuple[float, float, str]]] = []
    for it in sorted(items):
        if rows and abs(rows[-1][0][0] - it[0]) <= tol:
            rows[-1].append(it)
        else:
            rows.append([it])
    return [" ".join(t for _, _, t in sorted(r, key=lambda x: x[1])) for r in rows]
