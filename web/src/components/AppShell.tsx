"use client";

import { LayoutDashboard, Lock, ScanSearch, Upload, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import type { Dictionary } from "@/i18n/th";
import { useSlips } from "@/lib/store";
import { LanguageSwitch } from "./LanguageSwitch";
import { Toaster } from "./Toaster";

const NAV: { path: string; key: keyof Dictionary["nav"]; icon: LucideIcon }[] = [
  { path: "/", key: "dashboard", icon: LayoutDashboard },
  { path: "/upload", key: "upload", icon: Upload },
  { path: "/review", key: "review", icon: ScanSearch },
];

function Logo() {
  const { href } = useI18n();
  return (
    <Link href={href("/")} className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-medium text-white dark:text-background">
        S
      </span>
      <span className="font-medium tracking-tight">SlipSense</span>
    </Link>
  );
}

// มือถือ: แถบล่าง (นิ้วโป้งเอื้อมถึง) · เดสก์ท็อป: แถบข้าง (จอกว้าง ไม่ต้องเลื่อนลงไปหาเมนู)
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { slips } = useSlips();
  const { t, href: to } = useI18n();
  const toReview = slips.filter((s) => s.status === "needs_review").length;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <div className="flex items-center justify-between px-2">
          <Logo />
          <LanguageSwitch />
        </div>
        <nav className="mt-8 space-y-1" aria-label={t.nav.main}>
          {NAV.map(({ path, key, icon: Icon }) => {
            const href = to(path);
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                <span className="flex-1">{t.nav[key]}</span>
                {path === "/review" && toReview > 0 && (
                  <span className="rounded-full bg-warn-soft px-2 text-xs text-warn">{toReview}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto flex items-start gap-2 rounded-lg bg-background px-3 py-2.5 text-xs leading-relaxed text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t.privacy}
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-surface/90 px-4 backdrop-blur md:hidden">
          <Logo />
          <div className="ml-auto">
            <LanguageSwitch />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label={t.nav.main}
      >
        <ul className="grid grid-cols-3">
          {NAV.map(({ path, key, icon: Icon }) => {
            const href = to(path);
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                    active ? "font-medium text-accent" : "text-muted"
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                  {t.nav[key]}
                  {path === "/review" && toReview > 0 && (
                    <span className="absolute top-1 left-1/2 ml-2 min-w-4 rounded-full bg-warn px-1 text-center text-[10px] leading-4 text-white dark:text-background">
                      {toReview}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Toaster />
    </div>
  );
}
