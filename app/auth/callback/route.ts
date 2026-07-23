import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Supabase auth-email landing route.
 *
 * Every auth email link (password recovery, signup confirmation, magic link,
 * invite) is configured to redirect here. Supabase appends either:
 *   - `?code=…`                    — PKCE / OAuth code-exchange flow, or
 *   - `?token_hash=…&type=…`       — email OTP verification flow.
 *
 * We establish the session server-side (writing the auth cookies onto the redirect
 * response) and then forward the user to the right page. Recovery links go to the
 * "set new password" page; everything else lands in the app (or an explicit `next`).
 *
 * Without this route, those email links hit a non-existent path and 404 — which is
 * exactly what broke the reset-password and invite links.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = siteUrl();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const errorDescription = searchParams.get("error_description") ?? searchParams.get("error");

  // Where to send the user once the session exists. Only allow same-site relative
  // paths from `next` (open-redirect guard); recovery defaults to the reset page.
  const nextRaw = searchParams.get("next");
  const safeNext = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : null;
  const dest = safeNext ?? (type === "recovery" ? "/reset-password" : "/v2");

  const fail = (msg: string) =>
    NextResponse.redirect(`${base}/login?error=${encodeURIComponent(msg)}`);

  if (errorDescription) return fail(errorDescription);

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return NextResponse.redirect(`${base}${dest}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail(error.message);
    return NextResponse.redirect(`${base}${dest}`);
  }

  return fail("ลิงก์ไม่ถูกต้องหรือหมดอายุ — กรุณาขอลิงก์ใหม่อีกครั้ง");
}
