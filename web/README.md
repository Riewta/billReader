# web/ — SlipSense PWA (Next.js)

หน้าจอตาม [wireframe](../docs/design/wireframes.md): ภาพรวม (`/`), อัปโหลด (`/upload`), ตรวจและแก้ (`/review`)

**สถานะ: ใช้ข้อมูลปลอม** (`src/lib/mock.ts`) ยังไม่ได้ต่อ API (Phase 2)
`src/lib/types.ts` คือร่างสัญญาข้อมูลที่ API ต้องส่งมา รวมถึงความมั่นใจราย field ที่ parser ยังไม่มี

```bash
cd web
npm install
npm run dev      # http://localhost:3000 (เปิดโหมดมือถือใน devtools: ออกแบบ mobile-first)
npm run lint
npm run build
```

ข้อมูลใน `mock.ts` ต้องเป็นของปลอมเสมอ เพราะไฟล์นี้ถูก commit
