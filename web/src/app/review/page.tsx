"use client";

import { useState } from "react";
import { displayField } from "@/lib/format";
import { MOCK_SLIPS } from "@/lib/mock";
import {
  CATEGORY_LABELS, FIELD_LABELS, type Category, type FieldName, type Slip,
} from "@/lib/types";

const FIELD_ORDER: FieldName[] = ["amount", "paid_at", "receiver_name", "bank", "ref"];

// หน้าตรวจและแก้: ผู้ใช้ควรดู "เฉพาะสิ่งที่ระบบไม่มั่นใจ"
// ถ้าต้องเปิดตรวจทุกใบ แอปก็ไม่ต่างจากพิมพ์เอง
export default function ReviewPage() {
  const [confirmedReady, setConfirmedReady] = useState(false);
  const [queue, setQueue] = useState<Slip[]>(() => MOCK_SLIPS.filter((s) => s.status === "needs_review"));
  const [doneCount, setDoneCount] = useState(0);
  const ready = MOCK_SLIPS.filter((s) => s.status === "ready");

  const current = queue[0];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-medium">ตรวจสลิป</h1>
        <p className="mt-1 text-sm text-muted">ดูแค่ช่องสีเหลือง ช่องอื่นระบบมั่นใจแล้ว</p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">มั่นใจทุกช่อง {ready.length} รายการ</p>
            <p className="text-xs text-muted">ยืนยันทีเดียวได้เลย</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmedReady(true)}
            className={`rounded-lg px-3 py-2 text-sm ${
              confirmedReady ? "bg-ok-soft text-ok" : "border border-border hover:bg-background"
            }`}
          >
            {confirmedReady ? "ยืนยันแล้ว" : `ยืนยัน ${ready.length} รายการ`}
          </button>
        </div>
      </section>

      {current ? (
        <SlipEditor
          key={current.id}
          slip={current}
          position={doneCount + 1}
          total={doneCount + queue.length}
          onConfirm={() => {
            setQueue((q) => q.slice(1));
            setDoneCount((n) => n + 1);
          }}
        />
      ) : (
        <section className="rounded-xl border border-border bg-surface px-4 py-10 text-center">
          <p className="font-medium">ตรวจครบแล้ว</p>
          <p className="mt-1 text-sm text-muted">ยืนยัน {doneCount} รายการ รูปสลิปถูกลบหลังยืนยัน</p>
        </section>
      )}
    </div>
  );
}

function SlipEditor({
  slip, position, total, onConfirm,
}: {
  slip: Slip;
  position: number;
  total: number;
  onConfirm: () => void;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(FIELD_ORDER.map((f) => [f, slip.fields[f].value ?? ""])) as Record<FieldName, string>,
  );
  const [category, setCategory] = useState<Category>(slip.category);
  // field ที่ไม่มั่นใจขึ้นก่อน: ผู้ใช้เห็นสิ่งที่ต้องทำทันทีโดยไม่ต้องไล่หา
  const unsure = FIELD_ORDER.filter((f) => !slip.fields[f].confident);
  const sure = FIELD_ORDER.filter((f) => slip.fields[f].confident);

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted">
        ใบที่ {position} จาก {total} ที่ต้องตรวจ
      </p>

      {/* แทนรูปสลิป: ของจริงจะซูมไปที่ตำแหน่งของ field ที่ไม่แน่ใจ (ต้องมี bounding box จาก OCR) */}
      <div className="flex h-36 items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted">
        รูปสลิป · ซูมไปที่ {unsure.map((f) => FIELD_LABELS[f]).join(", ")}
      </div>

      <div className="space-y-2">
        {unsure.map((f) => (
          <label key={f} className="block rounded-xl border border-warn-border bg-warn-soft p-3">
            <span className="text-xs text-warn">{FIELD_LABELS[f]} · ไม่แน่ใจ ช่วยตรวจ</span>
            <input
              value={values[f]}
              onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
              inputMode={f === "amount" ? "decimal" : undefined}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent"
            />
          </label>
        ))}
      </div>

      <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
        {sure.map((f) => (
          <div key={f} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <dt className="text-muted">{FIELD_LABELS[f]}</dt>
            <dd className={`flex items-center gap-1.5 text-right ${f === "ref" ? "font-mono text-xs" : ""}`}>
              <span className="break-all">{displayField(f, slip.fields[f].value)}</span>
              {slip.fields[f].source === "qr" && (
                <span className="shrink-0 rounded bg-ok-soft px-1 text-[11px] text-ok" title="อ่านจาก QR บนสลิป ตรงตัว">
                  QR
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <fieldset>
        {/* ทุกครั้งที่ผู้ใช้เปลี่ยนหมวด = label สำหรับเทรนตัวจัดหมวดรายคน (Phase 5) */}
        <legend className="mb-2 text-sm font-medium">หมวด</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                category === c ? "bg-accent-soft font-medium text-accent" : "border border-border text-muted"
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={onConfirm}
        className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white dark:text-background"
      >
        ยืนยัน แล้วไปใบถัดไป
      </button>
    </section>
  );
}
