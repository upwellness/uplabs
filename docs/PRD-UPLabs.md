# PRD — UP Labs (upwellness-ops)

> **Product:** UP Labs · Health Intelligence Platform for UP Wellness
> **Live:** `https://upwellness-ops.vercel.app` · repo `upwellness/uplabs`
> **Stack:** Next.js 14 (App Router) + Supabase (Postgres + Auth + Storage) + Vercel
> **Version:** 2.0 · **Updated:** 2026-08-29 · **Owner:** ต้น (Chaiwat)
> **Status:** production · v2 UI เป็น surface หลัก · v1 ยังเปิดคู่ขนาน

> ⚠️ **LIVING DOCUMENT — กฎเหล็ก:** ทุกครั้งที่แก้โค้ดแล้ว **ฟีเจอร์เปลี่ยน / เพิ่ม route / เพิ่มตาราง / เปลี่ยน data model** ต้องอัปเดต `.md` นี้ แล้วรัน `npm run docs` เพื่อ regenerate `.html` **ในคอมมิตเดียวกัน** แล้วเติม 1 บรรทัดใน §14 Changelog เสมอ · ไฟล์ `.html` เป็นผลลัพธ์จากตัว generate **ห้ามแก้มือ**

---

## 1. Product Overview

UP Labs คือ **แพลตฟอร์มภายในของ UP Wellness** ที่รวบรวมข้อมูลสุขภาพของลูกค้าทุกช่องทางไว้ที่เดียว แล้วเปลี่ยนเป็น *คำแนะนำที่ลงมือได้* สำหรับโค้ช/ที่ปรึกษา (ABO) — ไม่ใช่เครื่องมือขายของ แต่เป็น **เครื่องมือดูแลคน**

**Problem:** ข้อมูลลูกค้ากระจัดกระจาย (ใบแล็บกระดาษ · เครื่องชั่ง BCA · นาฬิกา · CGM · แชท LINE) โค้ชต้องจำเอง → คำแนะนำไม่ต่อเนื่อง พิสูจน์ผลไม่ได้

**Solution:** ศูนย์กลางเดียว = **Customer Profile** ที่ทุกโมดูลเขียนเข้า/อ่านออก + ชั้น AI ช่วยแปลผล + ลิงก์สาธารณะให้ลูกค้ากรอก/เชื่อมข้อมูลเองได้ + **External API / MCP** ให้ AI ข้างนอก (รวม AI ของลูกค้าเอง) ถามข้อมูลได้ (§10) · ขั้นถัดไป: [UP Health Design](./SPEC-Health-Design.md) — ประเมินรวมทุกแหล่งแล้วออกแบบแผนเฉพาะบุคคล

**Principles**

1. **Customer profile เป็นแกนกลาง** — ทุกฟีเจอร์ต้องผูกกับ `customers.id` (ดู [ARCHITECTURE.md](./ARCHITECTURE.md))
2. **Evidence over vibes** — ตัวเลขจริงจากใบตรวจ/อุปกรณ์ ห้ามเดา
3. **Wellness ≠ diagnosis** — ผิดปกติ → "ปรึกษาแพทย์" เสมอ ห้ามเคลมรักษา
4. **โค้ชเร็วขึ้น ไม่ใช่โค้ชถูกแทนที่** — AI สรุป/จัดลำดับ คนตัดสินใจ
5. **ตรรกะคลินิกอยู่ใน `lib/` ที่เดียว** — หน้าเว็บและ API ห้ามตัดสินเกณฑ์เอง

---

## 2. Users & Roles

| Role | ใคร | เห็นอะไร |
|---|---|---|
| `admin` | ต้น / ผู้ดูแลระบบ | ทุกอย่าง + จัดการผู้ใช้ + backup/restore + view-as + จัดการ API token |
| `abo` | นักธุรกิจ/โค้ช UP Wellness | ลูกค้าของตัวเอง + ลูกค้าของสายงานทุกระดับชั้นลงไป (อ่าน+เขียน) + แอปที่ได้รับสิทธิ์ |
| `member` | สมาชิกทั่วไป | เนื้อหาที่เปิดให้ (ยังใช้งานน้อย) |
| `other` | ค่าตั้งต้นเมื่อยังไม่กำหนด role | เกือบไม่มีสิทธิ์ |
| *(public link)* | ลูกค้า / ผู้สนใจ | เฉพาะหน้า token-gated ที่ถูกส่งลิงก์ให้ (ไม่ต้องล็อกอิน) |
| *(API token)* | ระบบ AI / automation ภายนอก | ตาม scope ที่แอดมินกำหนดต่อ token (§10) |

### 2.1 กลไกสิทธิ์ 4 ชั้น

1. **Role** (`profiles.role`) — ชั้นหยาบสุด · helper `lib/auth/roles.ts` → `hasRole()`, `canAccessApp()`
2. **App grant** (`user_app_grants`) — เปิด/ปิดแอปรายคน แม้ role ไม่ถึงก็เปิดให้เฉพาะคนได้
3. **Customer access** — ใครแตะลูกค้าคนไหนได้ · **helper เดียวเท่านั้น** `lib/customers/access.ts`
   - `canManageCustomer(userId, customerId)` = co-coach **หรือ** upline ของเจ้าของ (ทุกระดับชั้น)
   - `isAssignedToCustomer()` — co-coach จากตาราง `customer_assignments`
   - `isDownlineCustomer()` / `downlineUserIds()` — เดินต้นไม้ `profiles.parent_id` ผ่าน RPC `profile_descendant_ids`
   - รูปแบบที่ route ต้องใช้: `if (!isAdmin && c.coach_id !== uid && !(await canManageCustomer(uid, cid))) → 403`
   - ⛔ **ห้ามเขียนเช็คสิทธิ์เอง** ในแต่ละ route — เคยทำให้ read/write หลุดจากกัน (`POST /api/customers/[id]/measurements` เคยไม่มีเช็คเลย)
4. **Scope ของ API token** (§10) — สำหรับผู้เรียกที่ไม่ใช่คน

### 2.2 Downline (MLM)

`profiles.parent_id` → ผู้ถูกเชิญกลายเป็น downline ของผู้เชิญอัตโนมัติตอนสมัครผ่าน `/join/[token]` · **upline ดูแลลูกค้าของสายงานได้ทุกระดับชั้นลงไป ทั้งอ่านและเขียน** (เปลี่ยนจาก read-only เมื่อ 24 ก.ค. 2026 ตามที่ต้นเคาะ)

### 2.3 View-as

admin สวมมุมมองผู้ใช้อื่นเพื่อ support · `lib/auth/view-as.ts` + cookie `VIEW_AS_COOKIE` · ทุกครั้งลง `admin_view_as_log`

- `getSession()` = มุมมองที่ใช้ **แสดงผล** (สวมร่างแล้ว)
- `getRealSession()` = ตัวตนจริง — **ใช้ตรวจสิทธิ์เสมอ**
- `requireAdmin()` ตรวจจากตัวตนจริง ไม่ยอมให้ view-as ผ่าน
- การ **เขียน** ถูกบล็อกที่ middleware ระหว่าง view-as (สวมร่างเพื่อ *ดู* เท่านั้น)

---

## 3. Surface Map — ทุกหน้าในระบบ

**v2 = surface หลัก** (`/v2/*` ใช้ `app/v2/_components/Shell.tsx` — top bar + app switcher + breadcrumb + user menu) · v1 ยังเปิดสำหรับหน้าที่ยังไม่ย้าย

### 3.1 หน้าที่ต้องล็อกอิน

| โมดูล | v1 | v2 | สถานะ |
|---|---|---|---|
| หน้าแรก / app hub | `/` | `/v2` | ✅ ทั้งคู่ |
| Customer 360 | `/customers` · `/customers/[id]` | `/v2/customers` · `/v2/customers/[id]` | ✅ v2 หลัก |
| ↳ ผลตรวจ (records) | `/customers/[id]/records` · `/records/new` · `/records/[recordId]` | (รวมในแท็บ) | ✅ |
| ↳ ภูมิแพ้ | `/customers/[id]/allergies/new` | (รวมในแท็บ) | ✅ |
| BCA Tracker | `/bca` | `/v2/bca` | ✅ |
| Health Age (PhenoAge) | — | `/v2/bio-age` | ✅ v2 only |
| UP Pulse | `/pulse` · `/pulse/master/[id]` · `/pulse/report/[id]` · `/pulse/assessments/[id]` | ครบใน `/v2/pulse/*` | ✅ |
| Check FORM | `/checkform` | `/v2/checkform` | ✅ |
| Prospect List | `/prospects` | `/v2/prospects` | ✅ |
| Health Check (leads) | `/healthcheck` | `/v2/healthcheck` | ✅ |
| NutriScan + Food Log | `/nutriscan` · `/nutriscan/log` | `/v2/nutriscan` · `/v2/nutriscan/log` | ✅ |
| Plate Planner | `/plate-planner` | `/v2/plate-planner` · `/v2/plate-planner/guide` | ✅ |
| LINE Bot (น้องจาน) | `/line-bot` · `/line-bot/[customerId]` | `/v2/line-bot/*` | ✅ |
| Program Designer | `/designer` | `/v2/designer` | ✅ |
| CGM Analyzer | `/cgm` | — | v1 only |
| Admin · ผู้ใช้ / backup | `/admin/users` · `/admin/backup` | `/v2/admin/users` · `/v2/admin/backup` | ✅ |
| Admin · API token | — | `/v2/admin/api-tokens` | ✅ ใหม่ (§10) |
| ผลแล็บรอตรวจ (จาก AI) | — | `/v2/lab-inbox` | ✅ ใหม่ |
| ชวนสมาชิก (invite) | — | `/v2/invite` | ✅ v2 only |
| SAB slides | `/sab` | — | v1 only |
| Setup / diagnostics | `/setup` | — | internal |

### 3.2 หน้าสาธารณะ (token-gated · ไม่ต้องล็อกอิน)

| หน้า | ใช้ทำอะไร | ใครเปิด |
|---|---|---|
| `/login` · `/forgot-password` · `/reset-password` | เข้าระบบ / กู้รหัส | ผู้ใช้ |
| `/join/[token]` | สมัครจากคำเชิญ → ผูกเป็น downline ของผู้เชิญ | ผู้ถูกเชิญ |
| `/connect/[token]` · `/connect/[token]/success` · `/connect/error` | ลูกค้าเชื่อมนาฬิกา (Whoop / Google Fit) | ลูกค้า |
| `/intake/[token]` | แบบสอบถาม UP Pulse | ลูกค้า |
| `/check/[coachId]` | แบบประเมินสุขภาพสาธารณะ (lead capture) | คนทั่วไป |
| `/metaflex/[coachId]` | MetaFlex Quiz (lead capture) | คนทั่วไป |
| `/r/[token]` | แชร์รายงาน Pulse แบบอ่านอย่างเดียว | ใครก็ได้ที่มีลิงก์ |

---

## 4. API Inventory — ทุก endpoint

**กติกา:** API route = **ด่านตรวจสิทธิ์** และเป็นที่เดียวที่คุยกับบริการภายนอก · คอลัมน์ "สิทธิ์" บอกว่าใครเรียกได้

### 4.1 Customers

| Route | Method | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| `/api/customers` | GET · POST | session | รายการ / สร้างลูกค้า |
| `/api/customers/list` | GET | session | รายการแบบเบา (dropdown) |
| `/api/customers/[id]` | GET · PATCH · DELETE | owner/admin/`canManageCustomer` | อ่าน/แก้/ลบโปรไฟล์ (ลบ = เจ้าของ+admin) |
| `/api/customers/[id]/360` | GET | เหมือนบน | ข้อมูลรวมหน้า Customer 360 (identity + vital + insight + timeline + meta) |
| `/api/customers/[id]/lab-values/latest` | GET | เหมือนบน | ค่าล่าสุดต่อ metric |
| `/api/customers/[id]/lab-values/series` | GET | session | time-series ทุกค่า (เรียงตามวันที่) สำหรับกราฟ |
| `/api/customers/[id]/records` | GET · POST | เหมือนบน | รายการ/เพิ่มใบตรวจ |
| `/api/customers/[id]/records/[recordId]` | GET · PATCH · DELETE | เหมือนบน | ใบตรวจรายใบ + ค่าในใบ |
| `/api/customers/[id]/measurements` | GET · POST | เหมือนบน | BCA (เคยไม่มีเช็คสิทธิ์ — อุดแล้ว 24 ก.ค. 2026) |
| `/api/measurements/[id]` | PATCH · DELETE | เหมือนบน | แก้/ลบ BCA รายรายการ |
| `/api/customers/[id]/allergies` | GET | เหมือนบน | ผลภูมิแพ้อาหาร |
| `/api/customers/[id]/allergies/tests` | GET · POST | เหมือนบน | ชุดทดสอบภูมิแพ้ |
| `/api/customers/[id]/allergies/tests/[testId]` | GET · PATCH · DELETE | เหมือนบน | รายชุด |
| `/api/customers/[id]/notes` | GET · POST | เหมือนบน | โน้ตโค้ช (ปักหมุดได้) |
| `/api/customers/[id]/bio-age` | GET | เหมือนบน | Health Age (PhenoAge) |
| `/api/customers/[id]/lab-report` | GET · POST | เหมือนบน | รายงาน HTML ส่วนตัวของลูกค้า |
| `/api/customers/[id]/med-map` | GET | เหมือนบน | Med-Map report (HTML) |

### 4.2 โมดูลอื่น

| Route | Method | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| `/api/bca/classify` | POST | session | จัดระดับค่า BCA ตาม `lib/medical-status.ts` |
| `/api/cgm/passcode` | POST | passcode ต่อ profile | ปลดล็อก CGM profile (RLS + SECURITY DEFINER RPC) |
| `/api/checkform/analyze` | POST | session + BYO key | วิเคราะห์ prospect ด้วย Gemini |
| `/api/checkform/recommend-clips` | POST | session + BYO key | จับคู่คลิป STP |
| `/api/checkform/records` · `/records/[id]` | GET · POST · PATCH · DELETE | session | เก็บ/อ่านผลวิเคราะห์ |
| `/api/nutriscan` · `/api/nutriscan/[id]` | GET · POST · DELETE | session (+เช็คลูกค้าเมื่อจะบันทึก) | วิเคราะห์อาหารจากรูป + food log |
| `/api/plate-image` | POST | session | สร้างภาพจานด้วย AI + แคชใน Storage |
| `/api/prospects` · `/[id]` · `/[id]/convert` | GET · POST · PATCH · DELETE | session | Prospect pipeline + แปลงเป็น Check FORM |
| `/api/healthcheck/leads` · `/[id]` | GET · PATCH · DELETE | session | Lead จากแบบประเมิน |
| `/api/check/submit` | POST | **public** | รับแบบประเมินสาธารณะ |
| `/api/join` | POST | **token** | สมัครจากคำเชิญ |
| `/api/line/webhook` | POST | **x-line-signature (HMAC)** | LINE bot รับ event |
| `/api/line/push-tomorrow` | GET · POST | **CRON_SECRET** | ส่งเมนูพรุ่งนี้ (Vercel Cron 18:00) |
| `/api/line-bot/config/[customerId]` | GET · PUT | session | ตั้งค่าบอทต่อลูกค้า |
| `/api/line-bot/groups` · `/[id]` | GET · POST · PATCH · DELETE | session | ผูกกลุ่ม LINE ↔ ลูกค้า |
| `/api/line-bot/supplements/[customerId]` | GET · PUT | session | ตารางอาหารเสริมที่บอทจะส่ง |
| `/api/admin/backup` · `/api/admin/restore` | GET · POST | **admin เท่านั้น** | สำรอง/กู้คืนข้อมูล |
| `/api/debug/me` · `/api/debug/customers` | GET | session | วินิจฉัยสิทธิ์ (internal) |

### 4.3 UP Pulse

| Route | Method | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| `/api/pulse/invites` | GET · POST | session | สร้างลิงก์เชิญเชื่อมอุปกรณ์ |
| `/api/pulse/intakes` | POST | **public (token)** | ลูกค้าส่งแบบสอบถาม |
| `/api/pulse/intakes/[token]` | GET | **public (token)** | ดึงแบบฟอร์มตาม token |
| `/api/pulse/oauth/start` · `/callback` | GET | **public (state)** | OAuth Google Fit |
| `/api/pulse/whoop/oauth/start` · `/callback` | GET | **public (state)** | OAuth Whoop |
| `/api/pulse/whoop/import` | POST | session | นำเข้า CSV Whoop |
| `/api/pulse/apple/import` | POST | session | นำเข้า Apple Health export.xml |
| `/api/pulse/customers/[id]` | GET | เหมือน customers | ข้อมูล Pulse ของลูกค้า |
| `/api/pulse/customers/[id]/sync` | POST | เหมือน customers | ดึงข้อมูลจาก provider |
| `/api/pulse/customers/[id]/assess` | POST | เหมือน customers | ประเมิน (`lib/pulse/assess.ts`) |
| `/api/pulse/customers/[id]/cgm-link` | POST | เหมือน customers | ผูก CGM profile |
| `/api/pulse/customers/[id]/debug` | GET | เหมือน customers | วินิจฉัยการเชื่อมต่อ |
| `/api/pulse/assessments/[id]` | GET · DELETE | session | ผลประเมิน |
| `/api/pulse/share/[token]` | GET | **public (token)** | ดึงรายงานที่แชร์ |

### 4.4 External API (v1) — §10

| Route | Method | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| `/api/v1/meta` | GET | API token | ตัวตน token + scope + intent ที่ใช้ได้ |
| `/api/v1/openapi.json` | GET | **public** | สคีมาสำหรับ ChatGPT Actions / n8n · `?flavor=gemini` ตัด key ที่ Gemini ไม่รับออก |
| `/api/mcp` | POST | API token | **MCP server** — tool 19 ตัว derive จาก OpenAPI อัตโนมัติ · เรียก handler `/api/v1` ตัวเดิมในโปรเซส (สิทธิ์/log เดิม) · Claude Code · Cursor · Gemini CLI · n8n ต่อด้วย URL + Bearer · SPEC §8.8 |
| `/oauth/authorize` · `/api/oauth/{register,token,revoke}` · `/.well-known/oauth-*` | GET/POST | session (consent) / client | **OAuth 2.1 authorization server** ให้ claude.ai และ ChatGPT ต่อ MCP ตรง · ผู้ใช้ล็อกอิน+ยินยอม → mint `api_tokens` (7 วัน + refresh 90 วัน rotate) · SPEC §8.9 |
| `/api/v1/query` | POST | API token | คำสั่งภาษาคน → ข้อมูลตรง ๆ (ไม่มี LLM ฝั่งเรา) |
| `/api/v1/customers` | GET · POST | `customers:read` / `customers:write` | ค้นหา/สร้างลูกค้า |
| `/api/v1/customers/{id}` | GET · PATCH | `customers:read` / `customers:write` | โปรไฟล์ · PATCH ตรวจด้วย `validateProfileEdit()` ตัวเดียวกับหน้าเว็บ · GET คืน `retired` |
| `/api/v1/customers/{id}/labs` | GET · POST | `labs:read` / `labs:write` | ผลแล็บ (รองรับ `rounds=N`) |
| `/api/v1/customers/{id}/labs/compare` | GET | `labs:read` | ตารางเทียบ N รอบล่าสุด |
| `/api/v1/customers/{id}/overview` | GET | `labs:read` | ภาพรวมทุก factor (longevity snapshot) |
| `/api/v1/customers/{id}/measurements` | GET · POST | `measurements:*` | BCA |
| `/api/v1/customers/{id}/assessment` | GET · POST | `assessment:read` / `assessment:write` | **ผลประเมินสุขภาพรวม 7 ด้าน** (UP Health Design เฟส 1) · SPEC-External-API §8.10 |
| `/api/v1/customers/{id}/supplements` | GET | `supplements:read` | อาหารเสริม + ความปลอดภัยคู่ยา |
| `/api/v1/customers/{id}/notes` | GET · POST | `notes:*` | โน้ตโค้ช |
| `/api/v1/links/invite` | POST | `links:write` | ขอลิงก์สมัคร |

---

## 5. Feature Inventory — โมดูลต่อโมดูล

### 5.1 Customer 360 — หัวใจของระบบ

**หน้า:** `/v2/customers`, `/v2/customers/[id]` · **API:** §4.1

รวมทุกอย่างของลูกค้า 1 คนไว้หน้าเดียว — identity + สถานะสุขภาพ + insight + timeline + 8 แท็บ:

| แท็บ | เนื้อหา | ตาราง |
|---|---|---|
| Labs / Trends | ผลเลือดทุกครั้ง + กราฟแนวโน้ม + สถานะ (ปกติ/สูง/ต่ำ/ก้ำกึ่ง) | `customer_records`, `customer_lab_values` |
| Body Map | จุดผิดปกติบนภาพร่างกาย (`lib/records/body-map.ts` map metric→อวัยวะ) | `customer_lab_values` |
| BCA | น้ำหนัก/ไขมัน/กล้ามเนื้อ/visceral/body-age | `measurements` |
| Allergy | ผลทดสอบภูมิแพ้อาหาร | `customer_allergy_tests`, `customer_food_allergens` |
| CGM | น้ำตาลต่อเนื่อง + มื้ออาหาร | `cgm_profiles`, `cgm_readings`, `cgm_meals` |
| Supplements | ตารางอาหารเสริม + ความปลอดภัยคู่ยา | `supplement_schedule`, `customer_supplement_safety` |
| Pulse | ข้อมูลนาฬิกา + assessment | `pulse_*`, `whoop_*`, `biomarker_readings` |
| Notes | โน้ตโค้ช (ปักหมุดได้) | `coach_notes` |

**แก้ไขข้อมูลลูกค้าในหน้า 360:** ปุ่ม "แก้ไขข้อมูล" → ชื่อ · เพศ · วันเกิด · ส่วนสูง · ตรวจด้วย `validateProfileEdit()` ใน `lib/v2/identity.ts` (ฟังก์ชันบริสุทธิ์ ใช้ร่วมกันทั้ง dialog และ API) · **ดัก พ.ศ. ที่พิมพ์ลงช่อง ค.ศ.** (ใบแล็บไทยพิมพ์ พ.ศ. → 2569 จะทำให้วันเกิดไปอยู่อนาคต 543 ปี และเพี้ยนทั้งอายุ เกณฑ์อ้างอิง และ PhenoAge โดยหน้าจอไม่มีอะไรดูผิด) · ดักส่วนสูงเป็นเมตร (1.65) และค่าที่พิมพ์ผิดช่อง · **ปุ่มแก้ไข/ปิดใช้งานโชว์เฉพาะคนที่มีสิทธิ์จริง** (`/360` คืน `meta.canManage`) ไม่ใช่โชว์แล้วตอบ 403 ตอนกด

**ปิดใช้งานโปรไฟล์ (retire):** ปุ่มในหน้า Customer 360 · `PATCH /api/customers/[id]` `{disabled:true, disabled_reason}` → `customers.disabled_at/_by/_reason` · **ไม่ลบข้อมูล** แค่ซ่อนจากรายการ ค้นหา dropdown และการค้นชื่อของ External API · เปิดกลับได้ทุกเมื่อ (ล้าง reason ทิ้งด้วย) · เปิดหน้าตรงยังได้ พร้อมป้ายเตือน · **LINE bot หยุดส่งเมนูให้โปรไฟล์ที่ปิดแล้ว** (จุดเดียวที่มี side-effect ออกนอกระบบ) · สิทธิ์เท่ากับการแก้ข้อมูล (`canManageCustomer`) · รายการลูกค้ามีสวิตช์ "แสดงที่ปิดใช้งาน"

**ตรรกะที่อยู่ใน lib:** `lib/customers/health-score.ts` · `insight-rules.ts` · `status-classifier.ts` · `access.ts`
**ฟีเจอร์ย่อย:** Med-Map report · เก็บรายงาน HTML ส่วนตัว (`customer_report_html`) · view log (`customer_view_log`)

### 5.2 BCA Tracker + Health Age

- **BCA:** บันทึกผลเครื่องชั่ง → เกจสถานะ + กราฟย้อนหลัง + แก้/ลบ + ออกรายงาน
- **เกณฑ์เดียวทั้งระบบ:** `lib/medical-status.ts` = single source of truth (5 ระดับ traffic-light + ป้ายไทยตามเกณฑ์คลินิก) ใช้ทั้งเกจ v2, BCA Scan Reveal และ labs
- **Health Age (PhenoAge · Levine 2018):** `lib/bio-age.ts` — คำนวณจาก 9 marker (albumin · creatinine · glucose · hs-CRP · lymphocyte% · MCV · RDW · ALP · WBC)
  - โหมด hybrid: เติมค่าที่ขาดด้วยค่าประชากรตามอายุ + ติดป้าย "ประมาณ"
  - **Customer 360 จะโชว์เลขก็ต่อเมื่อมี CRP + RDW จริง** (ไม่งั้นตัวเลขหลอก)
  - ⚠️ ในทางปฏิบัติ **hs-CRP คือค่าที่ขาดบ่อยที่สุด** — หลายเคสมี 8/9 แล้ว

### 5.3 UP Pulse — Wearables & Assessment

- **เชื่อมอุปกรณ์:** Whoop (OAuth + CSV import) · Apple Health (อัปโหลด export.xml) · Google Fit (OAuth — ⚠️ กำลังตาย ดู §12)
- **Flow ลูกค้า:** โค้ชสร้าง invite → ลูกค้าเปิด `/connect/[token]` บนมือถือ → ยินยอม → ระบบดึงข้อมูล
- **แบบสอบถาม:** `/intake/[token]` → `pulse_intakes` → ประเมิน (`lib/pulse/assess.ts`) → `pulse_assessments`
- **รายงาน:** `/pulse/report/[id]` (`lib/pulse/wearable-report.ts` รวมทุก provider เป็น report เดียว) + แชร์ผ่าน `/r/[token]`
- ⚠️ `lib/pulse/gemini.ts` เป็น **ข้อยกเว้นเดียว** ที่ใช้ `GEMINI_API_KEY` ฝั่ง server (ที่เหลือเป็น BYO key)

### 5.4 CGM Analyzer

`/cgm` + `/api/cgm/passcode` — น้ำตาลต่อเนื่อง + มื้ออาหาร · เข้าถึงผ่าน **passcode ต่อ profile** (RLS + SECURITY DEFINER RPC) · `cgm_readings` เป็นตารางใหญ่สุดในระบบ (~34k แถว)

### 5.5 NutriScan AI + Food Log

`lib/nutriscan/gemini-vision.ts` + `macros.ts` — ถ่ายรูปอาหาร → Gemini Vision → มาโคร + ผลต่อน้ำตาล + คะแนนสุขภาพ + คำแนะนำ → `nutriscan_scans`
**สิทธิ์:** วิเคราะห์เฉย ๆ ไม่ต้องมี `customer_id` จึงไม่เช็ค · เช็คความเป็นเจ้าของ **เฉพาะตอนบันทึกผูกลูกค้า**

### 5.6 Plate Planner + LINE Bot (น้องจาน)

- **Plate Planner:** `lib/plate-planner/engine.ts` — จัดจานแบบ Muscle-Centric (Dr. Gabrielle Lyon) · 3 เป้าหมายคำนวณแยก (ลดน้ำหนัก / longevity / สร้างกล้าม) · อาหารไทยไม่ซ้ำ · สร้างภาพจานด้วย AI (แคชใน Supabase Storage) · ตั้งค่าต่อลูกค้าใน `plate_plan_config`
- **LINE Bot:** ผูกกลุ่ม LINE กับลูกค้า (`line_bot_groups`) → ส่งเมนู+วิตามินอัตโนมัติ 18:00 ผ่าน Vercel Cron · log ที่ `line_bot_logs`

### 5.7 Check FORM — AI Prospect Analysis

`lib/checkform/{ai-analyze,clip-matcher}.ts` — กรอกโปรไฟล์ผู้มุ่งหวัง + DISC → Gemini วิเคราะห์: แนวทางเข้าหา · สัดส่วน product/business · บทสนทนาตัวอย่าง · roleplay · red flags → **จับคู่คลิป STP** ที่ควรให้ฟัง (reasoning-based ไม่ใช่สูตร) · cache ผลใน `checkform_records`

### 5.8 Prospect / Lead Pipeline

- **Prospect List** `/v2/prospects` → memory-dump 100 ชื่อ · tier A/B/C · convert → Check FORM คลิกเดียว (`prospect_list`)
- **Health Check (leads)** — แบบประเมินสาธารณะ `/check/[coachId]`, `/metaflex/[coachId]` → `healthcheck_leads` (ผูกเป็นลูกค้าได้)
- ตารางเสริม: `leads`, `metabolic_leads`, `aw_prospects`, `warm_leads*` (5 ตาราง)

### 5.9 Program Designer

`/v2/designer` — wizard 5 ขั้น ออกแบบ Full Course เฉพาะบุคคล · คำนวณ unit + PV + cashback · บันทึกเป็นภาพ HD

### 5.10 Admin & Platform

- **ผู้ใช้:** `/v2/admin/users` — สร้าง/แก้ role/ผูก downline/รีเซ็ตรหัส/มอบหมายลูกค้า
- **Backup/Restore:** `/admin/backup` + `lib/backup/tables.ts` + `npm run backup`
- **API tokens:** `/v2/admin/api-tokens` (§10)
- **Auth:** `/login`, `/join/[token]`, `/forgot-password`, `/reset-password` · invite = `user_invites` + `lib/invites/actions.ts`
- **App registry:** `lib/apps-registry.ts` — เพิ่มแอปใหม่ต้องลงทะเบียนที่นี่ + เพิ่มลิงก์ใน `app/v2/_components/Shell.tsx`

---

### 5.11 UP Health Design — ผลประเมินสุขภาพรวม (เฟส 1 · 12 ก.ย. 2026)

การ์ด "ผลประเมินสุขภาพรวม" บน Customer 360 + `GET/POST /api/customers/[id]/assessment` + External API/MCP `getAssessment`/`runAssessment`
- **engine:** `lib/health-design/assess.ts` (pure · 10 tests) รวมแล็บ · BCA · CGM · นาฬิกา (Whoop/pulse_readings) · อาหาร (NutriScan) เป็น 7 ด้าน — แต่ละด้านมีไฟสถานะของตัวเอง **ไม่รวมเป็นเลขเดียว** (ต้นเคาะ 12 ก.ย.)
- **loader:** `lib/health-design/load.ts` ดึง 5 แหล่ง (หน้าต่าง 14 วันสำหรับข้อมูลต่อเนื่อง) → เก็บทุกครั้งใน `health_assessments` (ไม่ทับ) · ประเมินใหม่อัตโนมัติหลังบันทึกแล็บ/BCA/CGM
- **กฎ:** ไม่มีข้อมูล = `level: null` + อยู่ใน `data_gaps` · เกณฑ์อ้างอิงระบุในโค้ด (ADA · ATP III · KDIGO · Battelino 2019 · AASM · PROT-AGE) · reuse `medical-status` bands, `cgm-metrics`, `bio-age` ไม่เขียนเกณฑ์ซ้ำ · `priorities.why` ไม่ใช้คำว่าโรค
- **ยังไม่ทำ (เฟสถัดไป):** food log 3 ทาง · ร่างแผน · ฐานประชากร · หน้าลูกค้า — ดู [SPEC-Health-Design.md](./SPEC-Health-Design.md) §8

## 6. Cross-cutting Rules

| เรื่อง | กติกา |
|---|---|
| **AI model** | ประกาศที่ `lib/gemini-config.ts` ที่เดียว · default = alias **`gemini-flash-latest`** (ห้าม hardcode เลขรุ่น — Google ปลดรุ่นเป็นระยะ เคยทำระบบล่มมาแล้ว) · ภาพใช้ fallback list + ข้าม 404 อัตโนมัติ · override ด้วย env `GEMINI_MODEL` / `GEMINI_IMAGE_MODEL` |
| **AI call** | ทุกการเรียกผ่าน `lib/gemini-call.ts` ที่เดียว (ส่ง `thinkingLevel: "minimal"` + retry ตัด thinking ถ้าโมเดลไม่รับ) |
| **AI key** | **BYO Gemini key** — เก็บใน browser `localStorage['uplabs_gemini_key']` ผ่าน `components/GeminiKeyField` · **ไม่มี fallback ฝั่ง server** · error เรื่อง key ต้องโชว์ `GeminiKeyErrorNotice` ห้ามโชว์ error ดิบ · ใช้ `lib/gemini-error.ts` เสมอ · แยก 400 (คีย์ผิด) จาก 403 (คีย์ถูกแต่ไม่มีสิทธิ์) |
| **เกณฑ์สุขภาพ** | `lib/medical-status.ts` ที่เดียว ห้าม hardcode สี/เกณฑ์ซ้ำ |
| **Compliance** | wellness ≠ diagnosis · ผลผิดปกติ → "ปรึกษาแพทย์" · อาหารเสริมต้องผ่านเภสัชกร (จิ้น) + แพทย์ · ห้ามคำว่า "รักษา/หาย/100%" |
| **PII** | repo เป็น **public** — ห้าม commit รายงานสุขภาพ/ชื่อลูกค้า/คีย์ · รายงานลูกค้าเก็บใน `customer_report_html` (private) แล้วอัปโหลดผ่านปุ่มในแอป |
| **ลิงก์สาธารณะ** | สร้างจาก `NEXT_PUBLIC_SITE_URL` = `https://upwellness-ops.vercel.app` (ห้ามมี `/` ท้าย · ห้ามใช้ `upwellness.vercel.app` ซึ่งเป็นเว็บคนละตัว) |
| **A11y** | WCAG 2.2 AA · สถานะห้ามสื่อด้วยสีอย่างเดียว · touch target ≥ 44px · รองรับ `prefers-reduced-motion` |
| **เอกสาร** | แก้ `.md` → `npm run docs` → commit ทั้งคู่ · ห้ามแก้ `.html` มือ |

---

## 7. Data Model

`customers` = **hub** · ตารางลูกที่ FK ตรงเข้า `customers.id` ครอบคลุม lab · BCA · allergy · CGM · wearable · supplement · report · note · LINE · lead
(ฉบับเต็มพร้อมคอลัมน์อยู่ใน [ARCHITECTURE.md](./ARCHITECTURE.md))

| กลุ่ม | ตาราง |
|---|---|
| **แกนกลาง** | `customers` (มี `disabled_at`/`disabled_by`/`disabled_reason` = ปิดใช้งาน ไม่ใช่ลบ) · `profiles` · `user_invites` · `user_app_grants` · `customer_assignments` |
| **ผลตรวจ** | `customer_records` · `customer_lab_values` · `customer_report_html` |
| **ร่างกาย** | `measurements` · `biomarker_readings` |
| **ภูมิแพ้** | `customer_allergy_tests` · `customer_food_allergens` |
| **CGM** | `cgm_profiles` · `cgm_readings` · `cgm_meals` |
| **Wearable** | `pulse_connections` · `pulse_readings` · `pulse_invites` · `pulse_intakes` · `pulse_assessments` · `wearable_connections` · `wearable_invites` · `sync_jobs` · `whoop_daily` · `whoop_sleeps` · `whoop_workouts` · `whoop_journal` |
| **อาหาร/เสริม** | `nutriscan_scans` · `plate_plan_config` · `supplement_schedule` · `customer_supplement_safety` |
| **โค้ช** | `coach_notes` · `customer_view_log` · `admin_view_as_log` |
| **LINE** | `line_bot_groups` · `line_bot_logs` |
| **Lead / Prospect** | `prospect_list` · `checkform_records` · `healthcheck_leads` · `leads` · `metabolic_leads` · `aw_prospects` · `contacts` · `contact_status` · `call_logs` · `warm_leads` · `warm_lead_interactions` · `warm_lead_segments` · `warm_lead_tags` · `warm_lead_tasks` · `warm_content_touchpoints` |
| **External API** | `api_tokens` · `api_token_logs` · `pending_lab_imports` (คิวรอตรวจ) (§10) |
| **ไม่ใช่ของ UP Labs** (อยู่ใน DB เดียวกันจากโปรเจกต์อื่น) | `budgets` · `categories` · `transactions` · `symbols` · `losmtd` · `driver_logs` · `link_hub` · `user_profiles` |

---

## 8. Environment Variables

| ตัวแปร | ที่ใช้ | จำเป็น |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server (ตาม session ผู้ใช้) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | server เท่านั้น — bypass RLS · **ห้ามหลุดไป client** | ✅ |
| `NEXT_PUBLIC_SITE_URL` | สร้างลิงก์เชิญ/รีเซ็ต · ต้องเป็น `https://upwellness-ops.vercel.app` **ไม่มี `/` ท้าย** | ✅ |
| `CRON_SECRET` | ป้องกัน `/api/line/push-tomorrow` · ถ้าไม่ตั้ง route จะปฏิเสธ (ไม่เปิดกว้าง) | ✅ (ถ้าใช้ LINE bot) |
| `GEMINI_API_KEY` | ข้อยกเว้นเดียว: `lib/pulse/gemini.ts` | ตามการใช้งาน |
| `GEMINI_MODEL` · `GEMINI_IMAGE_MODEL` | override รุ่นโมเดล | ไม่ |
| `LINE_CHANNEL_SECRET` · `LINE_CHANNEL_ACCESS_TOKEN` | LINE bot | ตามการใช้งาน |
| `WHOOP_CLIENT_ID` · `WHOOP_CLIENT_SECRET` | OAuth Whoop | ตามการใช้งาน |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | OAuth Google Fit | ตามการใช้งาน |

> ⚠️ env มีผล **หลัง redeploy** เท่านั้น — แก้ค่าใน Vercel แล้วต้อง redeploy ไม่งั้นยังใช้ค่าเดิม

---

## 9. Security Model

| ชั้น | กลไก |
|---|---|
| **Edge** | `middleware.ts` — ทุก path ที่ไม่อยู่ใน `PUBLIC_PATHS` ต้องมี session · ระหว่าง view-as จะบล็อกการเขียน |
| **Route** | ทุก route handler ตรวจ session + `canManageCustomer()` เอง (middleware ไม่รู้ว่าลูกค้าคนไหนเป็นของใคร) |
| **Database** | RLS เปิดในตารางที่ลูกค้าแตะได้ · CGM ใช้ SECURITY DEFINER RPC + passcode ต่อ profile |
| **Service role** | `createAdminClient()` bypass RLS — ใช้เฉพาะ server logic ที่ตรวจสิทธิ์มาแล้ว · **ห้าม import จาก Client Component** |
| **Public endpoint** | อนุญาตเฉพาะที่ระบุใน `PUBLIC_PATHS` และต้องมี auth ของตัวเอง (token / HMAC / CRON_SECRET / OAuth state) |
| **External API** | token hash + scope + rate limit + audit log (§10) |

> 🚩 **หนี้ค้างที่รู้ตัว:** passcode ของ CGM ทั้ง 8 profile ยังเป็นค่าเดียวกัน และ RPC ยังไม่มี rate limit — ดู §12

---

## 10. External API (v1) — ให้ AI ข้างนอกถามข้อมูลได้

**สเปกเต็ม:** [SPEC-External-API.md](./SPEC-External-API.md)

**ทำไมต้องมี:** ต้นอยากเปิด ChatGPT (หรือ n8n / Make / สคริปต์) แล้วพิมพ์ว่า *"ช่วยเทียบผลแล็บย้อนหลัง 3 รอบของคนนี้หน่อย"* แล้วได้ข้อมูลจริงจาก UP Labs กลับไปทันที โดย**ไม่ต้องเปิดเว็บ**

**หลักการที่ตัดสินสถาปัตยกรรม:**

1. **ไม่มี LLM ฝั่งเรา** — เราส่ง *ข้อมูลที่ถูกต้องและครบ* กลับไป ผู้เรียกเอาไปคิด/เรียบเรียงเอง · เราไม่จ่ายค่าโทเคน ไม่ต้องดูแลคุณภาพคำตอบ และไม่มีทางที่ระบบเราจะ "แต่งค่าสุขภาพ" ขึ้นมาเอง
2. **คำสั่งภาษาคนแปลด้วยกฎ ไม่ใช่โมเดล** — `POST /api/v1/query` ใช้ **intent resolver แบบ deterministic** (คีย์เวิร์ด + สกัด entity) · ถ้าไม่มั่นใจ **จะไม่เดา** แต่ตอบกลับว่ามี intent อะไรให้เลือกบ้าง เพื่อให้ LLM ฝั่งผู้เรียกตัดสินใจแล้วยิงซ้ำแบบระบุ intent ตรง ๆ
3. **Token = สิทธิ์ที่แอดมินกำหนด** — scope รายอย่าง + จำกัดขอบเขตลูกค้าได้ + วันหมดอายุ + rate limit + เพิกถอนได้ทันที
4. **ทุกการเรียกถูกบันทึก** — `api_token_logs` เก็บว่า token ไหน ถามอะไร ตอนไหน ได้กี่แถว

**Scopes:** `customers:read` · `customers:write` · `labs:read` · `labs:write` · `measurements:read` · `measurements:write` · `supplements:read` · `notes:read` · `notes:write` · `links:write`

**ขอบเขตลูกค้า ผูกกับลำดับชั้น:** ทุก token มี `owner_user_id` และ **เห็นได้ไม่เกินกว่าที่เจ้าของเห็นเอง ณ ตอนนั้น** — คำนวณสดจากบทบาท + ตำแหน่งในสายงานทุก request (ย้ายสายงาน/ลดบทบาท → token เปลี่ยนตามทันที) · `owner` (ค่าเริ่มต้น) / `all` (เฉพาะเจ้าของที่ยังเป็นแอดมิน ไม่งั้นลดอัตโนมัติ) / `list:` (ตัดกับสายงานเจ้าของเสมอ)

**คิวตรวจสอบผลแล็บจาก AI (`/v2/lab-inbox`):** ผู้ช่วย AI อ่านใบแล็บแล้วยิงเข้า `POST /api/v1/customers/{id}/labs/submit` (scope `labs:submit`) → เข้า `pending_lab_imports` **ยังไม่เข้าประวัติลูกค้า** → คนเปิดดูเทียบกับใบจริง แก้ค่าได้ตรงช่อง → กดยืนยันจึงเขียนเข้า `customer_records` + `customer_lab_values` · **ระบบบันทึกตามที่คนแก้ ไม่ใช่ตามที่ AI ส่งมา** · `lib/api/lab-import.ts` normalise + ตั้งธงเตือน (ค่านอกช่วงมนุษย์ · หน่วยที่ต่างกันเป็นสิบเท่า · metric ซ้ำ · value กับ value_num ไม่ตรง · ไม่ระบุสถานะ) **แต่ไม่เดาแทน** · `labs:write` (เขียนตรง) ยังมีอยู่สำหรับข้อมูลที่ยืนยันแล้ว

**นำเข้าและอ่านค่า CGM ผ่าน API (11 ก.ย. 2026):** เดิม `cgm_readings` (52,029 แถว) ถูกโหลดด้วยมือ ไม่มีโค้ดตัวไหนเขียนลงตารางนี้ · เพิ่ม `POST /api/v1/customers/{id}/cgm/import` รับไฟล์ Ottai (.xlsx/.csv) หรือ JSON → `lib/api/cgm-import.ts` (บริสุทธิ์ · หา header เอง · เวลาไทย → epoch ตรงกับข้อมูลเดิม · ปฏิเสธค่านอกช่วงพร้อมเลขแถว · 10 เทสต์) → upsert ไม่เขียนทับ (unique index ใหม่ `cgm_readings(profile_name, reading_timestamp)` — ยืนยัน 0 ซ้ำก่อนใส่) · `GET …/cgm` ค่าดิบ · `GET …/cgm/metrics` = TIR/TITR/TAR/TBR/CV/GMI/รายวัน/`reliable`/`meets` จาก `lib/api/cgm-metrics.ts` (นิยาม Battelino 2019 · 9 เทสต์) · scope ใหม่ `cgm:read` `cgm:write` · ชื่อโปรไฟล์ผูกผ่าน `customers.cgm_profile_names[]` และ**ห้ามสร้างชื่อที่สองซ้อนคนเดิม**

**ไฟล์สำหรับต่อผู้ช่วย AI:** `integrations/` — `claude-skill/` (Claude เรียก API เองได้) · `chatgpt/GPT-INSTRUCTIONS.md` (Custom GPT) · `DROP-IN.md` (วางในแชทไหนก็ได้ ผู้ช่วยเขียน curl ให้) · ⚠️ ChatGPT ในแชทธรรมดา**ยิง HTTP เองไม่ได้** ไฟล์ที่อัปโหลดเป็นความรู้ ไม่ใช่ความสามารถ — ต้องตั้ง Actions ผ่าน UI

**หน้าจัดการ:** `/v2/admin/api-tokens` (admin เท่านั้น) — สร้าง token (โชว์ค่าเต็มครั้งเดียว) · เลือก scope · จำกัดลูกค้า · ตั้งวันหมดอายุ · ดู log · **เลือกเจ้าของ token** พร้อมแสดงว่าเขาเข้าถึงลูกค้ากี่คน · เพิกถอน

---

## 11. Non-Goals (จงใจไม่ทำ)

1. ไม่เป็นเวชระเบียนโรงพยาบาล (EMR) และไม่วินิจฉัยโรค
2. ไม่ทำ e-commerce / ตะกร้าสินค้าในระบบนี้
3. ไม่เก็บคีย์ AI ของผู้ใช้ไว้บนเซิร์ฟเวอร์ (BYO เท่านั้น)
4. ไม่เปิดข้อมูลลูกค้าข้ามสายงานที่ไม่ใช่ downline ของตัวเอง
5. ไม่ทำแอปมือถือ native (ยัง) — เป็นเว็บ responsive
6. **ไม่ฝัง LLM ไว้ใน External API** — เราส่งข้อมูล ผู้เรียกคิดเอง (§10)
7. ไม่เปิด External API ให้เขียนข้อมูลคลินิกที่ตีความแล้ว (เช่น "สรุปว่าเป็นเบาหวาน") — เขียนได้เฉพาะ **ค่าที่วัดได้** กับ **โน้ต**

---

## 12. Known Issues / Open Items

| # | เรื่อง | สถานะ |
|---|---|---|
| 1 | **Google Fit sync ตาย** — OAuth ยังเป็น Testing mode (refresh token อายุ 7 วัน) + Google ปิด Fit REST API สิ้นปี 2026 | ต้องเลือกทาง: Google Health API หรือ upload ไฟล์ |
| 2 | `NEXT_PUBLIC_SITE_URL` เคยชี้โดเมนเว็บไซต์ ทำให้ลิงก์ invite/reset 404 | ✅ แก้แล้ว 24 ก.ค. 2026 · ⚠️ env มีผลหลัง redeploy |
| 3 | CGM ยังไม่มีหน้า v2 | backlog |
| 4 | v1 ↔ v2 ยังอยู่คู่กัน | ทยอย cutover |
| 5 | **CGM passcode ทั้ง 8 profile เป็นค่าเดียวกัน + RPC ไม่มี rate limit** | 🚩 ค้าง — ควรหมุนรหัสและใส่ rate limit |
| 6 | Longevity Report ยังสร้างนอกระบบแล้วอัปโหลด | backlog — อยากให้เป็นปุ่มเดียวในแอป |
| 7 | ตารางจากโปรเจกต์อื่นปนอยู่ใน DB เดียวกัน (`budgets`, `losmtd`, ฯลฯ) | ยอมรับได้ แต่ backup/restore ต้องระวัง |

---

## 13. Roadmap

1. ปิดช่องว่าง v2 ให้ครบ แล้วเลิกใช้ v1
2. แก้เส้นทาง wearable (Google Health API หรือ upload) ให้ sync กลับมาได้
3. Longevity Report ให้เป็นปุ่มเดียวในแอป (ตอนนี้สร้างนอกระบบแล้วอัปโหลด)
4. ~~External API v1 → MCP server~~ ✅ ทำแล้ว (11–12 ก.ย. 2026) — `/api/mcp` + OAuth · claude.ai/ChatGPT ต่อตรงได้
5. หมุน CGM passcode + ใส่ rate limit
6. **★ UP Health Design** — ประเมินรวม 5 แหล่ง (แล็บ · BCA · CGM · นาฬิกา · อาหาร) → ร่างแผนเฉพาะบุคคลให้โค้ชยืนยัน → ลูกค้าใช้ผ่านแอปหรือ AI ของตัวเอง · สเปกร่าง: [SPEC-Health-Design.md](./SPEC-Health-Design.md) (รอ ต้น/จิ้น เคาะ Q1–Q7)

---

## 14. Changelog

| วันที่ | เปลี่ยนอะไร | commit |
|---|---|---|
| 2026-09-12 | **UP Health Design เฟส 1** — Assessment Engine 7 ด้าน (`lib/health-design/`) + ตาราง `health_assessments` + การ์ดบน Customer 360 + `/api/customers/[id]/assessment` + External API/MCP `getAssessment`/`runAssessment` + intent `assessment.get` + scope `assessment:*` + trigger หลังบันทึกแล็บ/BCA/CGM · +10 tests (146) · test runner รองรับ `@/` alias แล้ว (`tests/_resolve-ts.mjs`) | _pending_ |
| 2026-09-12 | **สเปกร่าง UP Health Design** (`docs/SPEC-Health-Design.md`) — ตรวจว่าคำโปรโมต 9 คำจริงแค่ไหนวันนี้ (4 จริง · 3 ครึ่ง · 2 ยังพูดไม่ได้: "ฐานข้อมูลขนาดใหญ่", "realtime") · 6 ชิ้นงาน · 4 เฟส · Q1–Q7 รอเคาะ · Roadmap ข้อ 6 · ยืนยันแล้วว่า OAuth MCP ใช้ได้จริง (connector `OAuth · Claude` อ่านข้อมูลได้) | `0ae4ae5` |
| 2026-09-12 | **OAuth 2.1 สำหรับ MCP** — discovery (RFC 8414/9728) · dynamic registration · หน้า consent `/oauth/authorize` · token/refresh/revoke · access token = `api_tokens` แถวปกติ · migration `20260912_oauth.sql` · +10 tests · claude.ai / ChatGPT connector ต่อได้ | `3aa21ea` |
| 2026-09-11 | **MCP server `POST /api/mcp`** — API ทั้งชุดเป็น MCP (Streamable HTTP, stateless, bearer) · tool derive จาก `buildSpec()` (`lib/mcp/tools.ts`) · JSON-RPC core pure (`lib/mcp/protocol.ts`) · handler table typed ด้วย `RouteKey` · +14 tests · `integrations/mcp/README.md` config ต่อ client | `b0d35c2` |
| 2026-09-11 | **GPT importer ปฏิเสธ description > 300 ตัวอักษร** (`submitLabResult` 327 · `importCgmFile` 411) — ตัดให้พอดี ย้าย how-to ไป GPT-INSTRUCTIONS · **แยก `buildSpec()` ออกจาก route เป็น `lib/api/openapi-spec.ts` (บริสุทธิ์ รับ scopes/intents เป็นพารามิเตอร์)** เพื่อให้เทสต์โหลด spec ได้โดยไม่ต้องรัน Next · เพิ่ม 4 เทสต์ปักกฎ importer: description ≤300 · ห้ามมี multipart · operationId ไม่ซ้ำ+มี summary · 3 operation CGM ต้องอยู่ — ทั้งสองข้อแรกเคยพังบน production แล้ว | (คอมมิตนี้) |
| 2026-09-11 | **GPT ตัด `importCgmFile` ทิ้งเพราะ multipart** — หลัง re-import schema แล้ว ChatGPT ยังบอกว่า action ไม่เปิดให้เรียก · OpenAI Actions ไม่รองรับ multipart/form-data และทิ้ง operation ทั้งตัว ไม่ใช่แค่ content type นั้น → เอา multipart ออกจาก spec ที่เผยแพร่ เหลือ JSON `{rows}` อย่างเดียว (เซิร์ฟเวอร์ยังรับ multipart) | (คอมมิตนี้) |
| 2026-09-11 | **CGM ผ่านคำสั่งภาษาคน + ทางที่ ChatGPT ส่งไฟล์ได้จริง** — ต้นลองจาก ChatGPT: token มีสิทธิ์แล้วแต่ `/query` ตอบ `unknown_intent` (ยังไม่มี intent CGM) และ Action ไม่เห็น endpoint ใหม่ (GPT จำ schema ตอนตั้งค่า ไม่ดึงใหม่เอง) · เพิ่ม intent `cgm.metrics` (คำนวณให้เลย) และ `cgm.import` (คืน 400 ชี้ไป `importCgmFile` พร้อมรูป JSON — เพราะ `/query` รับข้อความไม่รับไฟล์) · **ChatGPT Actions ส่ง multipart ไม่ได้** → เขียนใน OpenAPI description + GPT-INSTRUCTIONS ให้แกะ xlsx ด้วย code interpreter แล้วส่ง `{rows:[…]}` ทุกแถว ห้ามตัดทอน · ขั้นตอน re-import schema เขียนไว้ใน GPT-INSTRUCTIONS | (คอมมิตนี้) |
| 2026-09-11 | **🐛 PostgREST ตัด 1,000 แถวเงียบ ๆ** — เจอตอนยิงไฟล์จริง 1,423 ค่า: metrics นับได้ n=1000 พอดี วันสุดท้ายหายไปทั้งวัน ทั้งที่ `.limit(20000)` · `.limit()` ฝั่ง client ไม่ชนะ `max_rows` ฝั่งเซิร์ฟเวอร์ · แก้ `getReadings` ให้ไล่ `.range()` ทีละ 1,000 จนหน้าสั้น · **ลายเซ็นให้จำ: n ลงท้าย 000 พอดี = โดนตัด** | (คอมมิตนี้) |
| 2026-09-11 | **★ นำเข้าไฟล์ CGM (Ottai) + คำนวณ TIR/CV/GMI ผ่าน API** — ต้นสั่ง "รับไฟล์ Ottai บันทึกตามชื่อ แล้วเรียกมาดู/คำนวณได้" · พบว่าไม่มีโค้ดตัวไหนเขียน `cgm_readings` เลย (โหลดมือทั้ง 52k แถว) และ upcgm มี parser แต่ไม่ต่อฐาน · ทำที่ uplabs `/api/v1` เพราะมี token/scope/reach อยู่แล้ว · **จุดที่พลาดแล้วพังเงียบ: timezone** — ยืนยันจากแถวจริงว่า `reading_timestamp` = epoch ของเวลาไทย จึง fix Asia/Bangkok ในโค้ด ไม่ inferred · unique index กัน re-upload ซ้ำ · parser + metrics เป็นฟังก์ชันบริสุทธิ์ 19 เทสต์ | (คอมมิตนี้) |
| 2026-08-31 | **★ คิวตรวจสอบผลแล็บที่ AI อ่านมา** (ต้นเคาะทาง A) — เดิม API รับได้แค่ JSON ที่ถอดค่าแล้ว และถ้าปล่อยให้ผู้ช่วย AI เขียนตรงจะขัดกฎของโปรเจกต์เอง ("ค่าสุขภาพห้ามเดาจากภาพ" + "ค่าจาก AI ต้องให้คนยืนยัน") · LLM อ่านใบแล็บผิดได้ทั้งเลขติดกัน หน่วยสลับ พ.ศ./ค.ศ. และแถวเหลื่อม — เขียนตรงแล้ว **แยกไม่ออกจากค่าที่คนพิมพ์** และไหลต่อไปที่รายงาน Longevity/PhenoAge/กราฟ · เพิ่ม `pending_lab_imports` + scope `labs:submit` + `POST /labs/submit` + หน้า `/v2/lab-inbox` ที่โชว์ค่าคู่กับข้อความที่ AI อ่านได้ แก้ตรงช่องได้ **บันทึกตามที่คนแก้** · `lib/api/lab-import.ts` ตั้งธงเตือนแต่ไม่เดาแทน + 17 เทสต์ | (คอมมิตนี้) |
| 2026-08-31 | แก้เทสต์ที่ flaky: `secret.slice(0,-1)+"X"` เท่าเดิมเมื่อ secret สุ่มลงท้ายด้วย X (~1 ใน 57 รอบ) — เทสต์ที่แพ้บางรอบคือเทสต์ที่เชื่อไม่ได้ | (คอมมิตนี้) |
| 2026-08-30 | **ตรวจเฉพาะฟิลด์ที่ส่งมา ไม่ merge ค่าเดิม** — เจอตอนทดสอบกับ production: การ merge แถวเดิมมาตรวจทั้งใบ ทำให้โปรไฟล์ที่**วันเกิดผิดอยู่แล้ว** (เช่นกรอกเป็น พ.ศ. ก่อนมีตัวตรวจ) **แก้อะไรไม่ได้เลย** — จะแก้ชื่อหรือส่วนสูงก็ติดวันเกิดเก่า และ error พูดถึงฟิลด์ที่ผู้ใช้ไม่ได้แตะ · แต่โปรไฟล์ที่ข้อมูลผิดคือโปรไฟล์ที่คนต้องแก้พอดี → ตรวจทีละฟิลด์ที่ส่งมาจริง + 6 เทสต์ | (คอมมิตนี้) |
| 2026-08-30 | **แก้ไขข้อมูลลูกค้าได้ในหน้า 360 + อุดช่องโหว่ RLS ที่ upline เขียนไม่ได้** — (1) เพิ่ม dialog แก้ ชื่อ/เพศ/วันเกิด/ส่วนสูง (เดิมต้องไปหน้า v1) · `validateProfileEdit()` เป็นฟังก์ชันบริสุทธิ์ + 12 เทสต์ ใช้ร่วมกันทั้ง client และ API — **ดัก พ.ศ. ในช่อง ค.ศ.** ซึ่งจะเพี้ยนทั้งอายุ เกณฑ์อ้างอิง PhenoAge โดยไม่มีอะไรดูผิด · (2) **🔒 RLS ไม่มี UPDATE policy สำหรับ downline** ทั้งที่ RBAC 24 ก.ค. ประกาศว่า upline เขียนได้ — route ปล่อยผ่าน แต่ Postgres ปฏิเสธ UPDATE ไม่โดนแถวไหน แล้ว `.select().single()` พัง กลายเป็น 500 ที่อธิบายไม่ได้ · ปุ่มปิดใช้งานเป็นตัวแรกที่ไปโดน เพราะเป็น write ระดับแถวแรกที่ upline มีเหตุให้ทำ · (3) `/360` คืน `meta.canManage/isOwner/isAdmin` → ปุ่มโชว์เฉพาะคนที่กดได้ | (คอมมิตนี้) |
| 2026-08-30 | **ปิดใช้งานโปรไฟล์ลูกค้าได้ (retire ไม่ใช่ลบ)** — โปรไฟล์เก่า/ซ้ำ/ที่สร้างไว้ทดสอบ ทำให้รายการรก และเปิดผิดคนได้ง่าย · แต่ลบไม่ได้เพราะประวัติแล็บคือตัวบันทึก ลบแล้วหายถาวร → เพิ่ม `customers.disabled_at/_by/_reason` · ซ่อนจากรายการ · ค้นหา · dropdown ผูก LINE · รายชื่อมอบหมาย co-coach · ตัวนับหน้าแรก · และการค้นชื่อของ External API (สำคัญ: ผู้ช่วย AI ที่ไปเจอโปรไฟล์ซ้ำจะตอบจากข้อมูลผิดคนโดยไม่มีใครเห็น) · **LINE bot หยุดส่งเมนูรายวัน** ให้โปรไฟล์ที่ปิดแล้ว · เปิดหน้าตรงยังได้พร้อมป้ายเตือน · `/api/v1/customers/{id}` คืน `retired: true` ให้ผู้ช่วยรู้ตัว · เปิดกลับได้ทุกเมื่อ | (คอมมิตนี้) |
| 2026-08-29 | **`integrations/` — ไฟล์พร้อมใช้สำหรับต่อผู้ช่วย AI** · `claude-skill/` (SKILL.md + สคริปต์ห่อทุก endpoint ไม่ให้ผู้ช่วยเขียน curl เอง ซึ่งเป็นจุดที่ token รั่วเข้า transcript) · `chatgpt/GPT-INSTRUCTIONS.md` · `DROP-IN.md` (วางในแชทไหนก็ได้) · **บันทึกข้อจำกัดจริงไว้: ChatGPT แชทธรรมดายิง HTTP เองไม่ได้** ไฟล์อัปโหลด = ความรู้ ไม่ใช่ความสามารถ และ GPT ตั้ง Actions ให้ตัวเองไม่ได้ | (คอมมิตนี้) |
| 2026-08-29 | **`/openapi.json?flavor=gemini`** — Gemini รับ OpenAPI แค่ subset (type, nullable, required, format, description, properties, items, enum) · สคีมาเรามี `default` 5 จุด + `maximum` 2 จุด ซึ่งอาจทำให้ Gemini ปฏิเสธ tool definition แล้วแสดงอาการเป็น "ไม่ยอมเรียก API" โดยไม่มี error ที่อ่านรู้เรื่อง → flavor นี้ตัด key ที่ไม่รองรับออก **แต่ย้ายความหมายไปต่อท้าย `description`** (โมเดลยังรู้ค่าเริ่มต้นและเพดาน) + 5 เทสต์ | (คอมมิตนี้) |
| 2026-08-29 | **🔒 ผูก API token เข้ากับลำดับชั้นผู้ใช้** — เดิม `customer_scope` เป็นข้อความอิสระที่แอดมินพิมพ์เอง ไม่ผูกกับคน (`created_by` เป็น null ได้) · `all` ไม่เคยตรวจซ้ำว่าเจ้าของยังเป็นแอดมินไหม · `list:` ใส่ลูกค้านอกสายงานได้ → เพิ่ม `api_tokens.owner_user_id` (บังคับ) · **ขอบเขตคำนวณสดจากบทบาท+ตำแหน่งสายงานของเจ้าของทุก request** ไม่ใช่อ่านจากข้อความที่ freeze ไว้ · `all` ลดเหลือ `owner` อัตโนมัติเมื่อเจ้าของไม่ใช่แอดมินแล้ว (รายงานใน /meta) · `list:` ตัดกับสายงานเจ้าของ · โปรไฟล์เจ้าของหาย = token ตาย · สร้างลูกค้าผ่าน API ผูกกับเจ้าของเสมอ · `lib/api/reach.ts` แยกเป็นฟังก์ชันบริสุทธิ์ + 12 เทสต์ | (คอมมิตนี้) |
| 2026-08-29 | **🔒 อุดช่องโหว่: token ที่เพิกถอนแล้วยังใช้ได้บน GET** — App Router แคช `fetch` ใน GET handler และ supabase-js ยิง query ผ่าน fetch ตัวเดียวกัน → **คำตอบจากฐานข้อมูลถูก reuse** · `dynamic = "force-dynamic"` คุมแค่การ render ไม่ได้คุม data cache · อาการจริง: เพิกถอน token แล้ว `GET /api/v1/meta` ยังตอบ 200 พร้อม scope ชุดก่อนเพิกถอน ขณะที่ `POST /api/v1/query` ตอบ `token_revoked` ถูกต้อง (POST ไม่ถูกแคช) → บังคับ `cache: "no-store"` ที่ `createAdminClient()` ที่เดียว + ใส่ `Cache-Control: no-store` ทุก response ของ API · **กระทบทั้งแอป ไม่ใช่แค่ /api/v1** เพราะ client ตัวนี้คืออำนาจตัดสินสิทธิ์ | (คอมมิตนี้) |
| 2026-08-29 | **External API: แก้ 2 อย่างที่เจอตอนทดสอบกับข้อมูลจริงบน production** — (1) `/labs/compare` เคยนับค่าน้ำตาลปลายนิ้วที่วัดเองที่บ้าน (1 ค่า/วัน) เป็น "รอบตรวจ" ทำให้ขอ 3 รอบแล้วได้ปลายนิ้ว 2 + แล็บ 1 การเทียบจริงหลุดหาย → ข้ามรอบที่มีค่าเดียวโดยปริยาย + รายงานใน `skipped_rounds` (`selectRounds` แยกเป็นฟังก์ชันบริสุทธิ์ + เทสต์) · (2) ชื่อที่ตรงเป๊ะกับลูกค้าคนเดียวใช้ได้เลย ไม่งั้นชื่อที่ไปปรากฏในชื่อคนอื่นจะถามไม่ได้ตลอดกาล | (คอมมิตนี้) |
| 2026-08-29 | **External API v1** — ให้ระบบ AI ภายนอกดึง/อัปเดตข้อมูลด้วย token ที่แอดมินกำหนด scope · `POST /api/v1/query` แปลคำสั่งภาษาคนด้วย intent resolver แบบกฎ (ไม่มี LLM ฝั่งเรา) · เพิ่ม `api_tokens` + `api_token_logs` + หน้า `/v2/admin/api-tokens` · สเปกเต็มที่ `SPEC-External-API.md` | (คอมมิตนี้) |
| 2026-08-29 | **PRD v2.0 + เอกสารเป็นไฟล์ generate** — ขยาย PRD ให้ครบทุก route/ตาราง/env/security · เพิ่ม `scripts/build-docs.mjs` แปลง `.md` → `.html` (`npm run docs`) เพื่อเลิกดูแล HTML สองชุดด้วยมือ ซึ่งเป็นสาเหตุที่เอกสารเคยไม่ตรงโค้ด | (คอมมิตนี้) |
| 2026-07-25 | **AI call รวมที่เดียว + error ไม่โทษคีย์มั่ว** — เพิ่ม `lib/gemini-call.ts` ส่ง `thinkingLevel: "minimal"` + retry ตัด thinking อัตโนมัติถ้าโมเดลไม่รับ · 400 = คีย์ผิดเฉพาะเมื่อ Google พูดถึง api key | `19adc03`, `c7f21e3` |
| 2026-07-25 | **โมเดล AI: เลิก hardcode รุ่น** — Google หยุดให้บริการ `gemini-2.5-flash` กับคีย์ใหม่ ทุกฟีเจอร์ AI เลย 404 · ย้ายไป alias `gemini-flash-latest` | `ed3ab24` |
| 2026-07-25 | **RBAC: upline ดูแลได้ทุกระดับชั้นลงไป (อ่าน+เขียน)** — เพิ่ม `canManageCustomer()` แล้วสลับ 26 จุดใน 24 route · อุดช่องโหว่ `POST /api/customers/[id]/measurements` ที่ไม่มีเช็คสิทธิ์เลย | `160d22a` |
| 2026-07-25 | NutriScan: เช็คสิทธิ์เฉพาะตอนบันทึก + เปลี่ยน `forbidden` ดิบเป็นข้อความไทย | `0fee046` |
| 2026-07-25 | แยก error คีย์ AI 400 (คีย์ผิด) จาก 403 (คีย์ถูกแต่ไม่มีสิทธิ์) + สร้าง PRD/ARCHITECTURE ฉบับแรก | `26471b2` |
| 2026-07-25 | setup hint ชี้โดเมนของแอปเอง | `32e09cd` |
| 2026-07-16 | เพิ่ม user dropdown + logout ใน v2 Shell | `077ea56` |
| 2026-07-16 | strip trailing slash ทุก link builder (แก้ `//join` 404) | `910590d` |
| 2026-07-16 | ข้อความ "ขอคีย์ใหม่" แทน error ดิบ ทุกฟีเจอร์ BYO key + `lib/gemini-error.ts` | `710c7a7`, `ed597e4` |
