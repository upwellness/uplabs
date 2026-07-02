# Session Status — uplabs (สรุปไว้ทำต่อ)

_อัปเดตล่าสุด: 2026-07-02 · branch: `claude/assign-coach-admin-bug-u3u48r` · deploy model: push branch → `main` = production (fast-forward), Supabase migrations apply ตรงเข้า prod project `qzqvwbucjxwgtmbdkrlu`_

## ✅ งานที่ deploy ขึ้น production (`main`) แล้ว

| Commit | เรื่อง |
|--------|--------|
| `65a95f6` | Fix assign-coach: chip โชว์ "—" สำหรับลูกค้าที่ยังไม่มี coach (เอา filter `.not("coach_id","is",null)` ออกจาก `listUsers` ที่ใช้สร้าง `customerName`) |
| `36e2928` | **View-as** (admin ดูแอปในมุมมอง user อื่น · read-only) |
| `48bf2af` | View-as ให้ไปหน้า v2 (`/v2`) แทน v1 |
| `3017e98` | **v2: ปุ่มเพิ่มลูกค้าใหม่** (v2 เดิมไม่มี — port modal + `POST /api/customers`) |
| `3dd5f8a` | **MLM hierarchy + invitation signup** (schema + invite + downline read-only core) |
| `0a17f9e` | **Fix: ขยาย downline read-only ให้ครบทุก read surface** (BCA/labs/pulse/records/notes/line-bot) |

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

## ⏳ งานค้าง — "ปรับ v2 เป็น site หลัก" (ยังไม่เริ่ม · รอผู้ใช้เลือก scope)
ถามค้างไว้ 3 ทาง (ผู้ใช้ interrupt ไปเจอบั๊ก BCA ก่อน):
1. **(แนะนำ)** Root + login → v2 **และ** redirect หน้า v1 ที่มีคู่ v2 (`/customers`→`/v2/customers` ฯลฯ) — คง v1 ไว้เป็น backup + fallback ของ v2
2. เฉพาะ root `/` + login → v2 (URL v1 ยังเข้าได้ · เสี่ยงน้อยสุด)
3. ย้าย v2 มา root จริง (ตัด prefix `/v2`) + ย้าย v1 → `/v1` (งานใหญ่/เสี่ยง)
- **ก่อนแตะ routing: tag v1 เป็น restore point** (`git tag v1-backup-<date>` + push)
- จุดที่ต้องแก้ถ้าทำ: `app/page.tsx` (root), `signIn` redirect ใน `app/(auth)/actions.ts` (default `/`→`/v2`), middleware redirect authed-away-from-login (`/`→`/v2`), และ (ถ้าเลือกข้อ 1) redirects ใน `next.config` — **ระวัง**: v2 บางหน้า link กลับ v1 ด้วย `?legacy=1` เป็น fallback ห้าม redirect หน้า `[id]` ลึกจนพัง fallback

## ⚠️ ข้อจำกัด/ที่ควรรู้
- Invite: email ไม่ verify (ตามดีไซน์ — invitee กรอกเอง) · ถ้าจะ harden ค่อยเพิ่มขั้น verify
- Upline เปิด profile downline ได้ แต่กดปุ่มแก้ไข/เพิ่มจะ error (write เป็น owner-only) = read-only ตามตั้งใจ
- Prod DB มี pre-existing security advisors (security_definer_view ฯลฯ) — ไม่เกี่ยวกับงานนี้

## Deploy checklist (ทำทุกครั้ง)
1. `next build` ให้ผ่านก่อน (มีเคย type error หลุดไป prod มาแล้ว — commit `013c9c9`)
2. ถ้ามี migration: `apply_migration` เข้า prod + `get_advisors` เช็ค
3. `git push origin <branch>:main` (fast-forward) · rebase ก่อนถ้า main ขยับ
4. sync feature branch (`--force-with-lease` ถ้า rebase)
