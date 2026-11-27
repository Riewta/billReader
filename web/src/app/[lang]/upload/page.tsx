"use client";

import { ArrowRight, CircleCheck, Copy, FileImage, ImageUp, LoaderCircle, Lock, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { StatusPill } from "@/components/StatusPill";
import { useI18n } from "@/i18n/provider";
import { useSlips } from "@/lib/store";
import type { SlipStatus } from "@/lib/types";

const STATUS_ICON: Record<SlipStatus, typeof CircleCheck> = {
  ready: CircleCheck,
  needs_review: TriangleAlert,
  duplicate: Copy,
  processing: LoaderCircle,
  unreadable: TriangleAlert,
};

// หน้าอัปโหลด: เลือกได้หลายรูป แล้ว "ไม่ต้องรอ" — OCR ใช้ ~7 วิ/ใบบน CPU
// ยังไม่มี API: ไฟล์ที่เลือกไม่ถูกส่งไปไหน ใช้แค่ชื่อไฟล์ แล้วจำลองผล OCR
export default function UploadPage() {
  const { slips, addFiles, confirmAllReady, removeSlip } = useSlips();
  const { t, href, baht } = useI18n();
  const u = t.upload;
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const count = (st: SlipStatus) => slips.filter((s) => s.status === st).length;
  const ready = count("ready");
  const toReview = count("needs_review");
  const processing = count("processing");

  function take(files: FileList | null) {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (images.length) addFiles(images.map((f) => f.name));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{u.title}</h1>
        <p className="mt-1 text-sm text-muted">{u.subtitle}</p>
      </header>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent/60"
        }`}
      >
        <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <ImageUp className="size-6" aria-hidden />
        </span>
        <span>
          <span className="block font-medium">{dragging ? u.drop : u.pick}</span>
          <span className="mt-1 block text-sm text-muted">{u.hint}</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = ""; // เลือกไฟล์เดิมซ้ำได้
        }}
      />

      <p className="flex items-center gap-2 text-xs text-muted">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        {u.demoNote}
      </p>

      {slips.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3 text-sm">
            <h2 className="mr-auto font-medium">{u.latest}</h2>
            {processing > 0 && <span className="text-muted">{u.countProcessing(processing)}</span>}
            <span className="text-ok">{u.countReady(ready)}</span>
            <span className="text-warn">{u.countReview(toReview)}</span>
          </div>
          <ul className="divide-y divide-border">
            {slips.map((s) => {
              const Icon = STATUS_ICON[s.status];
              const amount = s.fields.amount.value;
              return (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-muted">
                    <FileImage className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{s.fileName}</p>
                    <p className="truncate text-xs text-muted">
                      {s.status === "processing"
                        ? u.reading
                        : s.status === "duplicate"
                          ? u.duplicateNote
                          : `${s.fields.receiver_name.value ?? t.unknownReceiver}${amount ? ` · ${baht(Number(amount))}` : ""}`}
                    </p>
                  </div>
                  <StatusPill status={s.status}>
                    <Icon className={`size-3.5 ${s.status === "processing" ? "animate-spin" : ""}`} aria-hidden />
                  </StatusPill>
                  {/* สลิปซ้ำไม่มีอะไรให้ทำต่อ: ให้เอาออกได้ ไม่งั้นค้างในรายการตลอด */}
                  {s.status === "duplicate" && (
                    <button
                      type="button"
                      onClick={() => removeSlip(s.id)}
                      aria-label={u.remove(s.fileName)}
                      title={u.remove(s.fileName)}
                      className="-mr-2 rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(ready > 0 || toReview > 0) && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {ready > 0 && (
            <button
              type="button"
              onClick={confirmAllReady}
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium hover:bg-background"
            >
              {u.confirmReady(ready)}
            </button>
          )}
          {/* ปุ่มหลักพาไปเฉพาะใบที่ไม่แน่ใจ ไม่ใช่ "ดูทั้งหมด" — หัวใจของแอป */}
          {toReview > 0 && (
            <Link
              href={href("/review")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 dark:text-background"
            >
              {u.reviewCta(toReview)}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
