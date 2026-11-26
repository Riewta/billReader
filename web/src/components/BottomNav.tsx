"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOCK_SLIPS } from "@/lib/mock";

const TABS = [
  { href: "/", label: "ภาพรวม" },
  { href: "/upload", label: "อัปโหลด" },
  { href: "/review", label: "ตรวจ" },
];

export function BottomNav() {
  const pathname = usePathname();
  const toReview = MOCK_SLIPS.filter((s) => s.status === "needs_review").length;

  return (
    // แถบล่างแทนเมนูบน: นิ้วโป้งเอื้อมถึงบนมือถือ
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-surface">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-center gap-1.5 py-3 text-sm ${
                  active ? "font-medium text-accent" : "text-muted"
                }`}
              >
                {t.label}
                {t.href === "/review" && toReview > 0 && (
                  <span className="rounded-full bg-warn-soft px-1.5 text-xs text-warn">{toReview}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
