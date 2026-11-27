"""ถอด QR จากรูปสลิปเป็นข้อความ (ต้องติดตั้ง extra `qr` = opencv-python-headless)

แยกจาก parsing/qr.py เพราะ core ต้อง stdlib-only (CI ไม่ติดตั้ง opencv)
"""

from __future__ import annotations


def decode_qr(path: str) -> str | None:
    import cv2  # lazy: โหลดเฉพาะตอนใช้จริง

    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(path)
    det = cv2.QRCodeDetector()
    data, _, _ = det.detectAndDecode(img)
    if not data:
        # สลิปบางใบ QR เล็กเมื่อเทียบกับรูป: ขยาย 2 เท่าแล้วลองอีกรอบ
        big = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        data, _, _ = det.detectAndDecode(big)
    return data or None
