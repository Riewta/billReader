"use client";

// ส่งภาษา + พจนานุกรม + ฟังก์ชันจัดรูปแบบ ให้ทุก client component
// โหลดทั้งสองภาษาเข้า bundle เลย (รวมกันไม่กี่ KB) แลกกับสลับภาษาได้ทันทีโดยไม่ต้องโหลดเพิ่ม
// พจนานุกรมมีฟังก์ชัน (ข้อความที่มีตัวเลข) จึงส่งจาก server เป็น props ไม่ได้ ต้อง import ฝั่ง client

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { en } from "./en";
import { th, type Dictionary } from "./th";
import type { Bank, FieldName } from "@/lib/types";

const DICTS: Record<Locale, Dictionary> = { th, en };

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type I18n = {
  lang: Locale;
  t: Dictionary;
  href: (path: string) => string;
  baht: (n: number, whole?: boolean) => string;
  dateTime: (iso: string) => string;
  field: (name: FieldName, value: string | null) => string;
};

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ lang, children }: { lang: Locale; children: ReactNode }) {
  const value = useMemo<I18n>(() => {
    const t = DICTS[lang];
    const nf = new Intl.NumberFormat(lang === "th" ? "th-TH" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const nfWhole = new Intl.NumberFormat(lang === "th" ? "th-TH" : "en-US", { maximumFractionDigits: 0 });
    // สัญลักษณ์ ฿ ใช้ทั้งสองภาษา: เป็นสกุลเงินของข้อมูล ไม่ใช่ของภาษา UI
    const baht = (n: number, whole = false) => `฿${(whole ? nfWhole : nf).format(n)}`;

    // แยกจากสตริงตรง ๆ ไม่ผ่าน Date: เวลาบนสลิปเป็นเวลาไทยอยู่แล้ว
    // แปลงผ่าน timezone ของเครื่อง server กับเบราว์เซอร์อาจได้ไม่ตรงกัน (hydration mismatch)
    // ไทย: ปี พ.ศ. 2 หลักเหมือนบนสลิป · อังกฤษ: ปี ค.ศ.
    const dateTime = (iso: string) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
      if (!m) return iso;
      const [, y, mo, d, hh, mm] = m;
      const mi = Number(mo) - 1;
      return lang === "th"
        ? `${Number(d)} ${TH_MONTHS[mi]} ${String(Number(y) + 543).slice(2)} ${hh}:${mm}`
        : `${Number(d)} ${EN_MONTHS[mi]} ${y}, ${hh}:${mm}`;
    };

    const field = (name: FieldName, value: string | null) => {
      if (value === null) return "—";
      if (name === "bank") return t.banks[value as Bank] ?? value;
      if (name === "amount") return baht(Number(value));
      if (name === "paid_at") return dateTime(value);
      return value;
    };

    return { lang, t, href: (path) => `/${lang}${path === "/" ? "" : path}`, baht, dateTime, field };
  }, [lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n ต้องอยู่ใต้ <I18nProvider>");
  return v;
}
