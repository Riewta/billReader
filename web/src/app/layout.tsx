import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { SlipsProvider } from "@/lib/store";
import "./globals.css";

// ฟอนต์ที่มีทั้งไทยและอังกฤษในชุดเดียว: ตัวเลข/เลขอ้างอิงกับชื่อไทยจะได้หน้าตาเข้ากัน
// next/font โหลดไฟล์มาเก็บในแอปตอน build ผู้ใช้ไม่ต้องยิงไป Google
const thai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SlipSense",
  description: "จดรายจ่ายอัตโนมัติจากสลิปโอนเงิน",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7f5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <SlipsProvider>
          <AppShell>{children}</AppShell>
        </SlipsProvider>
      </body>
    </html>
  );
}
