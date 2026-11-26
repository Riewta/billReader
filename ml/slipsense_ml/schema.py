"""โครงสร้างข้อมูลกลางที่ทุกชั้น (OCR -> parser -> eval -> API) ใช้ร่วมกัน"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

# รหัสธนาคารที่ใช้ทั้งระบบ (ใช้ code สั้น ๆ แทนชื่อเต็ม จะได้ไม่ต้องสะกดซ้ำ)
BANKS = ("kbank", "scb", "ktb", "bbl", "krungsri", "ttb", "gsb")

FIELDS = ("bank", "amount", "paid_at", "receiver_name", "ref")


@dataclass
class SlipFields:
    """ผลลัพธ์ของ parser — ทุก field เป็น Optional เพราะ OCR อาจอ่านไม่ได้"""

    bank: str | None = None  # ธนาคารที่ออกสลิป (ฝั่งผู้โอน)
    amount: Decimal | None = None  # ใช้ Decimal ไม่ใช่ float: เงินห้ามมี error ทศนิยม
    paid_at: datetime | None = None  # ค.ศ. ความละเอียดระดับนาที
    receiver_name: str | None = None
    ref: str | None = None  # เลขอ้างอิง ใช้กันสลิปซ้ำ


@dataclass
class OCRResult:
    """ผลดิบจาก OCR engine ใด ๆ — แปลงให้อยู่รูปเดียวกันก่อนส่งให้ parser"""

    engine: str
    text: str  # ข้อความทั้งหมด เรียงบรรทัดบน -> ล่าง
    lines: list[str] = field(default_factory=list)
    latency_s: float = 0.0
