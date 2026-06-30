import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * CGM passcode admin (admin-only).
 *
 * CGM profile passcodes are stored as one-way hashes (cgm_profiles.passcode_hash),
 * so a forgotten passcode cannot be recovered — only RESET. This route lets an admin
 * list the profiles and set/reset a profile's passcode via the SECURITY DEFINER RPC
 * `cgm_admin_set_passcode` (which hashes it the same way cgm_check_passcode expects).
 * Non-admins get 403 → the UI hides the panel entirely.
 */

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cgm_profiles")
    .select("profile_name, customer_id, passcode_hash, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const profiles = (data ?? []).map((p: any) => ({
    profile_name: p.profile_name,
    customer_id: p.customer_id,
    has_passcode: !!p.passcode_hash,
  }));
  return NextResponse.json({ profiles });
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const profile = String(body.profile ?? "").trim();
  const passcode = String(body.passcode ?? "").trim();
  if (!profile || !passcode) {
    return NextResponse.json({ error: "ต้องระบุ profile และรหัสผ่านใหม่" }, { status: 400 });
  }
  if (passcode.length < 4) {
    return NextResponse.json({ error: "รหัสผ่านอย่างน้อย 4 ตัวอักษร" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.rpc("cgm_admin_set_passcode", { p_profile: profile, p_passcode: passcode });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
