"use client";

import { QrCode } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import type { Bank, FieldName, Slip } from "@/lib/types";

// แทนรูปสลิปจริง: วาดสลิปจำลองจากค่าที่อ่านได้ แล้ว "ไฮไลต์จุดที่ไม่แน่ใจ"
// ของจริงจะเป็นรูปสลิปที่ซูม/วางกรอบตาม bounding box จาก OCR (ยังไม่ได้เก็บใน OCRResult)
// layout กลาง ๆ ไม่ลอกหน้าตาแอปธนาคารไหน: สลิปจริงแต่ละธนาคารหน้าตาต่างกันอยู่แล้ว
export function SlipPreview({ slip }: { slip: Slip }) {
  const { t } = useI18n();
  const f = slip.fields;
  const bank = (f.bank.value ?? "kbank") as Bank;

  return (
    <figure className="rounded-2xl border border-border bg-background p-4">
      <div className="mx-auto max-w-[280px] overflow-hidden rounded-xl bg-white text-stone-900 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between bg-stone-800 px-4 py-2.5 text-white">
          <span className="text-sm font-medium">{t.bankPrefix}{t.banks[bank]}</span>
          <span className="text-[11px] text-white/70">{slip.fileName}</span>
        </div>
        <div className="space-y-1 p-3">
          <p className="px-2 text-sm font-medium text-emerald-700">{t.slip.success}</p>
          <Row slip={slip} name="paid_at" label={t.slip.date} />
          <div className="px-2 py-1.5">
            <p className="text-[11px] text-stone-500">{t.slip.from}</p>
            <p className="text-sm">{t.slip.yourAccount} · xxx-x-x1234-x</p>
          </div>
          <Row slip={slip} name="receiver_name" label={t.slip.to} />
          <Row slip={slip} name="amount" label={t.slip.amount} big />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Row slip={slip} name="ref" label={t.slip.ref} />
            </div>
            <QrCode className="mb-1.5 size-12 shrink-0 text-stone-700" aria-hidden />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">{t.slip.caption}</figcaption>
    </figure>
  );
}

function Row({ slip, name, label, big }: { slip: Slip; name: FieldName; label: string; big?: boolean }) {
  const { t, field } = useI18n();
  const f = slip.fields;
  const unsure = !f[name].confident;
  return (
    <div
      className={`relative rounded-md px-2 py-1.5 ${unsure ? "bg-amber-50 ring-2 ring-amber-400" : ""}`}
    >
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className={`${big ? "text-xl font-medium" : "text-sm"} ${name === "ref" ? "font-mono text-xs break-all" : ""} text-stone-900`}>
        {field(name, f[name].value)}
      </p>
      {unsure && (
        <span className="absolute -top-2 right-2 rounded bg-amber-500 px-1.5 text-[10px] leading-4 text-white">{t.slip.checkHere}</span>
      )}
    </div>
  );
}

