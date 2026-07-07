# UP Labs — Redesign Specification (v2.3 · BUILT)

_SPEC v2.3 · BUILT · 2026-07-07 · repo `upwellness/uplabs` · Supabase project `qzqvwbucjxwgtmbdkrlu` · Hosting Vercel (`sin1`)_
_v2.3: + อายุสุขภาพ (Health Age/PhenoAge) เป็น big-score #2 ของลูกค้า (§7.11) · BCA/status = ไฟจราจรคลินิก 5 ระดับ ตามเกณฑ์การประเมินทางการ (§7.2)_

> เอกสารคู่กับ `docs/SPEC-v2.html` (เนื้อหาตรงกัน) · status ล่าสุดของงานที่กำลังทำ ดู `docs/SESSION_STATUS.md`

---

## 1 · Executive Summary

UP Labs = แพลตฟอร์มสุขภาพ-longevity ของ UP Wellness (Next.js 14 App Router + Supabase + Vercel). v1 ถูกติว่า "ไม่สวย/ใช้ยาก" เพราะ UI ไม่ตรง brand (glass/aurora/emoji/mono-uppercase). **v2 = redesign "clinical-warm"** สร้างขนานใต้ `/v2/*` โดยใช้ API + data เดิม แล้วค่อย cutover.

- **14 modules** สร้างครบ + live
- **100% parity** v1 + ฟีเจอร์เพิ่ม
- **0** schema/API breaking change
- `/v2` auth-gated · พร้อม cutover

**กระบวนการ:** Dev (multi-agent) → Tester functional + non-functional → User+BA parity ต่อ module → fix → ship. UAT จริงพบ runtime bugs ที่ static ไม่จับ (ดู §11).

---

## 3 · กลยุทธ์ /v2 — สร้างขนาน, cutover เมื่อพร้อม

สร้าง v2 ใต้ `/v2/*` โดยไม่แตะ schema/API เดิม · แต่ละหน้าใช้ endpoint เดียวกับ v1 · cutover (root→v2) ทำเมื่อ UAT ครบ (ดู §12).

---

## 4 · ★ Customer Identity Block (บังคับ)

ทุกหน้าที่แสดง customer ต้องมี IdentityBlock — ชื่อ · อายุ · เพศ · (ส่วนสูงถ้าเกี่ยว) — component เดียวใช้ทั้งแอป (`lib/v2/IdentityBlock`).

## 5 · Design System (clinical-warm)

Tailwind custom tokens (rose/wellness/science/olive/gold/ink) · Manrope + Sarabun + JetBrains Mono · Lucide icons · ไม่มี glass/aurora · status = single token system (`lib/medical-status`).

## 6 · Global Patterns

App Shell (`app/v2/_components/Shell.tsx` — top bar + app switcher + breadcrumb + user/role) · loading/empty/error ทุกหน้า · recharts/jsPDF/html-to-image lazy.

---

## 7 · Features (สร้างครบ)

### 7.1 · Hub · Customers · Customer 360 — live
- **Hub** `/v2` — app launcher จัดหมวดตาม role+grant
- **Customers** `/v2/customers` — ค้นหา/กรอง · การ์ด ชื่อ+อายุ+เพศ+สถานะ+ป้าย · รวม "ของฉัน + ที่ถูกแชร์ + ของ downline"
- **Customer 360** `/v2/customers/[id]` — IdentityBlock · status · action bar · Vital Dashboard (gauge + 6 metric) · Insights · Timeline 90 วัน · 8 tabs (Body·Labs·Trends·Allergy·CGM·Supplements·Pulse·Notes)

### 7.2 · BCA + Labs body-map — live
- **BCA** `/v2/bca` — ฟอร์มวัด · gauges · trend · BMI · ตารางประวัติ + แก้/ลบ · ReportBuilder (PNG) · **BCA Scan Reveal** (`/v2/bca` cinematic). อ่านข้อมูลผ่าน `/api/customers/[id]/360` + `/measurements`
- **★ Status = ไฟจราจรคลินิก 5 ระดับ (v2.3)** ตาม**เกณฑ์การประเมินทางการ**ของคลินิก (แยกเพศ ป้ายรายค่า): เขียวเข้ม#166534→เขียว#16A34A→เหลือง#C18A03→ส้ม#EA580C→แดง#DC2626 · Fat `ต่ำ/ปกติ/เริ่มอ้วน/อ้วน` · Muscle `ต่ำ/ปกติ/สูง/สูงมาก` · V.Fat `ดี/ปกติ/เริ่มเสี่ยง/เสี่ยงสูง/อันตราย` · BMI `ผอม/ปกติสุขภาพดี/อ้วน1-3` · เกณฑ์+สีเดียว (`lib/medical-status.ts` `bandX`/`statusHex`) ใช้ทั้งแอป (gauge/scan/labs/badge) — scan mirror lib เป๊ะ (cross-check)
- **Labs tab** — panel ตามหมวด + ref + status · trend charts · ปุ่ม BodyView (metric→อวัยวะ·สีตามสถานะ)

### 7.3 · UP Pulse + Report — live
- Hub · master/[id] (WHOOP CSV+OAuth · Apple · Google Fit · CGM link) · assessments (Gemini) · intake/connect/invite (public)
- **Wearable Report** `/v2/pulse/report/[id]` — ดีไซน์ Pook (olive/gold) · score gauges · TOC · sections recovery/HRV/sleep/SpO2/strain/workout + labs + BCA/CGM/อาหาร (conditional) + วิเคราะห์รวม · print

### 7.4 · NutriScan · Plate Planner · Designer — live
NutriScan (customer/วัน `eaten_on`/มื้อ · หมายเหตุเข้า Gemini · %ส่วนประกอบ · history) · Food Log (แก้/ลบ) · Plate Planner (3 เป้าหมาย · pie+bar · PDF ตรง) · Designer (wizard 5 ขั้น · PNG)

### 7.5 · CheckForm · Prospects · Leads — live
CheckForm (FORM wizard + AI analyze + STP clips) · Prospects (tier + convert) · Health Check leads admin · public /check /metaflex

### 7.6 · LINE Bot — live
`/v2/line-bot` ผูกกลุ่ม + config ต่อ customer · webhook · cron · co-coach gate

### 7.7 · CGM — live
CGM tab → /cgm analyzer (iframe) · passcode = hash · panel admin "จัดการรหัสผ่าน CGM" (RPC `cgm_admin_set_passcode`)

### 7.8 · Reports — live
Med-Map (auth) · Longevity Lab Report (auth + public `/r/lab/<token>` noindex) · Wearable Report (olive/gold · print)

### 7.9 · Admin · RBAC · Co-coach — live
- Users (role member/abo/admin/other · app grants · reset/create) · Backup · admin gate
- **★ Co-coach** — admin assign ลูกค้าให้ user อื่นเห็น+แก้ได้ (`customer_assignments` · RLS additive 23 ตารางลูก · ลบ/มอบต่อ = เจ้าของ+admin)

### 7.10 · Team hierarchy · View-as · Invitations — ★ ใหม่

- **★ MLM hierarchy** — `profiles.parent_id` (upline 1 คน/user) · ฟังก์ชัน `profile_descendant_ids()` ไล่ downline **ทุกชั้น** · **upline เห็น customer ของ downline ทั้งสาย (read-only)** — ขยาย read surface ทุกจุด (list · 360 · BCA/`measurements` · lab-report · med-map · notes GET · pulse · records · line-bot) ด้วย `isDownlineCustomer`/`downlineUserIds` (`lib/customers/access.ts`) + RLS `downline_select` (SELECT-only) 24 ตาราง · **write คงเป็น owner/co-coach เท่านั้น**
- **★ Admin จัดสายงาน** — `setUserParent(user, parent|null)` (กัน cycle ด้วย descendant check) · UI "สายงาน (Upline)" ใน admin user row (ค้นหา user → ตั้ง/ถอด upline)
- **★ Invitation signup** — user ทุกคนสร้างลิงก์เชิญได้ (`/v2/invite` · `lib/invites/actions.ts`) · single-use · หมดอายุ 14 วัน · invitee เปิด `/join/[token]` ตั้ง password เอง + email จริง → auto sign-in → กลายเป็น downline ของผู้เชิญ (role `abo`) · public `/api/join` ตรวจ token ฝั่ง server · ตาราง `user_invites`
- **★ View-as (admin)** — จำลองเป็น user อื่นเพื่อทดสอบมุมมอง · **read-only** (middleware บล็อก mutating `/api/*` ขณะ view-as) · cookie `up_view_as` (httpOnly) · banner + ปุ่มออก · audit `admin_view_as_log` · `getSession()` คืน target ส่วน `requireAdmin()`/`getRealSession()` เช็คตัวจริงเสมอ
- **v2 เพิ่มลูกค้าใหม่** — modal ใน `/v2/customers` (เดิมต้องกลับ v1) → `POST /api/customers` → `/v2/customers/[id]`

### 7.11 · ★ อายุสุขภาพ (Health Age · PhenoAge) — ★ ใหม่ (v2.3, live)

- **แนวคิด:** "อายุร่างกาย" จากค่าเลือด 9 ตัว (albumin · creatinine · glucose(fbs) · CRP/hs-CRP · lymphocyte% · MCV · RDW · ALP · WBC) + อายุจริง → โมเดล **PhenoAge (Levine 2018 · Liu et al., PLOS Med)**. วางเป็น **big score #2 ของลูกค้า** (คู่กับ Health Score) เพื่อ*ติดตามแนวโน้ม “แก่ช้า”* — **ไม่ใช่การวินิจฉัย** (มี disclaimer บังคับ · ไวต่ออักเสบเฉียบพลัน → เตือนเมื่อ CRP>3 หรือ WBC>11).
- **สูตร = `lib/bio-age.ts`** (coefficient verified: test case healthy52→38.3, default→42.1) · `bandX`/level ใช้ภาษาสีเดียวกับ BCA (classifyBodyAge) · **แหล่งเดียว** ใช้ทั้ง 360-gauge และหน้าเครื่องคำนวณ.
- **Customer 360** (`/v2/customers/[id]`) — Vital Dashboard โชว์วง "อายุสุขภาพ" ถัดจาก Health Score: ถ้าค่าเลือดครบ 9 ตัว **คำนวณอัตโนมัติ** (server ใน `/360` → `bioAge`) + pill อ่อน/แก่กว่าวัย; ถ้าไม่ครบ → "ตรวจเพิ่ม N ตัว" + ปุ่มไปเครื่องคำนวณ.
- **เครื่องคำนวณ** `/v2/bio-age?customer=<id>` — customer picker → **prefill ค่าจากแล็บอัตโนมัติ** (`GET /api/customers/[id]/bio-age`, ดึง latest ต่อ marker + เดาหน่วย) → โค้ชเติมที่ขาด (dropdown หน่วย กันเลขเพี้ยน) → คำนวณ client-side → วงอายุ + delta + breakdown "อะไรเร่ง/ชะลออายุ" + คำเตือนอักเสบ + disclaimer. เพิ่มใน launcher (`apps-registry` slug `bio-age`, business).
- **ไม่มีตารางใหม่** — อ่านจาก `customer_lab_values` (metric_key: `albumin/creatinine/fbs/hs_crp|crp/lymphocytes/mcv/rdw/alp/wbc`). ⚠️ ปัจจุบันลูกค้าส่วนใหญ่ยังไม่มี CRP/lymphocyte%/RDW → มักต้องเติมมือ.

---

## 8 · Tech Stack

| ชั้น | เทคโนโลยี |
|------|-----------|
| Framework | Next.js **14.2.15** App Router · React 18 · TS (_params sync — ห้าม `use(params)`_) |
| UI | Tailwind (custom tokens) · Lucide · recharts (lazy) · SVG gauges · html-to-image + jsPDF |
| Data | Supabase `qzqvwbucjxwgtmbdkrlu` — Postgres + RLS + Auth + Storage + RPCs · `createClient` (RLS) / `createAdminClient` (service-role) |
| AI | Gemini (BYO key) — NutriScan vision · checkform · pulse assess |
| External | WHOOP · Apple Health · Google Fit · LINE Messaging |
| Hosting | Vercel · `sin1` · repo `upwellness/uplabs` |

## 9 · Data Model (ตารางหลัก)

| ตาราง | ใช้ทำอะไร |
|-------|-----------|
| `customers` | ลูกค้า · `coach_id` เจ้าของ · `cgm_profile_names[]` |
| `customer_assignments` ★ | co-coach (customer_id, user_id, assigned_by) · RLS additive |
| `measurements` | BCA: weight/fat_pct/muscle_pct/visceral/body_age/bmr/recorded_at |
| `customer_lab_values` / `customer_records` | ผลแล็บ · document_type · source token |
| `nutriscan_scans` | customer · meal_type · `eaten_on` · notes · macros |
| `cgm_profiles / cgm_readings / cgm_meals` | passcode_hash · glucose · RPC SECURITY DEFINER |
| `whoop_daily · pulse_readings · pulse_assessments` | wearable · assessment |
| `profiles` · `user_app_grants` | role + per-app grants · ★ `parent_id` = upline · `profile_descendant_ids()` |
| `user_invites` ★ | ลิงก์เชิญ (token · created_by=upline · role · used_at · expires_at) single-use 14 วัน |
| `admin_view_as_log` ★ | audit view-as (admin_id · target_user_id · action) |
| RLS `downline_select` ★ | SELECT-only ให้ upline อ่าน customers + 23 ตารางลูกของ downline ทั้งสาย |

## 10 · Non-Functional (achieved)

- **Perf:** recharts/jsPDF/html-to-image lazy · Customer 360 = 1 round-trip · region sin1 + cache
- **A11y:** WCAG AA — status สีเข้ม · aria-label · keyboard tabs · touch ≥44px · reduced-motion
- **Security:** RLS owner/admin/co-coach/**downline (read-only)** · auth-gated /v2 · public report = token เดาไม่ได้ + noindex · view-as read-only (mutations blocked) · invite token single-use + server-validated
- **Reliability:** loading/empty/error ทุกหน้า · defensive enum lookups · error boundary

## 11 · Changelog & Gotchas (UAT lessons)

| อาการ | สาเหตุ + แก้ |
|-------|--------------|
| customer/pulse detail error | `use(params)` (Next 15) บน Next 14 → **แก้: sync `const {id}=params`** |
| ชื่อผู้ใช้ไม่ขึ้น | Shell ไม่ได้รับ profile prop → **แก้: Shell fetch /api/debug/me** |
| /v2/healthcheck crash | enum free-text `RISK_META[x]` undefined → **แก้: defensive riskMeta()** |
| back กลับ v1 | app-switcher ชี้ v1 → **แก้: V2_ROUTE map** |
| Plate PDF เงียบ/เปล่า | ref บน next/dynamic ไม่ forward + wrapper opacity:0 → **แก้: static import + capture root + crop multi-page** |
| pie สีไม่ตรง bar | hardcode สี → **แก้: prop colors unify (คาร์บ=rose·โปรตีน=wellness·ไขมัน=amber)** |
| NutriScan หมายเหตุไม่ช่วย AI | prompt hardcode "ไม่มี" → **แก้: ส่ง customer_note เข้า Gemini** |
| assign co-coach chip โชว์ "—" | `listUsers` สร้าง customerName จาก query ที่ filter `coach_id not null` → ลูกค้าไร้ coach โชว์ "—" → **แก้: เอา filter ออก** |
| build พังบน prod หลังเพิ่ม view-as | `getSession()` return type infer เป็น union → **แก้: ประกาศ interface `Session`** (`next build` ให้ผ่านก่อน push) |
| upline เปิด BCA ของ downline → forbidden | ครั้งแรกขยาย downline read แค่ list+360+detail แต่ BCA เรียก `/measurements` ด้วย → 403 → **แก้: ใส่ `isDownlineCustomer` ครบทุก read endpoint/page (write คงเดิม)** |

**กฎทอง:** Next 14 → ห้าม `use(params)` · `next build` ให้ผ่านก่อน push · migration → apply + `get_advisors` · enum DB free-text → guard lookup · downline = read-only (ห้าม widen write path) · agent verify ได้แค่ tsc/build → runtime ต้อง UAT.

## 12 · Status & Remaining

**เสร็จ + live:** ทุก module (§7) · co-coach · identity block · design system · report Pook · NutriScan ++ · Labs body-map · CGM passcode · UAT fixes · **★ MLM team hierarchy (downline read-only ทั้งสาย) · invitation signup · admin view-as · v2 เพิ่มลูกค้า**

**เหลือ (รอ Toni เคาะ):**
- **Cutover** v1→v2 default — รอเลือก scope 3 แบบ: (1) root+login→v2 **และ** redirect หน้า v1 ที่มีคู่ v2 (คง v1 เป็น backup+fallback) · (2) เฉพาะ root/login→v2 (URL v1 ยังเข้าได้) · (3) ย้าย v2 มา root จริง + v1→`/v1`. **tag v1 เป็น restore point ก่อนแตะ routing** · ระวัง v2 บางหน้า link กลับ v1 ด้วย `?legacy=1`
- **RLS** cgm_readings/cgm_meals — เปิดหลังเช็ค iframe
- **Invitation** — ยังไม่ verify email (ตามดีไซน์) — harden ทีหลังถ้าต้องการ
- live UAT ทุกหน้า (โดยเฉพาะ report ที่ agent render สดไม่ได้)

> เอกสารมีชีวิต — เมื่อ scope/behavior เปลี่ยน อัปเดตไฟล์นี้ + `SPEC-v2.html` + changelog ก่อนปิดงาน.
