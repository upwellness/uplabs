import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Invitation-based self-signup. PUBLIC (no session) — the invite token is the
 * authorization. The invitee sets their own password and provides a real email
 * (required, for future password resets). On success the new user is attached
 * under the inviter (profiles.parent_id = invite.created_by) with role 'abo'.
 */
export async function POST(req: Request) {
  try {
    const { token, email, password, display_name } = await req.json();

    if (!token) return NextResponse.json({ error: "invalid_link" }, { status: 400 });
    if (!email || !String(email).includes("@")) {
      return NextResponse.json({ error: "กรุณากรอก email จริง (ไว้ใช้ reset password)" }, { status: 400 });
    }
    if (!password || String(password).length < 8) {
      return NextResponse.json({ error: "password ต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Validate token: exists, unused, not expired.
    const { data: invite } = await admin
      .from("user_invites")
      .select("token, created_by, role, used_at, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!invite) return NextResponse.json({ error: "ลิงก์เชิญไม่ถูกต้อง" }, { status: 404 });
    if (invite.used_at) return NextResponse.json({ error: "ลิงก์นี้ถูกใช้ไปแล้ว" }, { status: 409 });
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "ลิงก์เชิญหมดอายุแล้ว" }, { status: 410 });
    }

    // Create the auth user (email auto-confirmed; they chose their own password).
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: String(email).trim(),
      password: String(password),
      email_confirm: true,
      user_metadata: display_name ? { display_name } : undefined,
    });
    if (cErr || !created.user) {
      const msg = /already registered|exists/i.test(cErr?.message ?? "")
        ? "email นี้มีบัญชีอยู่แล้ว — ลองเข้าสู่ระบบหรือ reset password"
        : (cErr?.message ?? "สมัครไม่สำเร็จ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // handle_new_user trigger created the profile row; set role + upline now.
    await admin
      .from("profiles")
      .update({ role: invite.role, display_name, parent_id: invite.created_by })
      .eq("id", created.user.id);

    // Burn the single-use token.
    await admin
      .from("user_invites")
      .update({ used_at: new Date().toISOString(), used_by: created.user.id })
      .eq("token", token);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
