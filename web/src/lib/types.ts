// สัญญาข้อมูลฝั่งเว็บ: ล้อตาม SlipFields ใน ml/slipsense_ml/schema.py
// แต่เพิ่มสิ่งที่ UI ต้องใช้และ parser ยังไม่มี: ความมั่นใจราย field + แหล่งที่มา (QR/OCR)
// เมื่อ API (Phase 2) พร้อม ไฟล์นี้คือสิ่งที่ต้องคุยให้ตรงกับ response ของ API

export type Bank = "kbank" | "scb" | "ktb" | "bbl" | "krungsri" | "ttb" | "gsb";

export type FieldName = "bank" | "amount" | "paid_at" | "receiver_name" | "ref";

export type FieldValue = {
  value: string | null;
  // confident = ไม่ต้องให้ผู้ใช้ดู; ยังไม่มีใน parser — ตอนนี้ mock ไว้
  confident: boolean;
  // qr = ถอดจาก QR และผ่าน CRC (เชื่อถือได้สุด), ocr = อ่านจากตัวอักษร
  source: "qr" | "ocr";
};

export type SlipStatus = "processing" | "ready" | "needs_review" | "duplicate" | "unreadable";

export type Category = "food" | "transport" | "shopping" | "bills" | "transfer" | "other";

export type Slip = {
  id: string;
  fileName: string;
  status: SlipStatus;
  fields: Record<FieldName, FieldValue>;
  category: Category;
};





// รายการที่ยืนยันแล้ว = สิ่งที่ dashboard ใช้คำนวณ (หลังยืนยัน รูปสลิปถูกทิ้ง เหลือแค่ข้อมูลนี้)
export type Transaction = {
  id: string;
  paidAt: string; // ISO, เวลาไทย
  amount: number;
  receiver: string;
  bank: Bank;
  category: Category;
  ref: string | null;
};
