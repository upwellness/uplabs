# PRD — UP Labs (upwellness-ops)

> **Product:** UP Labs · Health Intelligence Platform for UP Wellness
> **Live:** `https://upwellness-ops.vercel.app` · repo `upwellness/uplabs` · Next.js 16 (App Router) + Supabase
> **Version:** 1.0 · **Updated:** 2026-07-16 · **Owner:** ต้น (Chaiwat)
> **Status:** production · v2 UI is the primary surface, v1 still live

> ⚠️ **LIVING DOCUMENT — กติกา:** ทุกครั้งที่แก้โค้ดแล้ว **ฟีเจอร์เปลี่ยน / เพิ่ม route / เพิ่มตาราง / เปลี่ยน data model** ต้องอัปเดต PRD นี้ **และ** `PRD-UPLabs.html` + `ARCHITECTURE.md/.html` ในคอมมิตเดียวกัน แล้วเติม 1 บรรทัดใน §11 Changelog เสมอ

---

## 1. Product Overview

UP Labs คือ **แพลตฟอร์มภายในของ UP Wellness** ที่รวบรวมข้อมูลสุขภาพของลูกค้าทุกช่องทางไว้ที่เดียว แล้วเปลี่ยนเป็น *คำแนะนำที่ลงมือได้* สำหรับโค้ช/ที่ปรึกษา (ABO) — ไม่ใช่เครื่องมือขายของ แต่เป็น **เครื่องมือดูแลคน**

**Problem:** ข้อมูลลูกค้ากระจัดกระจาย (ใบแล็บกระดาษ · เครื่องชั่ง BCA · นาฬิกา · CGM · แชท LINE) โค้ชต้องจำเอง → คำแนะนำไม่ต่อเนื่อง พิสูจน์ผลไม่ได้

**Solution:** ศูนย์กลางเดียว = **Customer Profile** ที่ทุกโมดูลเขียนเข้า/อ่านออก + ชั้น AI ช่วยแปลผล + ลิงก์สาธารณะให้ลูกค้ากรอก/เชื่อมข้อมูลเองได้

**Principles**
1. **Customer profile เป็นแกนกลาง** — ทุกฟีเจอร์ต้องผูกกับ `customers.id` (ดู [ARCHITECTURE.md](./ARCHITECTURE.md))
2. **Evidence over vibes** — ตัวเลขจริงจากใบตรวจ/อุปกรณ์ ห้ามเดา
3. **Wellness ≠ diagnosis** — ผิดปกติ → "ปรึกษาแพทย์" เสมอ ห้ามเคลมรักษา
4. **โค้ชเร็วขึ้น ไม่ใช่โค้ชถูกแทนที่** — AI สรุป/จัดลำดับ คนตัดสินใจ

---

## 2. Users & Roles

| Role | ใคร | เห็นอะไร |
|---|---|---|
| `admin` | ต้น / ผู้ดูแลระบบ | ทุกอย่าง + จัดการผู้ใช้ + backup/restore + view-as |
| `abo` | นักธุรกิจ/โค้ช UP Wellness | ลูกค้าของตัวเอง + **ลูกค้าของสายงานทุกระดับชั้นลงไป (ดูแลได้เต็มที่ อ่าน+เขียน)** + ทุกแอปที่ได้รับสิทธิ์ |
| *(public link)* | ลูกค้า / ผู้สนใจ | เฉพาะหน้า token-gated ที่ถูกส่งลิงก์ให้ (ไม่ต้องล็อกอิน) |

- **Downline (MLM):** `profiles.parent_id` → ผู้ถูกเชิญกลายเป็น downline ของผู้เชิญอัตโนมัติ · **upline ดูแลลูกค้าของสายงานได้ทุกระดับชั้นลงไป ทั้งดูและแก้ไข** (เปลี่ยนจาก read-only เมื่อ 24 ก.ค. 2026 ตามที่ต้นเคาะ) · ใช้ helper เดียว `lib/customers/access.ts → canManageCustomer()` ห้ามเขียนเช็คสิทธิ์เอง
- **App grants:** `user_app_grants` เปิด/ปิดแอปรายคนได้
- **View-as:** admin สวมมุมมองผู้ใช้อื่นเพื่อ support (ทุกครั้งลง `admin_view_as_log`)

---

## 3. Surface Map (v1 / v2)

**v2 = surface หลัก** (`/v2/*`, ใช้ `app/v2/_components/Shell.tsx` — top bar + app switcher + breadcrumb + user menu) · v1 ยังเปิดอยู่สำหรับหน้าที่ยังไม่ย้าย

| | v1 | v2 | สถานะ |
|---|---|---|---|
| หน้าแรก / app hub | `/` | `/v2` | ✅ ทั้งคู่ |
| Customer 360 | `/customers`, `/customers/[id]` | `/v2/customers`, `/v2/customers/[id]` | ✅ v2 หลัก |
| BCA Tracker | `/bca` | `/v2/bca` | ✅ |
| Health Age (PhenoAge) | — | `/v2/bio-age` | ✅ v2 only |
| UP Pulse | `/pulse`, `/pulse/master/[id]`, `/pulse/report/[id]`, `/pulse/assessments/[id]` | มีครบใน `/v2/pulse/*` | ✅ |
| Check FORM | `/checkform` | `/v2/checkform` | ✅ |
| Prospect List | `/prospects` | `/v2/prospects` | ✅ |
| Health Check (leads) | `/healthcheck` | `/v2/healthcheck` | ✅ |
| NutriScan + Food Log | `/nutriscan`, `/nutriscan/log` | `/v2/nutriscan`, `/v2/nutriscan/log` | ✅ |
| Plate Planner | `/plate-planner` | `/v2/plate-planner`, `/v2/plate-planner/guide` | ✅ |
| LINE Bot (น้องจาน) | `/line-bot`, `/line-bot/[customerId]` | `/v2/line-bot/*` | ✅ |
| Program Designer | `/designer` | `/v2/designer` | ✅ |
| CGM Analyzer | `/cgm` | — | v1 only |
| Admin · users / backup | `/admin/users`, `/admin/backup` | `/v2/admin/*` | ✅ |
| ชวนสมาชิก (invite) | — | `/v2/invite` | ✅ v2 only |
| SAB slides | `/sab` | — | v1 only |
| Setup / diagnostics | `/setup` | — | internal |

**Public (token-gated, ไม่ต้องล็อกอิน):** `/join/[token]` (สมัครจากคำเชิญ) · `/connect/[token]` + `/connect/[token]/success` + `/connect/error` (เชื่อมนาฬิกา) · `/intake/[token]` (แบบสอบถาม Pulse) · `/check/[coachId]` + `/metaflex/[coachId]` (แบบประเมินสาธารณะ) · `/r/[token]` (แชร์รายงาน) · `/login`, `/forgot-password`, `/reset-password`

---

## 4. Feature Inventory (โมดูลต่อโมดูล)

### 4.1 Customer 360 — หัวใจของระบบ
**หน้า:** `/v2/customers`, `/v2/customers/[id]` · **API:** `/api/customers`, `/api/customers/list`, `/api/customers/[id]`, `/api/customers/[id]/360`

รวมทุกอย่างของลูกค้า 1 คนไว้หน้าเดียว — identity + สถานะสุขภาพ + insight + timeline + แท็บ:

| แท็บ | เนื้อหา | ตาราง |
|---|---|---|
| Labs / Trends | ผลเลือดทุกครั้ง + กราฟแนวโน้ม + สถานะ (ปกติ/สูง/ต่ำ) | `customer_records`, `customer_lab_values` |
| Body Map | จุดผิดปกติบนภาพร่างกาย (`lib/records/body-map.ts`) | `customer_lab_values` |
| BCA | น้ำหนัก/ไขมัน/กล้ามเนื้อ/visceral/body-age | `measurements` |
| Allergy | ผลทดสอบภูมิแพ้อาหาร | `customer_allergy_tests`, `customer_food_allergens` |
| CGM | น้ำตาลต่อเนื่อง + มื้ออาหาร | `cgm_profiles`, `cgm_readings`, `cgm_meals` |
| Supplements | ตารางอาหารเสริม + ความปลอดภัยคู่ยา | `supplement_schedule`, `customer_supplement_safety` |
| Pulse | ข้อมูลนาฬิกา + assessment | `pulse_*`, `whoop_*`, `biomarker_readings` |
| Notes | โน้ตโค้ช (ปักหมุดได้) | `coach_notes` |

**ฟีเจอร์ย่อย:** health score + insight rules (`lib/customers/health-score.ts`, `insight-rules.ts`, `status-classifier.ts`) · Med-Map report (`/api/customers/[id]/med-map`) · เก็บรายงาน HTML ส่วนตัว (`customer_report_html` + `/api/customers/[id]/lab-report`) · access control (`lib/customers/access.ts`: เจ้าของ / ผู้ได้รับมอบหมาย / downline) · view log (`customer_view_log`)

### 4.2 BCA Tracker + Health Age
- **BCA:** บันทึกผลเครื่องชั่ง → เกจสถานะ + กราฟย้อนหลัง + แก้/ลบ + ออกรายงาน · `/api/customers/[id]/measurements`, `/api/measurements/[id]`, `/api/bca/classify`
- **เกณฑ์เดียวทั้งระบบ:** `lib/medical-status.ts` = single source of truth (5 ระดับ traffic-light + ป้ายไทยตามเกณฑ์คลินิก) ใช้ทั้งเกจ v2, BCA Scan Reveal, และ labs
- **Health Age (PhenoAge · Levine 2018):** `lib/bio-age.ts` + `/v2/bio-age` + `/api/customers/[id]/bio-age` — คำนวณอายุสุขภาพจาก 9 marker · โหมด hybrid (เติมค่าที่ขาดด้วยค่าประชากรตามอายุ + ป้าย "ประมาณ") · **Customer 360 จะโชว์เลขก็ต่อเมื่อมี CRP + RDW จริง**

### 4.3 UP Pulse — Wearables & Assessment
- **เชื่อมอุปกรณ์:** Whoop (OAuth + CSV import) · Apple Health (อัปโหลด export.xml) · Google Fit (OAuth — ⚠️ deprecated, ดู §9)
- **Flow ลูกค้า:** โค้ชสร้าง invite → ลูกค้าเปิด `/connect/[token]` บนมือถือ → ยินยอม → ระบบดึงข้อมูล
- **แบบสอบถาม:** `/intake/[token]` → `pulse_intakes` → ประเมิน (`lib/pulse/assess.ts`) → `pulse_assessments`
- **รายงาน:** `/pulse/report/[id]` (`lib/pulse/wearable-report.ts` รวมทุก provider เป็น report เดียว) + แชร์ผ่าน `/r/[token]`
- **API:** `/api/pulse/{invites,intakes,oauth,whoop,apple,customers/[id]/{sync,assess,cgm-link,debug},share/[token]}`

### 4.4 CGM Analyzer
`/cgm` + `/api/cgm/passcode` — น้ำตาลต่อเนื่อง + มื้ออาหาร · เข้าถึงผ่าน **passcode ต่อ profile** (RLS + SECURITY DEFINER RPC) · ตาราง `cgm_readings` (ใหญ่สุดในระบบ ~34k แถว), `cgm_meals`, `cgm_profiles`

### 4.5 NutriScan AI + Food Log
`/v2/nutriscan`, `/v2/nutriscan/log` · `/api/nutriscan`, `/api/nutriscan/[id]` · `lib/nutriscan/gemini-vision.ts` + `macros.ts`
ถ่ายรูปอาหาร → Gemini Vision วิเคราะห์ → มาโคร + ผลต่อน้ำตาล + คะแนนสุขภาพ + คำแนะนำ → บันทึกเข้า `nutriscan_scans` (ผูกลูกค้าได้)

### 4.6 Plate Planner + LINE Bot (น้องจาน)
- **Plate Planner:** `lib/plate-planner/engine.ts` — จัดจานแบบ Muscle-Centric (Dr. Gabrielle Lyon) · อาหารไทยไม่ซ้ำ · สร้างภาพจานด้วย AI (`/api/plate-image`, แคช Supabase Storage) · ตั้งค่าต่อลูกค้าใน `plate_plan_config`
- **LINE Bot:** `/api/line/webhook`, `/api/line/push-tomorrow`, `/api/line-bot/*` — ผูกกลุ่ม LINE กับลูกค้า (`line_bot_groups`) → ส่งเมนู+วิตามินอัตโนมัติ 18:00 · log ที่ `line_bot_logs`

### 4.7 Check FORM — AI Prospect Analysis
`/v2/checkform` · `/api/checkform/{analyze,recommend-clips,records}` · `lib/checkform/{ai-analyze,clip-matcher}.ts`
กรอกโปรไฟล์ผู้มุ่งหวัง + DISC → Gemini วิเคราะห์: แนวทางเข้าหา · สัดส่วน product/business · บทสนทนาตัวอย่าง · roleplay · red flags → **จับคู่คลิป STP** ที่ควรให้ฟัง (reasoning-based ไม่ใช่สูตร) · cache ผลใน `checkform_records`

### 4.8 Prospect / Lead Pipeline
- **Prospect List** `/v2/prospects` + `/api/prospects/[id]/convert` → แปลงเป็น Check FORM record (`prospect_list`)
- **Health Check (leads)** `/v2/healthcheck` + `/api/healthcheck/leads` — แบบประเมินสาธารณะ `/check/[coachId]`, `/metaflex/[coachId]` → `healthcheck_leads` (ผูกเป็นลูกค้าได้)
- ตารางเสริม: `leads`, `metabolic_leads`, `aw_prospects`, `warm_leads*`

### 4.9 Program Designer
`/v2/designer` — ออกแบบโปรแกรมดูแลรายบุคคลจากข้อมูลที่มีในโปรไฟล์

### 4.10 Admin & Platform
- **ผู้ใช้:** `/v2/admin/users` — สร้าง/แก้ role/ผูก downline/รีเซ็ตรหัส
- **Backup/Restore:** `/admin/backup` + `/api/admin/{backup,restore}` (`lib/backup/tables.ts`)
- **View-as:** `lib/auth/view-as.ts` + `admin_view_as_log`
- **Auth:** `/login`, `/join/[token]` (สมัครจากคำเชิญ), `/forgot-password`, `/reset-password` · invite = `user_invites` + `lib/invites/actions.ts`

---

## 5. Cross-cutting Rules (ทุกโมดูลต้องทำตาม)

| เรื่อง | กติกา |
|---|---|
| **AI key** | **BYO Gemini key** — เก็บใน browser `localStorage['uplabs_gemini_key']` ผ่าน `components/GeminiKeyField` · **ไม่มี fallback ฝั่ง server** · error เรื่อง key ต้องโชว์ `GeminiKeyErrorNotice` (ชวนไปขอคีย์) ห้ามโชว์ error ดิบ · ข้อยกเว้น: `lib/pulse/gemini.ts` ใช้ `GEMINI_API_KEY` ฝั่ง server |
| **เกณฑ์สุขภาพ** | ใช้ `lib/medical-status.ts` ที่เดียว ห้าม hardcode สี/เกณฑ์ซ้ำ |
| **Compliance** | wellness ≠ diagnosis · ผลผิดปกติ → "ปรึกษาแพทย์" · อาหารเสริมต้องผ่านเภสัชกร (จิ้น) + แพทย์ · ห้ามคำว่า "รักษา/หาย/100%" |
| **PII** | repo เป็น **public** — ห้าม commit รายงานสุขภาพ/ชื่อลูกค้า/คีย์ · รายงานลูกค้าเก็บใน `customer_report_html` (private) แล้วอัปโหลดผ่านปุ่มในแอป |
| **ลิงก์สาธารณะ** | สร้างจาก `NEXT_PUBLIC_SITE_URL` = `https://upwellness-ops.vercel.app` (ห้ามมี `/` ท้าย) · ตัว builder strip trailing slash แล้ว |
| **A11y** | WCAG 2.2 AA · สถานะห้ามสื่อด้วยสีอย่างเดียว · touch target ≥ 44px · รองรับ `prefers-reduced-motion` |

---

## 6. Non-Goals (จงใจไม่ทำ)

1. ไม่เป็นเวชระเบียนโรงพยาบาล (EMR) และไม่วินิจฉัยโรค
2. ไม่ทำ e-commerce / ตะกร้าสินค้าในระบบนี้
3. ไม่เก็บคีย์ AI ของผู้ใช้ไว้บนเซิร์ฟเวอร์ (BYO เท่านั้น)
4. ไม่เปิดข้อมูลลูกค้าข้ามสายงานที่ไม่ใช่ downline ของตัวเอง
5. ไม่ทำแอปมือถือ native (ยัง) — เป็นเว็บ responsive

---

## 7. Success Metrics

| ตัวชี้วัด | เป้า |
|---|---|
| ลูกค้าที่มีโปรไฟล์ครบ (lab + BCA อย่างน้อย 1 ชุด) | เพิ่มทุกเดือน |
| เวลาเตรียมตัวก่อนคุยกับลูกค้า 1 คน | < 5 นาที (จากเดิมเปิดหลายที่) |
| อัตราลูกค้าที่เชื่อมอุปกรณ์/ส่งผลแล็บเอง | ↑ ผ่านลิงก์ invite |
| Check FORM → นัดคุยจริง | ติดตามผ่าน prospect pipeline |
| รายงาน Longevity ที่ส่งมอบ | ทุกเคสที่มีผลแล็บครบ |

---

## 8. Data Model (สรุป — ฉบับเต็มใน ARCHITECTURE.md)

`customers` = **hub** · มี **28 ตารางที่ FK ตรงเข้า `customers.id`** ครอบคลุม lab · BCA · allergy · CGM · wearable · supplement · report · note · LINE · lead
รอง: `profiles` (ผู้ใช้ + downline ผ่าน `parent_id`), `user_invites`, `user_app_grants`, `checkform_records`, `prospect_list`, `warm_leads*`

---

## 9. Known Issues / Open Items

| # | เรื่อง | สถานะ |
|---|---|---|
| 1 | **Google Fit sync ตาย** — OAuth ยังเป็น Testing mode (refresh token อายุ 7 วัน) + Google ปิด Fit REST API สิ้นปี 2026 | ต้องเลือกทาง: Google Health API (cloud) หรือ upload ไฟล์ · ดู memory `project_uplabs_google_health_migration` |
| 2 | `NEXT_PUBLIC_SITE_URL` ใน Vercel ยังชี้โดเมนเว็บไซต์ (ผิด) | **ต้นต้องแก้เป็น `https://upwellness-ops.vercel.app` + redeploy** |
| 3 | `app/setup/page.tsx` แสดงตัวอย่างโดเมนผิด | pending |
| 4 | CGM ยังไม่มีหน้า v2 | backlog |
| 5 | v1 ↔ v2 ยังอยู่คู่กัน (ลูกค้ามี 2 หน้า) | ทยอย cutover |

---

## 10. Roadmap (ถัดไป)

1. ปิดช่องว่าง v2 ให้ครบ แล้วเลิกใช้ v1
2. แก้เส้นทาง wearable (Google Health API หรือ upload) ให้ sync กลับมาได้
3. Longevity Report ให้เป็นปุ่มเดียวในแอป (ตอนนี้สร้างนอกระบบแล้วอัปโหลด)
4. ต่อยอด data model → ดู "โอกาสต่อยอด" ใน ARCHITECTURE.md

---

## 11. Changelog

| วันที่ | เปลี่ยนอะไร | commit |
|---|---|---|
| 2026-07-24 | **RBAC: upline ดูแลได้ทุกระดับชั้นลงไป (อ่าน+เขียน)** — เพิ่ม `canManageCustomer()` เป็น helper เดียว แล้วสลับ 26 จุดใน 24 route จาก owner/assigned เป็น helper นี้ · เดิม downline เป็น read-only ทำให้ upline เจอ `forbidden` เวลาบันทึกข้อมูลลูกค้าของสายงาน · **อุดช่องโหว่: `POST /api/customers/[id]/measurements` (บันทึก BCA) ไม่มีเช็คสิทธิ์เลย** · ทุก 403 คืนข้อความไทยบอกเหตุผล ไม่ใช่คำว่า `forbidden` | (รอ commit) |
| 2026-07-16 | **NutriScan สิทธิ์:** เช็คความเป็นเจ้าของลูกค้า **เฉพาะเมื่อจะบันทึก** (วิเคราะห์เฉย ๆ ไม่ใช้ `customer_id` เลย จึงไม่ต้องกัน) + เปลี่ยน `forbidden` ดิบเป็นข้อความไทยที่บอกสาเหตุ (ลูกค้าของ downline = ดูได้ บันทึกแทนไม่ได้) | (รอ commit) |
| 2026-07-16 | แยก error คีย์ AI เป็น 2 เคส: **400 = คีย์ผิด/หมดอายุ** (ขอคีย์ใหม่) vs **403 = คีย์ถูกแต่ไม่มีสิทธิ์** (โปรเจกต์ยังไม่เปิด Generative Language API / คีย์ถูกจำกัด → บอกวิธีแก้ที่ถูก ไม่ใช่ให้ขอคีย์ใหม่ซ้ำ) | (รอ commit) |
| 2026-07-16 | เพิ่ม user dropdown + logout ใน v2 Shell | `077ea56` |
| 2026-07-16 | strip trailing slash ทุก link builder (แก้ `//join` 404) | `910590d` |
| 2026-07-16 | ข้อความ "ขอคีย์ใหม่" แทน error ดิบ ทุกฟีเจอร์ BYO key + `lib/gemini-error.ts` | `710c7a7`, `ed597e4` |
| 2026-07-16 | สร้าง PRD + ARCHITECTURE ฉบับแรก | (เอกสารนี้) |
