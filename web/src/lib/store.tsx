"use client";

// state กลางของแอป (ชั่วคราว ก่อนมี API): ทุกหน้าอ่าน/แก้ที่เดียวกัน
// ยืนยันสลิปในหน้าตรวจ -> badge ลด, ยอดใน dashboard เพิ่ม ทันที
// ทำไม context ไม่ใช่ไลบรารี state: มีข้อมูลชุดเดียว ใช้ไม่กี่หน้า และจะถูกแทนด้วย API อยู่แล้ว
// เก็บในหน่วยความจำเท่านั้น รีเฟรชแล้วรีเซ็ต — ตั้งใจ: ไม่เก็บข้อมูลการเงินในเบราว์เซอร์

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BASE_TRANSACTIONS, MOCK_SLIPS } from "./mock";
import type { Bank, Category, FieldName, Slip, Transaction } from "./types";

type Edits = Partial<Record<FieldName, string>>;

// เก็บ "ชนิด" ของข้อความ ไม่ใช่ข้อความ: ให้ Toaster แปลตามภาษาที่เปิดอยู่ตอนแสดง
type Toast = { id: number; kind: "one" | "many"; n: number; undo?: () => void };

type Store = {
  slips: Slip[];
  transactions: Transaction[];
  toast: Toast | null;
  confirmSlip: (id: string, edits: Edits, category: Category) => void;
  confirmAllReady: () => void;
  addFiles: (names: string[]) => void;
  dismissToast: () => void;
};

const Ctx = createContext<Store | null>(null);

// สลับภาษา = เปลี่ยน /th เป็น /en = root layout mount ใหม่ = state ใน React หาย
// เก็บสำเนาไว้ระดับ module (อยู่ในหน่วยความจำของแท็บนี้เท่านั้น ไม่ลง storage) แล้วอ่านกลับตอน mount
// รีเฟรชหน้าแล้วยังรีเซ็ตตามเดิม
let memory: { slips: Slip[]; transactions: Transaction[] } | null = null;

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

// จำลองผล OCR ของไฟล์ที่เพิ่งเลือก: ใบคู่ "มั่นใจ" ใบคี่ "ต้องตรวจผู้รับ" — ให้เห็นทั้งสองแบบ
function fakeOcr(id: string, fileName: string, n: number): Slip {
  const unsureReceiver = n % 2 === 1;
  return {
    id, fileName, category: "food",
    status: unsureReceiver ? "needs_review" : "ready",
    fields: {
      bank: { value: "kbank", confident: true, source: "qr" },
      amount: { value: (45 + n * 12).toFixed(2), confident: true, source: "ocr" },
      paid_at: { value: `2026-01-21T${String(10 + (n % 10)).padStart(2, "0")}:${String((n * 7) % 60).padStart(2, "0")}`, confident: true, source: "ocr" },
      receiver_name: { value: unsureReceiver ? "ร้านอาหารทดสอบ" : "ร้านค้าทดสอบ", confident: !unsureReceiver, source: "ocr" },
      ref: { value: `0159992100${String(n).padStart(2, "0")}BPP0${String(n).padStart(4, "0")}`, confident: true, source: "qr" },
    },
  };
}

export function SlipsProvider({ children }: { children: ReactNode }) {
  const [slips, setSlips] = useState<Slip[]>(() => memory?.slips ?? MOCK_SLIPS);
  const [transactions, setTransactions] = useState<Transaction[]>(() => memory?.transactions ?? BASE_TRANSACTIONS);
  useEffect(() => {
    memory = { slips, transactions };
  }, [slips, transactions]);
  const [toast, setToast] = useState<Toast | null>(null);
  const seq = useRef(0);

  const showToast = useCallback((kind: Toast["kind"], n: number, undo?: () => void) => {
    seq.current += 1;
    setToast({ id: seq.current, kind, n, undo });
  }, []);

  const confirmSlip = useCallback(
    (id: string, edits: Edits, category: Category) => {
      const slip = slips.find((s) => s.id === id);
      if (!slip) return;
      const tx = toTransaction(slip, edits, category);
      setSlips((all) => all.filter((s) => s.id !== id));
      setTransactions((all) => [...all, tx]);
      // undo สำคัญกว่าปุ่ม "แน่ใจไหม?": ผู้ใช้ยืนยันเร็วได้โดยไม่กลัวพลาด
      showToast("one", 1, () => {
        setSlips((all) => [slip, ...all]);
        setTransactions((all) => all.filter((t) => t.id !== tx.id));
      });
    },
    [slips, showToast],
  );

  const confirmAllReady = useCallback(() => {
    const ready = slips.filter((s) => s.status === "ready");
    if (ready.length === 0) return;
    const txs = ready.map((s) => toTransaction(s));
    const ids = new Set(ready.map((s) => s.id));
    setSlips((all) => all.filter((s) => !ids.has(s.id)));
    setTransactions((all) => [...all, ...txs]);
    showToast("many", ready.length, () => {
      setSlips((all) => [...ready, ...all]);
      const txIds = new Set(txs.map((t) => t.id));
      setTransactions((all) => all.filter((t) => !txIds.has(t.id)));
    });
  }, [slips, showToast]);

  const addFiles = useCallback((names: string[]) => {
    const created = names.map((name) => {
      seq.current += 1;
      return { id: `u${seq.current}`, name, n: seq.current };
    });
    setSlips((all) => [
      ...created.map(({ id, name }) => ({ ...fakeOcr(id, name, 0), status: "processing" as const })),
      ...all,
    ]);
    // จำลองว่า OCR เสร็จทีละใบ (ของจริง ~7 วิ/ใบ ที่นี่เร่งให้ดูทัน)
    created.forEach(({ id, name, n }, i) => {
      setTimeout(() => {
        setSlips((all) => all.map((s) => (s.id === id ? fakeOcr(id, name, n) : s)));
      }, 900 + i * 700);
    });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo(
    () => ({ slips, transactions, toast, confirmSlip, confirmAllReady, addFiles, dismissToast }),
    [slips, transactions, toast, confirmSlip, confirmAllReady, addFiles, dismissToast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSlips(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSlips ต้องอยู่ใต้ <SlipsProvider>");
  return s;
}
