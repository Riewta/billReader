import { formatBaht } from "@/lib/format";
import { BY_CATEGORY, DAILY, MONTH, TOP_RECEIVERS } from "@/lib/mock";
import { CATEGORY_LABELS } from "@/lib/types";

// Dashboard: ตอบคำถามเดียวก่อน "เดือนนี้ใช้ไปเท่าไร เทียบงบแล้วโอเคไหม"
// ฟีเจอร์ที่ต้องมีข้อมูลสะสม (คาดสิ้นเดือน, วันผิดปกติ) เป็น Phase 5 จึงยังไม่ใส่
export default function DashboardPage() {
  const pct = Math.min(100, Math.round((MONTH.spent / MONTH.budget) * 100));
  const maxDay = Math.max(...DAILY);
  const maxCat = Math.max(...BY_CATEGORY.map((c) => c.amount));
  const today = 21; // mock: วันที่ 21 ของเดือน วันหลังจากนี้ยังไม่ถึง

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">{MONTH.label}</p>
        <h1 className="text-xl font-medium">ภาพรวม</h1>
      </header>

      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">ใช้ไปแล้ว</p>
        <p className="text-3xl font-medium tabular-nums">
          {formatBaht(MONTH.spent, true)} <span className="text-base font-normal text-muted">บาท</span>
        </p>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="สัดส่วนงบที่ใช้"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {pct}% ของงบ {formatBaht(MONTH.budget, true)} บาท · เหลือ {formatBaht(MONTH.budget - MONTH.spent, true)} บาท
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">รายวัน</h2>
        <div className="flex h-24 items-end gap-[3px] rounded-xl border border-border bg-surface p-3">
          {DAILY.map((v, i) => (
            <div
              key={i}
              title={`วันที่ ${i + 1}: ${formatBaht(v, true)} บาท`}
              className={`flex-1 rounded-sm ${i + 1 > today ? "bg-border/50" : "bg-accent/70"}`}
              style={{ height: `${Math.max(4, (v / maxDay) * 100)}%` }}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">ตามหมวด</h2>
        {/* แถบแนวนอนเรียงมากไปน้อย: อ่านชื่อหมวดภาษาไทยได้เต็ม และเทียบขนาดง่ายกว่า pie */}
        <ul className="space-y-3 rounded-xl border border-border bg-surface p-4">
          {BY_CATEGORY.map((c) => (
            <li key={c.category}>
              <div className="flex justify-between text-sm">
                <span>{CATEGORY_LABELS[c.category]}</span>
                <span className="tabular-nums text-muted">{formatBaht(c.amount, true)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">จ่ายบ่อยสุด</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {TOP_RECEIVERS.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">{r.name}</p>
                <p className="text-xs text-muted">{r.count} ครั้ง</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.recurring && (
                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs text-accent">ทุกเดือน</span>
                )}
                <span className="tabular-nums">{formatBaht(r.total, true)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
