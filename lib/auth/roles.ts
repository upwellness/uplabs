/**
 * Role + permission helpers.
 * Single source of truth for who-can-see-what.
 */

export type Role = "member" | "abo" | "admin" | "other";

export const ROLES: Role[] = ["member", "abo", "admin", "other"];

export const ROLE_LABEL_TH: Record<Role, string> = {
  member: "สมาชิก",
  abo:    "นักธุรกิจ ABO",
  admin:  "ผู้ดูแลระบบ",
  other:  "อื่นๆ",
};

export const ROLE_COLOR: Record<Role, string> = {
  member: "bg-science-pale text-science",
  abo:    "bg-rose-pale text-rose",
  admin:  "bg-amber-pale text-amber",
  other:  "bg-ink-5 text-ink-60",
};

export function hasRole(userRole: Role | null | undefined, allowed: Role[]): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole);
}

/** Combine app-default permission with per-user explicit grants. */
export function canAccessApp(
  userRole: Role | null | undefined,
  appAllowedRoles: Role[],
  grantedAppSlugs: string[],
  appSlug: string,
): boolean {
  if (grantedAppSlugs.includes(appSlug)) return true;
  return hasRole(userRole, appAllowedRoles);
}
