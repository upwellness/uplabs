import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authUrl } from "@/lib/pulse/google-fit";

/**
 * Public endpoint — called by /connect/[token] page after consent.
 * Validates invite token still good, then redirects to Google OAuth.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from("pulse_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !invite) return NextResponse.json({ error: "invalid invite" }, { status: 404 });
  if (invite.used_at)    return NextResponse.json({ error: "invite already used" }, { status: 410 });
  if (new Date(invite.expires_at).getTime() < Date.now())
    return NextResponse.json({ error: "invite expired" }, { status: 410 });

  // state = token so we can resume on callback
  return NextResponse.redirect(authUrl(token));
}
