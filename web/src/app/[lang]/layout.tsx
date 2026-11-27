import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LOCALES, hasLocale } from "@/i18n/config";
import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/provider";
import { th } from "@/i18n/th";
import { SlipsProvider } from "@/lib/store";
import "../globals.css";

// ฟอนต์ที่มีทั้งไทยและอังกฤษในชุดเดียว: ใช้ได้ทั้งสองภาษา หน้าตาไม่เปลี่ยนเวลาสลับ
// next/font โหลดไฟล์มาเก็บในแอปตอน build ผู้ใช้ไม่ต้องยิงไป Google
const thai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500"],
});

// render ล่วงหน้าทั้ง /th และ /en ตอน build; ภาษาอื่น (เช่น /fr) -> notFound() ใน layout ด้านล่าง
// (ไม่ใช้ dynamicParams = false เพราะใช้ร่วมกับ cacheComponents ที่เปิดอยู่ไม่ได้)
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = lang === "en" ? en : th;
  return {
    title: "SlipSense",
    description: t.meta.description,
    // บอก search engine ว่าหน้านี้มีอีกภาษา
    alternates: { languages: { th: "/th", en: "/en" } },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7f5",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    // lang ที่ถูกต้องสำคัญ: screen reader เลือกเสียงอ่านตามนี้ และเบราว์เซอร์ใช้ตัดคำ/เลือกฟอนต์ไทย
    <html lang={lang} className={`${thai.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <I18nProvider lang={lang}>
          <SlipsProvider>
            <AppShell>{children}</AppShell>
          </SlipsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
