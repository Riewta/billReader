"""OCR engine registry

ทุก engine ต้องมีเมธอด `run(image_path) -> OCRResult` เหมือนกันหมด (adapter pattern)
ส่วนอื่นของระบบจะไม่รู้เลยว่าข้างหลังคือ Paddle หรือ Google -> สลับ engine ได้โดยไม่แก้ parser

import แบบ lazy (importlib) เพราะแต่ละ engine มี dependency หนักและติดตั้งยาก
ถ้าลองแค่ tesseract ก็ไม่ต้องลง paddle ด้วย
"""

from __future__ import annotations

import importlib
from typing import Protocol

from slipsense_ml.schema import OCRResult


class OCREngine(Protocol):
    name: str
    is_cloud: bool  # True = รูปถูกส่งออกนอกเครื่อง (สำคัญต่อ privacy)
    cost_per_1k_usd: float  # ประมาณการ ใช้ทำตารางเทียบค่าใช้จ่าย

    def run(self, image_path: str) -> OCRResult: ...


ENGINES = {
    "tesseract": "slipsense_ml.ocr.engines:TesseractEngine",
    "easyocr": "slipsense_ml.ocr.engines:EasyOCREngine",
    "paddle": "slipsense_ml.ocr.engines:PaddleEngine",
    "typhoon": "slipsense_ml.ocr.engines:TyphoonEngine",
    "gcv": "slipsense_ml.ocr.engines:GoogleVisionEngine",
}


def get_engine(name: str) -> OCREngine:
    if name not in ENGINES:
        raise KeyError(f"ไม่รู้จัก engine '{name}' (มี: {', '.join(ENGINES)})")
    mod, cls = ENGINES[name].split(":")
    return getattr(importlib.import_module(mod), cls)()
