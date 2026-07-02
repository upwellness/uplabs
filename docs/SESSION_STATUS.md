# Session Status — uplabs (สรุปไว้ทำต่อ)

_อัปเดตล่าสุด: 2026-07-02 (v2 = site หลักแล้ว) · branch: `claude/assign-coach-admin-bug-u3u48r` · main tip: `1315bad` · deploy model: push branch → `main` = production (fast-forward), Supabase migrations apply ตรงเข้า prod project `qzqvwbucjxwgtmbdkrlu`_

## ✅ งานที่ deploy ขึ้น production (`main`) แล้ว

| Commit | เรื่อง |
|--------|--------|
| `65a95f6` | Fix assign-coach: chip โชว์ "—" สำหรับลูกค้าที่ยังไม่มี coach (เอา filter `.not("coach_id","is",null)` ออกจาก `listUsers` ที่ใช้สร้าง `customerName`) |
| `36e2928` | **View-as** (admin ดูแอปในมุมมอง user อื่น · read-only) |
| `48bf2af` | View-as ให้ไปหน้า v2 (`/v2`) แทน v1 |
| `3017e98` | **v2: ปุ่มเพิ่มลูกค้าใหม่** (v2 เดิมไม่มี — port modal + `POST /api/customers`) |
| `3dd5f8a` | **MLM hierarchy + invitation signup** (schema + invite + downline read-only core) |
| `0a17f9e` | **Fix: ขยาย downline read-only ให้ครบทุก read surface** (BCA/labs/pulse/records/notes/line-bot) |
| `54639f7` | **docs: SPEC v2.2** (html + สร้าง `SPEC-v2.md` · section 7.10 · data model · changelog) |
| `1315bad` | **★ Cutover: v2 เป็น site หลัก** (root + landing + login → /v2 · `next.config` redirects) |

### Supabase migrations ที่ apply เข้า prod แล้ว
- `admin_view_as_log` (audit log ของ view-as)
- `user_hierarchy_invites` → `profiles.parent_id`, ฟังก์ชัน `profile_descendant_ids(root)`, ตาราง `user_invites`, RLS `downline_select` (SELECT-only) บน customers + 23 child tables

## 🎯 ฟีเจอร์หลัก — สถานะ + จุดสำคัญ

### 1. View-as (admin จำลองเป็น user อื่น · read-only)
- `lib/auth/session.ts`: `getSession()` อ่าน cookie `up_view_as` → คืน profile ของ target; `getRealSession()`/`requireAdmin()` เช็คตัวจริงเสมอ
- `lib/auth/view-as.ts`: `startViewAs`/`stopViewAs` (audit `admin_view_as_log`)
- `middleware.ts`: บล็อก mutating `/api/*` ทุกตัวขณะ view-as (read-only)
- ปุ่ม "👁 View as" ที่แต่ละแถวใน `/admin/users` (v1+v2)

### 2. MLM hierarchy (upline เห็น customer ของ downline · **read-only · ทุกชั้น**)
- ผู้ใช้ตัดสินใจไว้: read-only · ทุก user เชิญได้ · เห็นลึกทุกชั้น
- `lib/customers/access.ts`: `downlineUserIds()`, `isDownlineCustomer()` (ใช้ admin client · แยกจาก `isAssignedToCustomer` ที่เป็น read+write)
- Read surfaces ที่ขยายแล้ว (ใส่ `isDownlineCustomer`): `/api/customers/list`, `/api/customers/[id]/360`, `/measurements` (BCA), `/lab-report`, `/med-map`, `/notes` (GET only ผ่าน flag `allowDownline`), `/api/pulse/customers/[id]` + `/debug`, และ pages: `customers/[id]`, `records` (list+detail), `pulse/master|report|assessments` (v1+v2), `line-bot` (v1+v2)
- Read routes ที่ใช้ session client (labs/allergies/records GET) → คุมด้วย RLS `downline_select` ที่ migration เพิ่มให้แล้ว
- **Write paths ไม่แตะ** (owner/co-coach เท่านั้น) = downline read-only จริง
- Admin จัดสายงาน: `setUserParent(userId, parentId|null)` ใน `app/admin/users/actions.ts` (กัน cycle ด้วย `profile_descendant_ids`) + UI "สายงาน (Upline)" ใน v2 UserRow (`app/v2/admin/users/_v2/UserRow.tsx`)

### 3. Invitation signup
- `lib/invites/actions.ts`: `createInvite/listMyInvites/revokeInvite` (ทุก user เชิญได้ · role invited = **`abo`** · single-use · หมดอายุ 14 วัน)
- `app/api/join/route.ts` (public, token-gated): สร้าง auth user, ตั้ง `parent_id = inviter`, burn token
- `app/(auth)/join/[token]/` page + `RegisterForm` (invitee ตั้ง password เอง + email จริง → auto sign-in → `/v2`)
- `middleware.ts` PUBLIC_PATHS: เพิ่ม `/join`, `/api/join`
- UI: `app/v2/invite/page.tsx` + ลิงก์ "ชวนสมาชิกใหม่" ใน app switcher (`app/v2/_components/Shell.tsx`)

## 🔎 BCA forbidden — ตรวจแล้วว่าแก้ถูก (รอ confirm หลัง deploy)
ผู้ใช้รายงาน: เปิด BCA ของ downline ขึ้น "forbidden" หลัง commit `0a17f9e`
- **ตรวจ prod DB จริงแล้ว**: hierarchy ตั้งไว้ (3 คนมี upline), ฟังก์ชันไล่ downline ถูก, RLS test ในมุม upline → เห็น customer + BCA 27 ครั้ง ✅
- โค้ดแก้ครบ (`/360` + `/measurements`); หน้า v2 BCA (`app/v2/bca/page.tsx:185-190`) throw ถ้า **ตัวใดตัวหนึ่ง** error
- **สรุป: fix ถูกต้อง — forbidden ที่เหลือคือ deploy ยังไม่ขึ้น/cache** วิธีเช็ค build ใหม่: เห็นเมนู "ชวนสมาชิกใหม่" = build ใหม่ขึ้นแล้ว
- **TODO ถ้ายัง forbidden หลัง build ใหม่**: ตรวจ deploy log / Vercel pipeline

## ✅ Cutover: v2 เป็น site หลัก (ทำแล้ว · option 1)
เลือก scope แบบแนะนำ: root + login + หน้า landing v1 ที่มีคู่ v2 → redirect ไป v2 · คง v1 เป็น backup + `?legacy=1` fallback
- `next.config.mjs` → `redirects()` (`V2_LANDING_REDIRECTS`): `/`→`/v2` + 13 landing (customers/bca/pulse/checkform/prospects/healthcheck/nutriscan[/log]/plate-planner/designer/line-bot/admin·users/admin·backup) · **exact path เท่านั้น** (หน้า `[id]` ลึกไม่ redirect — คง fallback) · `permanent:false` (307 · revert ง่าย)
- `app/(auth)/actions.ts` `signIn`: default `next` → `/v2` (bare `/` → `/v2`)
- `middleware.ts`: authed เปิด `/login` → เด้ง `/v2`
- **ไม่ redirect**: apps ที่ไม่มีคู่ v2 (cgm · cards · content soon) และหน้า `[id]` ลึกทั้งหมด
- **Restore point ก่อน cutover**: branch `backup/v1-2026-07-02` @ `0a17f9e` (บน remote) · _tag push ไม่ผ่าน proxy จึงใช้ branch แทน_
- **วิธี revert**: ลบ/คอมเมนต์ `redirects()` ใน `next.config.mjs` + คืน `signIn` default เป็น `/` + คืน middleware `/login`→`/` (หรือ checkout ไฟล์จาก `backup/v1-2026-07-02`)

## ⏳ งานค้าง (ถ้าต้องการต่อ)
- Cutover เชิงลึก (option 3): ย้าย v2 มา root URL จริง (ตัด prefix `/v2`) + ย้าย v1 → `/v1` — งานใหญ่ ยังไม่ทำ
- ปิด "back to v1"/`?legacy=1` ทั้งหมด = ต้อง port หน้า v1 ที่ยังไม่มีใน v2 ให้ครบก่อน

## ⚠️ ข้อจำกัด/ที่ควรรู้
- Invite: email ไม่ verify (ตามดีไซน์ — invitee กรอกเอง) · ถ้าจะ harden ค่อยเพิ่มขั้น verify
- Upline เปิด profile downline ได้ แต่กดปุ่มแก้ไข/เพิ่มจะ error (write เป็น owner-only) = read-only ตามตั้งใจ
- Prod DB มี pre-existing security advisors (security_definer_view ฯลฯ) — ไม่เกี่ยวกับงานนี้

## Deploy checklist (ทำทุกครั้ง)
1. `next build` ให้ผ่านก่อน (มีเคย type error หลุดไป prod มาแล้ว — commit `013c9c9`)
2. ถ้ามี migration: `apply_migration` เข้า prod + `get_advisors` เช็ค
3. `git push origin <branch>:main` (fast-forward) · rebase ก่อนถ้า main ขยับ
4. sync feature branch (`--force-with-lease` ถ้า rebase)
