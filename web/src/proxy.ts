import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, hasLocale, type Locale } from "@/i18n/config";

// เข้า / หรือ path ที่ไม่มีภาษา -> redirect ไป /th/... หรือ /en/...
// ลำดับการเลือก: ภาษาที่ผู้ใช้เคยเลือกเอง (cookie) > ภาษาของเบราว์เซอร์ > ไทย
function pickLocale(req: NextRequest): Locale {
  const saved = req.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && hasLocale(saved)) return saved;
  // Accept-Language เช่น "en-US,en;q=0.9,th;q=0.8": เรียงตาม q แล้วเอาตัวแรกที่รองรับ
  // เขียนเองแทนไลบรารี: รองรับแค่ 2 ภาษา ไม่คุ้มเพิ่ม dependency
  const prefs = (req.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return prefs.find((p) => hasLocale(p.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  const url = req.nextUrl.clone();
  url.pathname = `/${pickLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // ข้ามไฟล์ภายในของ Next และไฟล์ที่มีนามสกุล (favicon.ico, รูปใน public/)
  matcher: ["/((?!_next|.*\\..*).*)"],
};
