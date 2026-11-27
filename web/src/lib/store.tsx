"use client";

// state กลางของแอป (ชั่วคราว ก่อนมี API): ทุกหน้าอ่าน/แก้ที่เดียวกัน
// ยืนยันสลิปในหน้าตรวจ -> badge ลด, ยอดใน dashboard เพิ่ม ทันที
// เก็บในหน่วยความจำเท่านั้น รีเฟรชแล้วรีเซ็ต — ตั้งใจ: ไม่เก็บข้อมูลการเงินในเบราว์เซอร์
//
// ทำไมเป็นตัวแปรระดับ module + useSyncExternalStore ไม่ใช่ useState ใน provider:
// Next 16 ไม่ unmount หน้าภาษาเดิมตอนสลับ /th <-> /en แต่ซ่อนไว้ใน <Activity> พร้อม state ของมัน
// ถ้า state อยู่ใน provider จะมีสองชุดแยกกัน: ยืนยันใน /en แล้วกลับ /th สลิปเดิมโผล่กลับมา (ยืนยันซ้ำ = นับยอดซ้ำ)
// ข้อมูลชุดเดียวนอก React แก้ทั้งเรื่องนี้ และเรื่อง timer จำลอง OCR ที่ไปอัปเดต provider ที่ถูกซ่อน/ทิ้งไปแล้ว

import { useSyncExternalStore } from "react";
import { BASE_TRANSACTIONS, MOCK_SLIPS } from "./mock";
import type { Bank, Category, FieldName, Slip, Transaction } from "./types";

type Edits = Partial<Record<FieldName, string>>;

// เก็บ "ชนิด" ของข้อความ ไม่ใช่ข้อความ: ให้ Toaster แปลตามภาษาที่เปิดอยู่ตอนแสดง
type Toast = { id: number; kind: "one" | "many" | "removed"; n: number; undo?: () => void };

type State = { slips: Slip[]; transactions: Transaction[]; toast: Toast | null };

const INITIAL: State = { slips: MOCK_SLIPS, transactions: BASE_TRANSACTIONS, toast: null };
let state = INITIAL;
const listeners = new Set<() => void>();

function update(fn: (s: State) => State) {
  state = fn(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let nextId = 0;
const newId = () => ++nextId;

// เวลาจำลองต่อใบ (ของจริง ~7 วิ/ใบ ที่นี่เร่งให้ดูทัน)
const OCR_FIRST_MS = 900;
const OCR_EACH_MS = 700;

function toTransaction(slip: Slip, edits: Edits = {}, category: Category = slip.category): Transaction {
  const v = (f: FieldName) => edits[f] ?? slip.fields[f].value;
  return {
    id: `tx-${slip.id}`,
    paidAt: v("paid_at") ?? new Date().toISOString(),
    amount: Number(v("amount") ?? 0),
    receiver: v("receiver_name") ?? "—",
    bank: (v("bank") ?? "kbank") as Bank,
    category,
    ref: v("ref"),
  };
}

// hash ชื่อไฟล์ -> ตัวเลขคงที่: ไฟล์เดิมได้ผล OCR เดิม (ref เดิม) เหมือนรูปเดิมของจริง
// จึงลองอัปโหลดไฟล์เดิมซ้ำแล้วเห็นการกันสลิปซ้ำได้
function hashName(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 10007;
  return h;
}

// จำลองผล OCR: เลขคี่ "ต้องตรวจผู้รับ" เลขคู่ "มั่นใจ" — ให้เห็นทั้งสองแบบ
function fakeOcr(id: string, fileName: string): Slip {
  const n = hashName(fileName);
  const unsureReceiver = n % 2 === 1;
  const pad = (x: number, w = 2) => String(x).padStart(w, "0");
  return {
    id, fileName, category: "food",
    status: unsureReceiver ? "needs_review" : "ready",
    fields: {
      bank: { value: "kbank", confident: true, source: "qr" },
      amount: { value: (35 + (n % 40) * 5).toFixed(2), confident: true, source: "ocr" },
      paid_at: { value: `2026-01-21T${pad(8 + (n % 12))}:${pad((n * 7) % 60)}`, confident: true, source: "ocr" },
      receiver_name: { value: unsureReceiver ? "ร้านอาหารทดสอบ" : "ร้านค้าทดสอบ", confident: !unsureReceiver, source: "ocr" },
      ref: { value: `01599921${pad(n, 5)}BPP${pad(n, 5)}`, confident: true, source: "qr" },
    },
  };
}

function showToast(kind: Toast["kind"], n: number, undo?: () => void) {
  update((s) => ({ ...s, toast: { id: newId(), kind, n, undo } }));
}

function finishOcr(id: string) {
  update((s) => {
    const slip = s.slips.find((x) => x.id === id);
    if (!slip || slip.status !== "processing") return s;
    const done = fakeOcr(id, slip.fileName);
    // กันสลิปซ้ำด้วย ref: ซ้ำกับรายการที่ยืนยันแล้ว หรือสลิปอื่นที่อ่านเสร็จแล้ว -> ไม่นับยอดซ้ำ
    const ref = done.fields.ref.value;
    const dup =
      s.transactions.some((t) => t.ref === ref) ||
      s.slips.some((x) => x.id !== id && x.status !== "processing" && x.fields.ref.value === ref);
    const next: Slip = { ...done, status: dup ? "duplicate" : done.status };
    return { ...s, slips: s.slips.map((x) => (x.id === id ? next : x)) };
  });
}

const actions = {
  confirmSlip(id: string, edits: Edits, category: Category) {
    const slip = state.slips.find((s) => s.id === id);
    if (!slip) return;
    const tx = toTransaction(slip, edits, category);
    update((s) => ({ ...s, slips: s.slips.filter((x) => x.id !== id), transactions: [...s.transactions, tx] }));
    // undo สำคัญกว่าปุ่ม "แน่ใจไหม?": ผู้ใช้ยืนยันเร็วได้โดยไม่กลัวพลาด
    showToast("one", 1, () =>
      update((s) => ({ ...s, slips: [slip, ...s.slips], transactions: s.transactions.filter((t) => t.id !== tx.id) })),
    );
  },

  confirmAllReady() {
    const ready = state.slips.filter((s) => s.status === "ready");
    if (ready.length === 0) return;
    const txs = ready.map((s) => toTransaction(s));
    const ids = new Set(ready.map((s) => s.id));
    const txIds = new Set(txs.map((t) => t.id));
    update((s) => ({ ...s, slips: s.slips.filter((x) => !ids.has(x.id)), transactions: [...s.transactions, ...txs] }));
    showToast("many", ready.length, () =>
      update((s) => ({ ...s, slips: [...ready, ...s.slips], transactions: s.transactions.filter((t) => !txIds.has(t.id)) })),
    );
  },

  addFiles(names: string[]) {
    const created = names.map((name) => ({ ...fakeOcr(`u${newId()}`, name), status: "processing" as const }));
    update((s) => ({ ...s, slips: [...created, ...s.slips] }));
    // timer อยู่นอก React: สลับภาษา/เปลี่ยนหน้ากลางคันก็ยังอ่านเสร็จ
    created.forEach(({ id }, i) => setTimeout(() => finishOcr(id), OCR_FIRST_MS + i * OCR_EACH_MS));
  },

  removeSlip(id: string) {
    const index = state.slips.findIndex((s) => s.id === id);
    if (index < 0) return;
    const slip = state.slips[index];
    update((s) => ({ ...s, slips: s.slips.filter((x) => x.id !== id) }));
    showToast("removed", 1, () =>
      update((s) => ({ ...s, slips: [...s.slips.slice(0, index), slip, ...s.slips.slice(index)] })),
    );
  },

  dismissToast() {
    update((s) => (s.toast ? { ...s, toast: null } : s));
  },
};

export function useSlips(): State & typeof actions {
  // server render และ hydration ใช้ INITIAL เสมอ -> HTML ตรงกับฝั่ง client ไม่เกิด hydration mismatch
  const s = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  return { ...s, ...actions };
}
