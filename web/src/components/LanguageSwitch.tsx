"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, swapLocale, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

const LABEL: Record<Locale, string> = { th: "ไทย", en: "EN" };

// ปุ่มสลับภาษาเป็น <Link> ไม่ใช่ปุ่ม JS: เปิดแท็บใหม่/คัดลอกลิงก์ภาษานั้นได้ และใช้ได้แม้ JS ยังโหลดไม่เสร็จ
// ชื่อภาษาเขียนเป็นภาษาของมันเอง ("ไทย"/"EN") ไม่แปล: คนที่อ่านภาษาปัจจุบันไม่ออกก็ยังหาเจอ
export function LanguageSwitch() {
  const pathname = usePathname();
  const { lang, t } = useI18n();

  return (
    <div role="group" aria-label={t.nav.language} className="flex rounded-lg bg-background p-0.5 text-xs">
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={swapLocale(pathname, l)}
          hrefLang={l}
          lang={l}
          aria-current={l === lang ? "true" : undefined}
          onClick={() => {
            // จำภาษาที่เลือกไว้ 1 ปี: ครั้งหน้าเข้า / จะได้ภาษานี้เลย
            document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
          }}
          className={`rounded-md px-2.5 py-1 transition-colors ${
            l === lang ? "bg-surface font-medium text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          {LABEL[l]}
        </Link>
      ))}
    </div>
  );
}
