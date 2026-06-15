import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { whoopExchangeCode, whoopFetchRecent } from "@/lib/pulse/whoop";
import { encryptToken } from "@/lib/pulse/crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * WHOOP OAuth callback.
 *  - exchange code for tokens
 *  - resolve invite → customer
 *  - upsert pulse_connections (encrypted tokens, provider 'whoop')
 *  - initial 30-day fetch → whoop_daily + whoop_sleeps + whoop_workouts
 *  - mark invite used
 *  - redirect to /connect/{token}/success
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code  = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // invite token
    const err   = url.searchParams.get("error");

    if (err)    return NextResponse.redirect(new URL(`/connect/error?reason=${encodeURIComponent(err)}`, url.origin));
    if (!code)  return NextResponse.json({ error: "no code" }, { status: 400 });
    if (!state) return NextResponse.json({ error: "no state" }, { status: 400 });

    const admin = createAdminClient();

    const { data: invite, error: iErr } = await admin
      .from("pulse_invites").select("*").eq("token", state).single();
    if (iErr || !invite) return NextResponse.json({ error: "invalid invite" }, { status: 404 });

    const tokens = await whoopExchangeCode(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { data: conn, error: cErr } = await admin
      .from("pulse_connections")
      .upsert({
        customer_id:       invite.customer_id,
        provider:          "whoop",
        access_token_enc:  encryptToken(tokens.access_token),
        refresh_token_enc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        scopes:            tokens.scope?.split(" ") ?? [],
        expires_at:        expiresAt,
        status:            "active",
        connected_at:      new Date().toISOString(),
      }, { onConflict: "customer_id,provider" })
      .select().single();
    if (cErr) throw cErr;

    // Initial fetch — best-effort
    try {
      const parsed = await whoopFetchRecent(tokens.access_token, 30);
      const stamp = (arr: any[]) =>
        arr.map((r) => ({ ...r, customer_id: invite.customer_id, connection_id: conn.id, raw: { ...r } }));

      if (parsed.daily.length)
        await admin.from("whoop_daily").upsert(stamp(parsed.daily), { onConflict: "customer_id,cycle_date" });
      if (parsed.sleeps.length)
        await admin.from("whoop_sleeps").upsert(stamp(parsed.sleeps), { onConflict: "customer_id,sleep_onset" });
      if (parsed.workouts.length)
        await admin.from("whoop_workouts").upsert(stamp(parsed.workouts), { onConflict: "customer_id,workout_start" });

      await admin.from("pulse_connections")
        .update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);
    } catch (fetchErr: any) {
      console.error("[whoop] initial fetch failed:", fetchErr?.message);
    }

    await admin.from("pulse_invites")
      .update({ used_at: new Date().toISOString() }).eq("token", state);

    return NextResponse.redirect(new URL(`/connect/${state}/success`, url.origin));
  } catch (e: any) {
    console.error("[whoop callback]", e);
    return NextResponse.redirect(
      new URL(`/connect/error?reason=${encodeURIComponent(e.message ?? "unknown")}`, new URL(req.url).origin),
    );
  }
}
