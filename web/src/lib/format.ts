import { BANK_LABELS, type Bank, type FieldName } from "./types";

const baht = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bahtWhole = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

export const formatBaht = (n: number, whole = false) => (whole ? bahtWhole : baht).format(n);

// วันที่แบบไทย พ.ศ. ย่อ เช่น "3 ม.ค. 69 09:15" — ตรงกับที่ผู้ใช้เห็นบนสลิป
export function formatThaiDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric", month: "short", year: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${date} ${time}`;
}

export function displayField(name: FieldName, value: string | null): string {
  if (value === null) return "—";
  if (name === "bank") return BANK_LABELS[value as Bank] ?? value;
  if (name === "amount") return `${formatBaht(Number(value))} บาท`;
  if (name === "paid_at") return formatThaiDateTime(value);
  return value;
}
