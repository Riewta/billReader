// ภาษาที่รองรับ: ไทยเป็นค่าเริ่มต้น เพราะผู้ใช้หลักคือคนไทยที่มีสลิปธนาคารไทย
export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";

// cookie จำภาษาที่ผู้ใช้เลือกเอง (ชนะ Accept-Language ของเบราว์เซอร์)
// เก็บแค่รหัสภาษา ไม่ใช่ข้อมูลส่วนตัว
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const hasLocale = (s: string): s is Locale => (LOCALES as readonly string[]).includes(s);

// สลับภาษาใน path: /th/review -> /en/review
export function swapLocale(pathname: string, to: Locale): string {
  const parts = pathname.split("/");
  if (hasLocale(parts[1] ?? "")) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join("/") || `/${to}`;
}
