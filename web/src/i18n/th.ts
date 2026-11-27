// พจนานุกรมภาษาไทย = ต้นแบบ: en.ts ต้องมี key ครบตามนี้ (TypeScript บังคับ)
// ข้อความที่มีตัวเลขเป็นฟังก์ชัน เพราะลำดับคำต่างกันในแต่ละภาษา ต่อสตริงเองไม่ได้

export const th = {
  meta: { description: "จดรายจ่ายอัตโนมัติจากสลิปโอนเงิน" },
  nav: { dashboard: "ภาพรวม", upload: "อัปโหลด", review: "ตรวจสลิป", main: "เมนูหลัก", language: "ภาษา" },
  privacy: "รูปสลิปถูกลบหลังยืนยัน เก็บไว้แค่ยอด วันเวลา และผู้รับ",

  fields: { bank: "ธนาคาร", amount: "ยอดเงิน", paid_at: "วันเวลา", receiver_name: "ผู้รับ", ref: "เลขอ้างอิง" },
  banks: {
    kbank: "กสิกรไทย", scb: "ไทยพาณิชย์", ktb: "กรุงไทย", bbl: "กรุงเทพ",
    krungsri: "กรุงศรี", ttb: "ttb", gsb: "ออมสิน",
  },
  bankPrefix: "ธ.",
  categories: {
    food: "อาหาร", transport: "เดินทาง", shopping: "ช้อปปิ้ง",
    bills: "บิล", transfer: "โอนให้คน", other: "อื่น ๆ",
  },
  status: {
    processing: "กำลังอ่าน…", ready: "อ่านแล้ว", needs_review: "ต้องตรวจ",
    duplicate: "ซ้ำ ข้ามให้", unreadable: "อ่านไม่ได้",
  },
  baht: "บาท",
  unknownReceiver: "ไม่ทราบผู้รับ",

  dashboard: {
    title: "ภาพรวม",
    uploadCta: "อัปโหลดสลิป",
    pendingBanner: (n: number) => `มี ${n} สลิปรอตรวจ ยังไม่ถูกนับในยอดด้านล่าง`,
    spent: "ใช้ไปแล้วเดือนนี้",
    budgetUsed: (pct: number) => `${pct}% ของงบ`,
    budget: (amt: string) => `งบ ${amt}`,
    budgetLabel: "สัดส่วนงบที่ใช้",
    remaining: "เหลือใช้ได้",
    perDay: (days: number) => `ใช้ได้ต่อวัน (${days} วันที่เหลือ)`,
    daily: "รายวัน",
    txCount: (n: number) => `${n} รายการ`,
    dayTip: (day: number, amt: string) => `${day} ม.ค. · ${amt}`,
    byCategory: "ตามหมวด",
    recent: "รายการล่าสุด",
    top: "จ่ายบ่อยสุด",
    times: (n: number) => `${n} ครั้ง`,
    monthly: "ทุกเดือน",
  },

  upload: {
    title: "อัปโหลดสลิป",
    subtitle: "เลือกได้หลายรูปพร้อมกัน ระบบอ่านต่อเบื้องหลัง ปิดหน้านี้ได้เลย",
    pick: "เลือกรูปสลิป",
    drop: "วางรูปที่นี่",
    hint: "แตะเพื่อเลือกจากแกลเลอรี หรือลากไฟล์มาวาง · JPG, PNG",
    demoNote: "เวอร์ชันตัวอย่าง: รูปไม่ถูกส่งออกจากเครื่อง ใช้แค่ชื่อไฟล์จำลองผลการอ่าน",
    latest: "รอบล่าสุด",
    countProcessing: (n: number) => `กำลังอ่าน ${n}`,
    countReady: (n: number) => `พร้อม ${n}`,
    countReview: (n: number) => `ต้องตรวจ ${n}`,
    reading: "กำลังอ่าน…",
    duplicateNote: "เลขอ้างอิงซ้ำกับรายการเดิม ไม่นับยอดซ้ำ",
    remove: (file: string) => `เอา ${file} ออก`,
    confirmReady: (n: number) => `ยืนยัน ${n} รายการที่มั่นใจ`,
    reviewCta: (n: number) => `ตรวจ ${n} รายการที่ไม่แน่ใจ`,
  },

  review: {
    title: "ตรวจสลิป",
    subtitle: "ดูแค่จุดสีเหลือง ช่องอื่นระบบมั่นใจแล้ว",
    progress: "ตรวจแล้ว",
    allSure: (n: number) => `มั่นใจทุกช่อง ${n} รายการ`,
    confirmAll: "ยืนยันทั้งหมด",
    position: (i: number, n: number) => `ใบที่ ${i} จาก ${n}`,
    unclear: "อ่านได้ไม่ชัด ตรวจกับกรอบสีเหลืองบนสลิป",
    qrLocked: "อ่านจาก QR บนสลิป ตรงตัว จึงแก้ไม่ได้",
    edit: (field: string) => `แก้${field}`,
    category: "หมวด",
    skip: "ข้ามไว้ก่อน",
    confirm: "ยืนยัน แล้วไปใบถัดไป",
    enterHint: "กด Enter เพื่อยืนยัน",
    emptyTitle: "ไม่มีสลิปรอตรวจ",
    emptyDone: (n: number) => `ตรวจไป ${n} รายการ รูปสลิปถูกลบหลังยืนยันแล้ว`,
    emptyIdle: "อัปโหลดสลิปใหม่เมื่อไรก็ได้",
    uploadMore: "อัปโหลดเพิ่ม",
    toDashboard: "ดูภาพรวม",
    errAmountFormat: "ใส่ตัวเลข เช่น 129.50",
    errAmountPositive: "ยอดต้องมากกว่า 0",
    errReceiver: "ใส่ชื่อผู้รับ",
  },

  slip: {
    success: "ทำรายการสำเร็จ",
    date: "วันที่ทำรายการ",
    from: "จาก",
    yourAccount: "บัญชีของคุณ",
    to: "ไปยัง",
    amount: "จำนวนเงิน",
    ref: "เลขที่รายการ",
    checkHere: "ตรวจตรงนี้",
    caption: "สลิปจำลอง · ของจริงจะซูมไปที่กรอบสีเหลือง",
  },

  toast: {
    confirmed: "ยืนยันแล้ว",
    confirmedMany: (n: number) => `ยืนยัน ${n} รายการ`,
    removed: "เอาสลิปซ้ำออกแล้ว",
    undo: "เลิกทำ",
    close: "ปิด",
  },
};

export type Dictionary = typeof th;
