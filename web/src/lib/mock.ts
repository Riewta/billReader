// ข้อมูลปลอมทั้งหมด (ชื่อ/เลขอ้างอิงสมมติ) — ห้ามใส่ข้อมูลจากสลิปจริงในไฟล์นี้ เพราะถูก commit
// รูปแบบค่าจำลองจากที่เจอใน benchmark: ref/ธนาคารมาจาก QR, ผู้รับเป็น field ที่พลาดบ่อยสุด

import type { Category, FieldValue, Slip, Transaction } from "./types";

const qr = (value: string): FieldValue => ({ value, confident: true, source: "qr" });
const ok = (value: string): FieldValue => ({ value, confident: true, source: "ocr" });
const unsure = (value: string | null): FieldValue => ({ value, confident: false, source: "ocr" });

// "วันนี้" ของข้อมูลจำลอง: ตรึงไว้ ให้หน้าจอเหมือนเดิมทุกครั้งที่เปิด (ไม่ขึ้นกับนาฬิกาเครื่อง)
export const TODAY = "2026-01-21";
export const MONTH = { key: "2026-01", label: { th: "มกราคม 2569", en: "January 2026" }, budget: 15000 };

// สลิปรอบล่าสุดที่เพิ่งอัปโหลด (ยังไม่ยืนยัน)
export const MOCK_SLIPS: Slip[] = [
  {
    id: "s1", fileName: "IMG_0412.jpg", status: "ready", category: "food",
    fields: {
      bank: qr("kbank"), amount: ok("129.50"), paid_at: ok("2026-01-21T09:15"),
      receiver_name: ok("บริษัท ร้านสะดวกซื้อทดสอบ จำกัด"), ref: qr("015999091500AQR00001"),
    },
  },
  {
    id: "s2", fileName: "IMG_0413.jpg", status: "ready", category: "transport",
    fields: {
      bank: qr("kbank"), amount: ok("22.00"), paid_at: ok("2026-01-21T18:40"),
      receiver_name: ok("องค์การขนส่งทดสอบ"), ref: qr("015999184000BPM00002"),
    },
  },
  {
    id: "s3", fileName: "IMG_0414.jpg", status: "needs_review", category: "food",
    fields: {
      bank: qr("kbank"), amount: ok("85.00"), paid_at: ok("2026-01-20T12:07"),
      receiver_name: unsure("ร้านกาแฟทดสอบ สาขา 1"), ref: qr("015999120700BPP00003"),
    },
  },
  {
    id: "s4", fileName: "IMG_0415.jpg", status: "needs_review", category: "transfer",
    fields: {
      bank: qr("scb"), amount: unsure("880.00"), paid_at: ok("2026-01-19T16:08"),
      receiver_name: unsure("นาย สมมติ ทดสอบ"), ref: qr("20260119aBcDeFgHiJkLmN"),
    },
  },
  {
    id: "s5", fileName: "IMG_0412 (1).jpg", status: "duplicate", category: "food",
    fields: {
      bank: qr("kbank"), amount: ok("129.50"), paid_at: ok("2026-01-21T09:15"),
      receiver_name: ok("บริษัท ร้านสะดวกซื้อทดสอบ จำกัด"), ref: qr("015999091500AQR00001"),
    },
  },
];

// รายการที่ยืนยันแล้วก่อนหน้านี้ในเดือน: dashboard คำนวณทุกตัวเลขจากรายการนี้ (ไม่ hardcode ยอดรวม)
const R = {
  store: "บริษัท ร้านสะดวกซื้อทดสอบ จำกัด",
  bus: "องค์การขนส่งทดสอบ",
  coffee: "ร้านกาแฟทดสอบ สาขา 1",
  noodle: "ร้านก๋วยเตี๋ยวทดสอบ",
  mall: "ห้างทดสอบพลาซ่า",
  net: "ค่าเน็ตบ้านทดสอบ",
  phone: "ค่าโทรศัพท์ทดสอบ",
  friend: "นาย เพื่อน ทดสอบ",
  rail: "รถไฟฟ้าทดสอบ",
};

const rows: [string, number, keyof typeof R, Category][] = [
  ["2026-01-01T12:10", 65, "noodle", "food"],
  ["2026-01-01T18:30", 42, "bus", "transport"],
  ["2026-01-02T08:05", 55, "coffee", "food"],
  ["2026-01-02T19:20", 310, "store", "food"],
  ["2026-01-03T10:00", 599, "net", "bills"],
  ["2026-01-04T13:45", 1290, "mall", "shopping"],
  ["2026-01-04T20:10", 88, "store", "food"],
  ["2026-01-05T08:00", 44, "rail", "transport"],
  ["2026-01-05T12:30", 60, "noodle", "food"],
  ["2026-01-06T08:10", 44, "rail", "transport"],
  ["2026-01-06T17:55", 500, "friend", "transfer"],
  ["2026-01-07T12:20", 70, "noodle", "food"],
  ["2026-01-08T08:05", 55, "coffee", "food"],
  ["2026-01-08T18:40", 22, "bus", "transport"],
  ["2026-01-09T19:05", 245, "store", "food"],
  ["2026-01-10T11:30", 399, "phone", "bills"],
  ["2026-01-11T14:00", 2150, "mall", "shopping"],
  ["2026-01-12T08:10", 44, "rail", "transport"],
  ["2026-01-12T12:15", 65, "noodle", "food"],
  ["2026-01-13T08:05", 55, "coffee", "food"],
  ["2026-01-14T19:30", 180, "store", "food"],
  ["2026-01-15T08:10", 44, "rail", "transport"],
  ["2026-01-15T12:40", 75, "noodle", "food"],
  ["2026-01-16T20:00", 350, "friend", "transfer"],
  ["2026-01-17T13:10", 480, "mall", "shopping"],
  ["2026-01-18T09:00", 55, "coffee", "food"],
  ["2026-01-18T18:20", 22, "bus", "transport"],
  ["2026-01-19T12:05", 65, "noodle", "food"],
  ["2026-01-20T08:10", 44, "rail", "transport"],
  ["2026-01-20T19:45", 215, "store", "food"],
];

export const BASE_TRANSACTIONS: Transaction[] = rows.map(([paidAt, amount, who, category], i) => ({
  id: `t${i + 1}`,
  paidAt,
  amount,
  receiver: R[who],
  bank: who === "friend" ? "scb" : "kbank",
  category,
  ref: null,
}));

// รายจ่ายประจำ: ผู้รับเดิมทุกเดือน (Phase 5 จะตรวจจับเอง ตอนนี้ mock ไว้)
export const RECURRING_RECEIVERS = new Set([R.net, R.phone]);
