"use client";

import { ChevronRight, Repeat, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatBaht, formatThaiDateTime } from "@/lib/format";
import { MONTH, RECURRING_RECEIVERS, TODAY } from "@/lib/mock";
import { useSlips } from "@/lib/store";
import { CATEGORY_LABELS, type Category } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";

// Dashboard ตอบคำถามเดียวก่อน: "เดือนนี้ใช้ไปเท่าไร เทียบงบแล้วโอเคไหม"
// ทุกตัวเลขคำนวณจากรายการที่ยืนยันแล้ว — ยืนยันสลิปใหม่ ตัวเลขขยับทันที
export default function DashboardPage() {
  const { transactions, slips } = useSlips();
  const toReview = slips.filter((s) => s.status === "needs_review").length;

  const s = useMemo(() => {
    const month = transactions.filter((t) => t.paidAt.startsWith(MONTH.key));
    const spent = month.reduce((a, t) => a + t.amount, 0);
    const today = Number(TODAY.slice(8, 10));
    const daysInMonth = 31;

    const daily = Array.from({ length: daysInMonth }, () => 0);
    for (const t of month) daily[Number(t.paidAt.slice(8, 10)) - 1] += t.amount;

    const byCat = new Map<Category, number>();
    for (const t of month) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    const categories = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

    const byReceiver = new Map<string, { count: number; total: number }>();
    for (const t of month) {
      const r = byReceiver.get(t.receiver) ?? { count: 0, total: 0 };
      byReceiver.set(t.receiver, { count: r.count + 1, total: r.total + t.amount });
    }
    const top = [...byReceiver.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 4);

    const recent = [...month].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 6);
    return { spent, today, daysInMonth, daily, categories, top, recent, count: month.length };
  }, [transactions]);

  const pct = Math.round((s.spent / MONTH.budget) * 100);
  const remaining = MONTH.budget - s.spent;
  const daysLeft = s.daysInMonth - s.today + 1;
  const perDayLeft = remaining > 0 ? remaining / daysLeft : 0;
  const over = pct >= 100;
  const maxDay = Math.max(1, ...s.daily);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{MONTH.label}</p>
          <h1 className="text-2xl font-medium tracking-tight">ภาพรวม</h1>
        </div>
        <Link
          href="/upload"
          className="hidden rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 md:block dark:text-background"
        >
          อัปโหลดสลิป
        </Link>
      </header>

      {toReview > 0 && (
        <Link
          href="/review"
          className="flex items-center gap-3 rounded-xl border border-warn-border bg-warn-soft px-4 py-3 text-sm text-warn transition-opacity hover:opacity-90"
        >
          <ScanSearch className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">
            มี <span className="font-medium">{toReview} สลิป</span> รอตรวจ ยังไม่ถูกนับในยอดด้านล่าง
          </span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-border bg-surface p-5 md:col-span-2">
          <p className="text-sm text-muted">ใช้ไปแล้วเดือนนี้</p>
          <p className="mt-1 text-4xl font-medium tracking-tight tabular-nums">
            ฿{formatBaht(s.spent, true)}
          </p>
          <div
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-background"
            role="progressbar"
            aria-valuenow={Math.min(pct, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="สัดส่วนงบที่ใช้"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${over ? "bg-warn" : "bg-accent"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{pct}% ของงบ</span>
            <span>งบ ฿{formatBaht(MONTH.budget, true)}</span>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-1">
          <Stat label="เหลือใช้ได้" value={`฿${formatBaht(Math.max(0, remaining), true)}`} />
          <Stat label={`ใช้ได้ต่อวัน (${daysLeft} วันที่เหลือ)`} value={`฿${formatBaht(perDayLeft, true)}`} />
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">รายวัน</h2>
          <p className="text-xs text-muted">{s.count} รายการ</p>
        </div>
        <div className="mt-4 flex h-32 items-end gap-[3px]">
          {s.daily.map((v, i) => {
            const future = i + 1 > s.today;
            return (
              <div key={i} className="group relative flex h-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-sm transition-colors ${
                    future ? "bg-background" : i + 1 === s.today ? "bg-accent" : "bg-accent/45 group-hover:bg-accent/80"
                  }`}
                  style={{ height: future ? "4%" : `${Math.max(3, (v / maxDay) * 100)}%` }}
                />
                {!future && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[11px] whitespace-nowrap text-background opacity-0 group-hover:opacity-100">
                    {i + 1} ม.ค. · ฿{formatBaht(v, true)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted">
          <span>1</span>
          <span>15</span>
          <span>31</span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-medium">ตามหมวด</h2>
          {/* แถบแนวนอนเรียงมากไปน้อย: อ่านชื่อหมวดไทยได้เต็ม และเทียบขนาดง่ายกว่า pie */}
          <ul className="mt-4 space-y-3.5">
            {s.categories.map(([cat, amount]) => (
              <li key={cat}>
                <div className="flex items-center gap-2.5 text-sm">
                  <CategoryIcon category={cat} size="sm" />
                  <span className="flex-1">{CATEGORY_LABELS[cat]}</span>
                  <span className="text-xs text-muted">{Math.round((amount / s.spent) * 100)}%</span>
                  <span className="w-16 text-right tabular-nums">฿{formatBaht(amount, true)}</span>
                </div>
                <div className="mt-1.5 ml-[34px] h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className={`h-full rounded-full ${CATEGORY_META[cat].bar}`}
                    style={{ width: `${(amount / s.categories[0][1]) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-medium">รายการล่าสุด</h2>
          <ul className="mt-2 divide-y divide-border">
            {s.recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <CategoryIcon category={t.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{t.receiver}</p>
                  <p className="text-xs text-muted">{formatThaiDateTime(t.paidAt)}</p>
                </div>
                <span className="text-sm tabular-nums">−฿{formatBaht(t.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-medium">จ่ายบ่อยสุด</h2>
        <ul className="mt-2 grid gap-x-8 divide-y divide-border md:grid-cols-2 md:divide-y-0">
          {s.top.map(([name, r]) => (
            <li key={name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate">{name}</p>
                <p className="text-xs text-muted">{r.count} ครั้ง</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {RECURRING_RECEIVERS.has(name) && (
                  <span className="flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs text-accent">
                    <Repeat className="size-3" aria-hidden />
                    ทุกเดือน
                  </span>
                )}
                <span className="tabular-nums">฿{formatBaht(r.total, true)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-medium tabular-nums">{value}</p>
    </div>
  );
}
