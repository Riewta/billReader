// ข้อมูลปลอมทั้งหมด (ชื่อ/เลขอ้างอิงสมมติ) — ห้ามใส่ข้อมูลจากสลิปจริงในไฟล์นี้ เพราะถูก commit
// รูปแบบค่าจำลองจากที่เจอใน benchmark: ref/ธนาคารมาจาก QR, ผู้รับเป็น field ที่พลาดบ่อยสุด

import type { Category, FieldValue, Slip } from "./types";

const qr = (value: string): FieldValue => ({ value, confident: true, source: "qr" });
const ok = (value: string): FieldValue => ({ value, confident: true, source: "ocr" });
const unsure = (value: string | null): FieldValue => ({ value, confident: false, source: "ocr" });

export const MOCK_SLIPS: Slip[] = [
  {
    id: "s1", fileName: "IMG_0412.jpg", status: "ready", category: "food",
    fields: {
      bank: qr("kbank"), amount: ok("129.50"), paid_at: ok("2026-01-03T09:15"),
      receiver_name: ok("บริษัท ร้านสะดวกซื้อทดสอบ จำกัด"), ref: qr("015999091500AQR00001"),
    },
  },
  {
    id: "s2", fileName: "IMG_0413.jpg", status: "ready", category: "transport",
    fields: {
      bank: qr("kbank"), amount: ok("22.00"), paid_at: ok("2026-01-03T18:40"),
      receiver_name: ok("องค์การขนส่งทดสอบ"), ref: qr("015999184000BPM00002"),
    },
  },
  {
    id: "s3", fileName: "IMG_0414.jpg", status: "needs_review", category: "food",
    fields: {
      bank: qr("kbank"), amount: ok("85.00"), paid_at: ok("2026-01-04T12:07"),
      receiver_name: unsure("ร้านกาแฟทดสอบ สาขา 1"), ref: qr("015999120700BPP00003"),
    },
  },
  {
    id: "s4", fileName: "IMG_0415.jpg", status: "needs_review", category: "transfer",
    fields: {
      bank: qr("scb"), amount: unsure("880.00"), paid_at: ok("2026-01-05T16:08"),
      receiver_name: unsure("นาย สมมติ ทดสอบ"), ref: qr("20260105aBcDeFgHiJkLmN"),
    },
  },
  {
    id: "s5", fileName: "IMG_0412 (1).jpg", status: "duplicate", category: "food",
    fields: {
      bank: qr("kbank"), amount: ok("129.50"), paid_at: ok("2026-01-03T09:15"),
      receiver_name: ok("บริษัท ร้านสะดวกซื้อทดสอบ จำกัด"), ref: qr("015999091500AQR00001"),
    },
  },
  {
    id: "s6", fileName: "IMG_0416.jpg", status: "processing", category: "other",
    fields: {
      bank: unsure(null), amount: unsure(null), paid_at: unsure(null),
      receiver_name: unsure(null), ref: unsure(null),
    },
  },
];

// dashboard: ยอดรวมรายหมวด / รายวัน ของเดือนสมมติ
export const MONTH = { label: "มกราคม 2569", spent: 8420, budget: 15000 };

export const BY_CATEGORY: { category: Category; amount: number }[] = [
  { category: "food", amount: 3900 },
  { category: "transport", amount: 2100 },
  { category: "shopping", amount: 1500 },
  { category: "bills", amount: 620 },
  { category: "other", amount: 300 },
];

export const DAILY: number[] = [
  180, 420, 95, 1250, 310, 260, 390, 150, 470, 220, 330, 610, 140, 280,
  360, 190, 240, 520, 170, 310, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

export const TOP_RECEIVERS = [
  { name: "องค์การขนส่งทดสอบ", count: 18, total: 396, recurring: false },
  { name: "บริษัท ร้านสะดวกซื้อทดสอบ จำกัด", count: 9, total: 1166, recurring: false },
  { name: "ค่าเน็ตบ้านทดสอบ", count: 1, total: 599, recurring: true },
];
