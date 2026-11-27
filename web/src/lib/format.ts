import { BANK_LABELS, type Bank, type FieldName } from "./types";

const baht = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bahtWhole = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

export const formatBaht = (n: number, whole = false) => (whole ? bahtWhole : baht).format(n);

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// วันที่แบบไทย พ.ศ. ย่อ เช่น "3 ม.ค. 69 09:15" — ตรงกับที่ผู้ใช้เห็นบนสลิป
// แยกจากสตริงตรง ๆ ไม่ผ่าน Date: เวลาบนสลิปเป็นเวลาไทยอยู่แล้ว ถ้าแปลงผ่าน timezone ของเครื่อง
// server กับเบราว์เซอร์อาจได้คนละค่า (hydration mismatch) หรือเวลาเลื่อนถ้าผู้ใช้อยู่ต่างประเทศ
export function formatThaiDateTime(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d, hh, mm] = m;
  const be = String(Number(y) + 543).slice(2);
  return `${Number(d)} ${TH_MONTHS[Number(mo) - 1]} ${be} ${hh}:${mm}`;
}

export function displayField(name: FieldName, value: string | null): string {
  if (value === null) return "—";
  if (name === "bank") return BANK_LABELS[value as Bank] ?? value;
  if (name === "amount") return `${formatBaht(Number(value))} บาท`;
  if (name === "paid_at") return formatThaiDateTime(value);
  return value;
}
