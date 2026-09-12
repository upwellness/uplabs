/**
 * External API scopes — the allow-list that decides what one token may do.
 *
 * Design rule: there is deliberately NO wildcard scope. A token that should read
 * everything is created by ticking every box, which means the admin screen always
 * shows the true blast radius of a credential instead of a single "*" that hides it.
 *
 * See docs/SPEC-External-API.md §7.
 */

export const SCOPES = [
  "customers:read",
  "customers:write",
  "labs:read",
  "labs:write",
  "labs:submit",
  "measurements:read",
  "measurements:write",
  "supplements:read",
  "notes:read",
  "notes:write",
  "links:write",
  "cgm:read",
  "cgm:write",
  "assessment:read",
  "assessment:write",
] as const;

export type Scope = (typeof SCOPES)[number];

export const SCOPE_LABEL_TH: Record<Scope, string> = {
  "customers:read": "อ่านโปรไฟล์ลูกค้า",
  "customers:write": "สร้าง/แก้โปรไฟล์ลูกค้า",
  "labs:read": "อ่านผลแล็บ",
  "labs:write": "บันทึกผลแล็บเข้าโปรไฟล์ทันที",
  "labs:submit": "ส่งผลแล็บเข้าคิวรอตรวจสอบ (ปลอดภัยกว่า)",
  "measurements:read": "อ่านค่า BCA",
  "measurements:write": "บันทึกค่า BCA",
  "supplements:read": "อ่านอาหารเสริม",
  "notes:read": "อ่านโน้ตโค้ช",
  "notes:write": "เขียนโน้ตโค้ช",
  "links:write": "ขอลิงก์สมัคร",
  "cgm:read": "อ่านค่าน้ำตาลต่อเนื่อง (CGM) + ตัวเลขสรุป",
  "assessment:read": "อ่านผลประเมินสุขภาพรวม (UP Health Design)",
  "assessment:write": "สั่งประเมินสุขภาพรวมใหม่",
  "cgm:write": "นำเข้าไฟล์ CGM (Ottai ฯลฯ) เข้าประวัติ",
};

/** Scopes that hand out health data — used by the admin UI to warn before saving. */
export const CLINICAL_SCOPES: Scope[] = [
  "labs:read",
  "labs:write",
  "labs:submit",
  "measurements:read",
  "measurements:write",
  "supplements:read",
  "cgm:read",
  "cgm:write",
  "assessment:read",
  "assessment:write",
];

export const isScope = (s: string): s is Scope => (SCOPES as readonly string[]).includes(s);

export function hasScope(tokenScopes: string[], required: Scope): boolean {
  return tokenScopes.includes(required);
}

/** Keep only real scopes and drop duplicates — never trust input from the admin form. */
export function normalizeScopes(input: unknown): Scope[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<Scope>();
  for (const s of input) if (typeof s === "string" && isScope(s)) out.add(s);
  return [...out];
}
