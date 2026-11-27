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

export const FIELD_LABELS: Record<FieldName, string> = {
  bank: "ธนาคาร",
  amount: "ยอดเงิน",
  paid_at: "วันเวลา",
  receiver_name: "ผู้รับ",
  ref: "เลขอ้างอิง",
};

export const BANK_LABELS: Record<Bank, string> = {
  kbank: "กสิกรไทย",
  scb: "ไทยพาณิชย์",
  ktb: "กรุงไทย",
  bbl: "กรุงเทพ",
  krungsri: "กรุงศรี",
  ttb: "ttb",
  gsb: "ออมสิน",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  food: "อาหาร",
  transport: "เดินทาง",
  shopping: "ช้อปปิ้ง",
  bills: "บิล",
  transfer: "โอนให้คน",
  other: "อื่น ๆ",
};

export const STATUS_LABELS: Record<SlipStatus, string> = {
  processing: "กำลังอ่าน…",
  ready: "อ่านแล้ว",
  needs_review: "ต้องตรวจ",
  duplicate: "ซ้ำ ข้ามให้",
  unreadable: "อ่านไม่ได้",
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
