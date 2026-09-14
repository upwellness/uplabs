# UP Labs — กติกาสำหรับคนและ AI ที่มาแก้โค้ดนี้

## 0. 📘 PRD เป็นเอกสารมีชีวิต — กฎเหล็ก

**ทุกครั้งที่แก้โค้ดแล้วฟีเจอร์เปลี่ยน / เพิ่ม route / เพิ่ม-แก้ตาราง / เปลี่ยน data model → ต้องอัปเดตเอกสารในคอมมิตเดียวกัน:**

| แก้อะไร | อัปเดตไฟล์ |
|---|---|
| ฟีเจอร์ · หน้าจอ · API · non-goal · ปัญหาค้าง | `docs/PRD-UPLabs.md` **และ** `docs/PRD-UPLabs.html` |
| ตาราง · ความสัมพันธ์ · data flow · โมดูล · security | `docs/ARCHITECTURE.md` **และ** `docs/ARCHITECTURE.html` |
| ทุกกรณี | เติม 1 บรรทัดใน **Changelog** ท้าย PRD (วันที่ · ทำอะไร · commit) |

> เอกสารที่ไม่ตรงกับโค้ด = เอกสารที่หลอกคนอ่าน — ถ้าไม่มีเวลาแก้เอกสาร ให้ถือว่างานยังไม่เสร็จ

## 1. สถาปัตยกรรมที่ห้ามพัง

1. **`customers` คือแกนกลาง** — ฟีเจอร์ใหม่ที่เกี่ยวกับคน **ต้องมี `customer_id`** ห้ามสร้างเกาะข้อมูลใหม่
2. **ตรรกะคลินิกอยู่ใน `lib/` เท่านั้น** — หน้าเว็บห้ามตัดสินเกณฑ์เอง
3. **เกณฑ์/สีสถานะ** ใช้ `lib/medical-status.ts` ที่เดียว (ห้าม hardcode ซ้ำ)
4. **API route = ด่านตรวจสิทธิ์** และเป็นที่เดียวที่คุยกับบริการภายนอก
5. เพิ่มแอปใหม่ → ลงทะเบียนใน `lib/apps-registry.ts` + เพิ่มลิงก์ v2 ใน `app/v2/_components/Shell.tsx`

## 2. กติกาที่พลาดบ่อย (เคยพังมาแล้ว)

- **AI = BYO key** — Gemini key อยู่ใน browser (`localStorage['uplabs_gemini_key']`) **ไม่มี fallback ฝั่ง server** · error เรื่องคีย์ต้องโชว์ `GeminiKeyErrorNotice` (ชวนไปขอคีย์) **ห้ามโชว์ error ดิบ** · ใช้ `lib/gemini-error.ts` เสมอ
  **ข้อยกเว้นที่บันทึกไว้ 3 ข้อ (ใช้ `GEMINI_API_KEY` ฝั่งเซิร์ฟเวอร์ เพราะผู้ใช้ปลายทางไม่มีคีย์):** ① `lib/pulse/gemini.ts` (UP Pulse master) ② `/api/my/<token>/food` — ลูกค้าประเมินอาหารใน portal · เพดาน `PORTAL_DAILY_AI_CAP` 40/คน/วัน ③ `/api/my/<token>/explain` — "ให้ AI อธิบาย" ใน portal (14 ก.ย. 2026 · SPEC-Mobile-Portal Q1) · เพดาน `PORTAL_EXPLAIN_CAP` 20/คน/วัน · โมเดลได้รับเฉพาะค่าที่ engine ตัดสินแล้ว · คำตอบผ่าน `validateAnswer` (ตัวเลข ⊆ อินพุต · ไม่มีคำวินิจฉัย/ยา/สินค้า) ไม่งั้นตกไปใช้ข้อความของระบบ · **ห้ามเพิ่มข้อยกเว้นที่ 4 โดยไม่บันทึกที่นี่**
- **`NEXT_PUBLIC_SITE_URL` = `https://upwellness-ops.vercel.app`** (ห้ามมี `/` ท้าย · ห้ามใช้ `upwellness.vercel.app` ซึ่งเป็น**เว็บไซต์คนละตัว**) — เคยทำให้ลิงก์ invite/reset 404
- **repo นี้ public** — ห้าม commit PII (รายงานสุขภาพ ชื่อลูกค้า ผลแล็บ) หรือคีย์ · รายงานลูกค้าเก็บใน `customer_report_html`
- **ค่าสุขภาพต้องมาจากข้อมูลจริง** — อ่านจากไฟล์/ฐานข้อมูล ห้ามเดาหรือกะจากภาพ
- **Next.js แคช `fetch` ใน GET handler** — supabase-js ยิงผ่าน fetch ตัวเดียวกัน จึงได้คำตอบเก่าจากฐานข้อมูล · `dynamic = "force-dynamic"` **ไม่ช่วย** (คุมแค่ render) · `createAdminClient()` บังคับ `cache: "no-store"` ไว้แล้ว **ห้ามถอดออก** — เคยทำให้ token ที่เพิกถอนแล้วยังเรียก API ได้
- Compliance: wellness ≠ diagnosis · ผลผิดปกติ → "ปรึกษาแพทย์" · อาหารเสริมต้องผ่านเภสัชกร + แพทย์

## 3. ก่อน push

```bash
npm test && npx tsc --noEmit && npm run docs && npm run build
```

- `npm test` — ชุดทดสอบ (node:test) ของตรรกะบริสุทธิ์ · **ห้ามให้ตรรกะที่ตัดสินใจแทนคนอยู่ในไฟล์ที่ import ฐานข้อมูล** ไม่งั้นเทสต์ไม่ได้ (ดู `lib/api/compare.ts` แยกจาก `lib/api/data.ts` เป็นตัวอย่าง)
- `npm run docs` — regenerate `docs/*.html` จาก `.md` · **ห้ามแก้ .html มือ จะถูกทับ**
push ไป `upwellness/uplabs` (branch `main`) → Vercel deploy อัตโนมัติ · ใช้ GitHub account **upwellness** (`gh auth switch -u upwellness`) และ `git fetch && git rebase origin/main` ก่อนเสมอ

## 4. Next.js

เวอร์ชันนี้มี breaking changes จากที่โมเดลเคยเรียนรู้ — อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดที่ไม่มั่นใจ

---
📄 เอกสารหลัก: [`docs/PRD-UPLabs.md`](./docs/PRD-UPLabs.md) · [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (มีเวอร์ชัน `.html` อ่านง่ายคู่กัน)
