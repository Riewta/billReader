"use client";

import { CheckCheck, ChevronRight, Lock, Pencil, PartyPopper, QrCode, SkipForward } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { SlipPreview } from "@/components/SlipPreview";
import { useI18n } from "@/i18n/provider";
import type { Dictionary } from "@/i18n/th";
import { useSlips } from "@/lib/store";
import type { Category, FieldName, Slip } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";

const FIELD_ORDER: FieldName[] = ["amount", "receiver_name", "paid_at", "bank", "ref"];
const CATEGORIES: Category[] = ["food", "transport", "shopping", "bills", "transfer", "other"];

// หน้าตรวจและแก้: ผู้ใช้ควรดู "เฉพาะสิ่งที่ระบบไม่มั่นใจ"
// ถ้าต้องเปิดตรวจทุกใบ แอปก็ไม่ต่างจากพิมพ์เอง
export default function ReviewPage() {
  const { slips, confirmSlip, confirmAllReady } = useSlips();
  const { t, href, baht } = useI18n();
  const r = t.review;
  // ลำดับคิวเก็บแยก: "ข้ามไว้ก่อน" = ย้ายใบนั้นไปท้ายคิว โดยไม่แตะ state กลาง
  const [skipped, setSkipped] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(0);

  const pending = slips.filter((s) => s.status === "needs_review");
  const queue = [...pending].sort((a, b) => skipped.indexOf(a.id) - skipped.indexOf(b.id));
  const ready = slips.filter((s) => s.status === "ready");
  const current = queue[0];
  const total = reviewed + queue.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{r.title}</h1>
          <p className="mt-1 text-sm text-muted">{r.subtitle}</p>
        </div>
        {total > 0 && (
          <div className="w-40">
            <div className="flex justify-between text-xs text-muted">
              <span>{r.progress}</span>
              <span className="tabular-nums">
                {reviewed}/{total}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${(reviewed / total) * 100}%` }} />
            </div>
          </div>
        )}
      </header>

      {ready.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
          <span className="grid size-9 place-items-center rounded-full bg-ok-soft text-ok">
            <CheckCheck className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{r.allSure(ready.length)}</p>
            <p className="truncate text-xs text-muted">
              {ready.map((s) => `${s.fields.receiver_name.value} ${baht(Number(s.fields.amount.value))}`).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={confirmAllReady}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-background"
          >
            {r.confirmAll}
          </button>
        </section>
      )}

      {current ? (
        <SlipEditor
          key={current.id}
          slip={current}
          position={reviewed + 1}
          total={total}
          canSkip={queue.length > 1}
          onSkip={() => setSkipped((s) => [...s.filter((id) => id !== current.id), current.id])}
          onConfirm={(edits, category) => {
            confirmSlip(current.id, edits, category);
            setReviewed((n) => n + 1);
          }}
        />
      ) : (
        <section className="flex flex-col items-center rounded-2xl border border-border bg-surface px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
            <PartyPopper className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-medium">{r.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted">
            {reviewed > 0 ? r.emptyDone(reviewed) : r.emptyIdle}
          </p>
          <div className="mt-6 flex gap-3">
            <Link href={href("/upload")} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background">
              {r.uploadMore}
            </Link>
            <Link
              href={href("/")}
              className="flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:text-background"
            >
              {r.toDashboard} <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

type Edits = Partial<Record<FieldName, string>>;

function validate(f: FieldName, v: string, r: Dictionary["review"]): string | null {
  if (f === "amount") {
    if (!/^\d+(\.\d{1,2})?$/.test(v.trim())) return r.errAmountFormat;
    if (Number(v) <= 0) return r.errAmountPositive;
  }
  if (f === "receiver_name" && v.trim().length < 2) return r.errReceiver;
  return null;
}

function SlipEditor({
  slip, position, total, canSkip, onSkip, onConfirm,
}: {
  slip: Slip;
  position: number;
  total: number;
  canSkip: boolean;
  onSkip: () => void;
  onConfirm: (edits: Edits, category: Category) => void;
}) {
  const { t, field } = useI18n();
  const r = t.review;
  const [values, setValues] = useState(() =>
    Object.fromEntries(FIELD_ORDER.map((f) => [f, slip.fields[f].value ?? ""])) as Record<FieldName, string>,
  );
  const [editing, setEditing] = useState<Set<FieldName>>(new Set());
  const [category, setCategory] = useState<Category>(slip.category);
  const [submitted, setSubmitted] = useState(false);

  // field ที่ไม่มั่นใจขึ้นก่อน: ผู้ใช้เห็นสิ่งที่ต้องทำทันทีโดยไม่ต้องไล่หา
  const unsure = FIELD_ORDER.filter((f) => !slip.fields[f].confident);
  const sure = FIELD_ORDER.filter((f) => slip.fields[f].confident);
  const editable = [...unsure, ...editing];
  const errors = Object.fromEntries(editable.map((f) => [f, validate(f, values[f], r)])) as Partial<Record<FieldName, string | null>>;
  const hasError = Object.values(errors).some(Boolean);

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (hasError) return;
    const edits: Edits = {};
    for (const f of editable) if (values[f] !== (slip.fields[f].value ?? "")) edits[f] = values[f].trim();
    onConfirm(edits, category);
  }

  const input = (f: FieldName) => (
    <>
      <input
        id={`f-${f}`}
        value={values[f]}
        onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
        inputMode={f === "amount" ? "decimal" : undefined}
        aria-invalid={submitted && !!errors[f]}
        aria-describedby={submitted && errors[f] ? `e-${f}` : undefined}
        className={`mt-1.5 w-full rounded-lg border bg-surface px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-accent/30 ${
          submitted && errors[f] ? "border-red-500" : "border-border focus:border-accent"
        }`}
      />
      {submitted && errors[f] && (
        <p id={`e-${f}`} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {errors[f]}
        </p>
      )}
    </>
  );

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-3 text-sm text-muted">
          {r.position(position, total)}
        </p>
        <SlipPreview slip={slip} />
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          {unsure.map((f, i) => (
            <div key={f} className="rounded-2xl border border-warn-border bg-warn-soft p-4">
              <label htmlFor={`f-${f}`} className="text-sm font-medium text-warn">
                {t.fields[f]}
              </label>
              <p className="text-xs text-warn/80">{r.unclear}</p>
              {/* โฟกัสช่องแรกที่ต้องตรวจให้เลย: พิมพ์แก้ได้ทันที กด Enter ยืนยัน */}
              {i === 0 ? <AutoFocus>{input(f)}</AutoFocus> : input(f)}
            </div>
          ))}
        </div>

        <dl className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {sure.map((f) => {
            const fromQr = slip.fields[f].source === "qr";
            const isEditing = editing.has(f);
            return (
              <div key={f} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <dt className="w-24 shrink-0 text-sm text-muted">{t.fields[f]}</dt>
                  <dd className={`min-w-0 flex-1 text-right text-sm ${f === "ref" ? "font-mono text-xs break-all" : ""}`}>
                    {isEditing ? null : field(f, slip.fields[f].value)}
                  </dd>
                  {fromQr ? (
                    // ค่าจาก QR ผ่าน CRC แล้ว = ตรงตัว จึงไม่ให้แก้: กันผู้ใช้แก้ค่าที่ถูกให้ผิด
                    <span
                      className="flex shrink-0 items-center gap-1 rounded-md bg-ok-soft px-1.5 py-0.5 text-[11px] text-ok"
                      title={r.qrLocked}
                    >
                      <QrCode className="size-3" aria-hidden />
                      QR
                      <Lock className="size-2.5" aria-hidden />
                    </span>
                  ) : (
                    !isEditing && (
                      <button
                        type="button"
                        onClick={() => setEditing((s) => new Set(s).add(f))}
                        className="shrink-0 rounded-md p-1.5 text-muted hover:bg-background hover:text-foreground"
                        aria-label={r.edit(t.fields[f])}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                    )
                  )}
                </div>
                {isEditing && input(f)}
              </div>
            );
          })}
        </dl>

        <fieldset>
          {/* ทุกครั้งที่ผู้ใช้เปลี่ยนหมวด = label สำหรับเทรนตัวจัดหมวดรายคน (Phase 5) */}
          <legend className="mb-2.5 text-sm font-medium">{r.category}</legend>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => {
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(c)}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm transition-colors ${
                    on ? `border-transparent ${CATEGORY_META[c].chip} font-medium` : "border-border bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  {on ? (
                    <CategoryIcon category={c} size="sm" />
                  ) : (
                    <span className="grid size-6 place-items-center">
                      {(() => {
                        const Icon = CATEGORY_META[c].icon;
                        return <Icon className="size-3.5" aria-hidden />;
                      })()}
                    </span>
                  )}
                  {t.categories[c]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex gap-3 pt-1">
          {canSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted hover:text-foreground"
            >
              <SkipForward className="size-4" aria-hidden />
              {r.skip}
            </button>
          )}
          <button
            type="submit"
            className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 dark:text-background"
          >
            {r.confirm}
          </button>
        </div>
        <p className="hidden text-center text-xs text-muted md:block">{r.enterHint}</p>
      </div>
    </form>
  );
}

// โฟกัส input ตัวแรกเมื่อเปิดสลิปใบใหม่ (key ของ SlipEditor เปลี่ยน -> mount ใหม่ -> โฟกัสใหม่)
function AutoFocus({ children }: { children: React.ReactNode }) {
  return (
    <div
      ref={(el) => {
        el?.querySelector("input")?.focus({ preventScroll: true });
      }}
    >
      {children}
    </div>
  );
}
