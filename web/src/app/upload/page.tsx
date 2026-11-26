"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { MOCK_SLIPS } from "@/lib/mock";

// หน้าอัปโหลด: เลือกได้หลายรูป แล้ว "ไม่ต้องรอ" — OCR ใช้ ~7 วิ/ใบบน CPU
// ตอนนี้ยังไม่มี API: ไฟล์ที่เลือกแค่โชว์ในรายการ ไม่ถูกส่งไปไหน (และไม่ถูกเก็บ)
export default function UploadPage() {
  const [picked, setPicked] = useState<string[]>([]);
  const toReview = MOCK_SLIPS.filter((s) => s.status === "needs_review").length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-medium">อัปโหลดสลิป</h1>
        <p className="mt-1 text-sm text-muted">เลือกได้หลายรูปพร้อมกัน ระบบอ่านต่อเบื้องหลัง ปิดหน้านี้ได้</p>
      </header>

      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-muted/50 bg-surface px-4 py-8 text-center hover:border-accent">
        <span className="text-sm font-medium">เลือกรูปจากแกลเลอรี</span>
        <span className="text-xs text-muted">หรือลากไฟล์มาวาง · JPG, PNG</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => setPicked(Array.from(e.target.files ?? []).map((f) => f.name))}
        />
      </label>

      {picked.length > 0 && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          เลือกแล้ว {picked.length} รูป (ตัวอย่าง: ยังไม่ได้ต่อ API ไฟล์จึงไม่ถูกส่งไปไหน)
        </p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium">รอบล่าสุด</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {MOCK_SLIPS.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="truncate">{s.fileName}</span>
              <StatusPill status={s.status} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">สลิปซ้ำ (เลขอ้างอิงเดียวกัน) ข้ามให้อัตโนมัติ</p>
      </section>

      {/* ปุ่มหลักพาไปเฉพาะใบที่ไม่แน่ใจ ไม่ใช่ "ดูทั้งหมด" — หัวใจของแอป */}
      <Link
        href="/review"
        className="block rounded-xl bg-accent px-4 py-3 text-center text-sm font-medium text-white dark:text-background"
      >
        ตรวจ {toReview} รายการที่ไม่แน่ใจ
      </Link>
    </div>
  );
}
