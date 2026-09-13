import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCode } from "@/lib/pulse/google-health";
import { syncGoogleHealth } from "@/lib/pulse/google-health-sync";
import { encryptToken } from "@/lib/pulse/crypto";

/**
 * Google's OAuth callback (Google Health API — Fitbit / Pixel Watch).
 *  - exchange code for tokens
 *  - resolve invite → customer
 *  - upsert pulse_connections (encrypted tokens)
 *  - initial 7-day biomarker fetch → pulse_readings
 *  - mark invite used
 *  - redirect to /connect/{token}/success
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code  = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // invite token
    const err   = url.searchParams.get("error");

    if (err)         return NextResponse.redirect(new URL(`/connect/error?reason=${encodeURIComponent(err)}`, url.origin));
    if (!code)       return NextResponse.json({ error: "no code" }, { status: 400 });
    if (!state)      return NextResponse.json({ error: "no state" }, { status: 400 });

    const admin = createAdminClient();

    // Resolve invite
    const { data: invite, error: iErr } = await admin
      .from("pulse_invites").select("*").eq("token", state).single();
    if (iErr || !invite) return NextResponse.json({ error: "invalid invite" }, { status: 404 });

    // Exchange code → tokens
    const tokens = await exchangeCode(code);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert connection
    const { data: conn, error: cErr } = await admin
      .from("pulse_connections")
      .upsert({
        customer_id:      invite.customer_id,
        provider:         "google_health",
        access_token_enc: encryptToken(tokens.access_token),
        refresh_token_enc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        scopes:           tokens.scope?.split(" ") ?? [],
        expires_at:       expiresAt,
        status:           "active",
        connected_at:     new Date().toISOString(),
      }, { onConflict: "customer_id,provider" })
      .select()
      .single();
    if (cErr) throw cErr;

    // Initial 14-day pull (best-effort — if it fails we still mark connected)
    try { await syncGoogleHealth(conn); }
    catch (fetchErr: any) { console.error("[pulse] initial Google Health sync failed:", fetchErr?.message); }

    // Mark invite used
    await admin.from("pulse_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token", state);

    return NextResponse.redirect(new URL(`/connect/${state}/success`, url.origin));
  } catch (e: any) {
    console.error("[pulse callback]", e);
    return NextResponse.redirect(
      new URL(`/connect/error?reason=${encodeURIComponent(e.message ?? "unknown")}`, new URL(req.url).origin),
    );
  }
}
