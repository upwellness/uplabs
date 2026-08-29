/**
 * How far an API token may reach into the customer list.
 *
 * The invariant, and the reason this file exists:
 *
 *   ★ A token can never see more than its owner can see RIGHT NOW.
 *
 * Not "at the moment it was issued" — right now. A coach who is moved in the
 * hierarchy, demoted from admin, or has a customer reassigned must have every token
 * they own follow that change on the very next request. That only works if reach is
 * *derived* from the owner's live role and tree position, never read back from text
 * stored alongside the credential.
 *
 * The decision half is pure so it can be tested (tests/api-reach.test.mts); the
 * lookup half lives in lib/api/auth.ts.
 */

export type ScopeSpec = string; // 'owner' | 'all' | 'list:<uuid,uuid,...>'

export type Reach =
  /** Every customer. Only ever returned for an owner who is an admin *now*. */
  | { kind: "all"; requested: ScopeSpec; downgraded: false }
  /** Whatever the owner can manage: own + co-coached + entire downline. */
  | { kind: "owner"; requested: ScopeSpec; downgraded: boolean; reason?: string }
  /** A named subset — still intersected with the owner's reach before use. */
  | { kind: "list"; ids: string[]; requested: ScopeSpec; downgraded: boolean; reason?: string };

/**
 * Turn the stored scope into what this request is actually allowed to touch.
 *
 * Fails closed in every unclear case: an unrecognised scope string, or an `all`
 * token whose owner is no longer an admin, both collapse to the owner's own reach
 * rather than erroring. Erroring would break a working integration the moment
 * somebody's role changed; silently keeping the wide access would be a hole. So it
 * narrows, records why, and `GET /meta` reports the downgrade so it is visible
 * instead of mysterious.
 *
 * @param spec      `api_tokens.customer_scope`
 * @param ownerRole the owner's role as loaded on THIS request
 */
export function resolveReach(spec: ScopeSpec, ownerRole: string | null | undefined): Reach {
  const s = (spec ?? "").trim();

  if (s === "all") {
    if (ownerRole === "admin") return { kind: "all", requested: s, downgraded: false };
    return {
      kind: "owner", requested: s, downgraded: true,
      reason: "token ตั้งไว้ว่าเห็นทุกคน แต่เจ้าของ token ไม่ได้เป็นแอดมินแล้ว — จำกัดเหลือเฉพาะสายงานของเจ้าของ",
    };
  }

  if (s.startsWith("list:")) {
    const ids = s.slice(5).split(",").map((x) => x.trim()).filter(Boolean);
    if (ids.length === 0) {
      return {
        kind: "list", ids: [], requested: s, downgraded: true,
        reason: "รายการลูกค้าว่าง — ไม่เข้าถึงใครได้เลย",
      };
    }
    return { kind: "list", ids, requested: s, downgraded: false };
  }

  if (s === "owner" || s === "") return { kind: "owner", requested: s || "owner", downgraded: false };

  // Anything else is a scope string we do not understand — including the legacy
  // `coach:<id>` form. Never fall open on a value we cannot interpret.
  return {
    kind: "owner", requested: s, downgraded: true,
    reason: `ไม่รู้จักขอบเขต "${s}" — จำกัดเหลือเฉพาะสายงานของเจ้าของ`,
  };
}

/**
 * Narrow an explicit id list to what the owner can actually reach.
 *
 * A list is only ever allowed to *subtract*. An admin picking customer ids for a
 * coach's token must not be able to hand over someone outside that coach's
 * downline — the list is a convenience for scoping down, not a way around the
 * hierarchy.
 */
export function intersectWithOwnerReach(listed: string[], ownerReach: string[]): {
  allowed: string[];
  rejected: string[];
} {
  const reachable = new Set(ownerReach);
  const allowed: string[] = [];
  const rejected: string[] = [];
  for (const id of listed) (reachable.has(id) ? allowed : rejected).push(id);
  return { allowed, rejected };
}

/** Human-readable summary for the admin table and GET /meta. */
export function describeReach(reach: Reach, visibleCount: number | null): string {
  switch (reach.kind) {
    case "all":
      return `ทุกคนในระบบ${visibleCount != null ? ` (${visibleCount} คน)` : ""}`;
    case "owner":
      return `เฉพาะลูกค้าของเจ้าของ token + สายงานลงไปทั้งหมด${visibleCount != null ? ` (${visibleCount} คน)` : ""}`;
    case "list":
      return `เฉพาะ ${reach.ids.length} คนที่ระบุ${visibleCount != null && visibleCount !== reach.ids.length ? ` (เข้าถึงได้จริง ${visibleCount} คน)` : ""}`;
  }
}
