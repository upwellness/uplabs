"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export interface InviteRow {
  token: string;
  note: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
  url: string;
}

/**
 * Any logged-in user may generate an invitation link. Whoever registers through
 * it becomes this user's downline (profiles.parent_id = inviter). New members get
 * role 'abo' (the business-user role required by the customer apps); admins can
 * change roles + re-parent afterward.
 */
export async function createInvite(note?: string) {
  const session = await requireSession();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_invites")
    .insert({ created_by: session.user.id, role: "abo", note: note?.trim() || null })
    .select("token")
    .single();
  if (error) return { error: error.message };
  return { ok: true, token: data.token as string, url: `${siteUrl()}/join/${data.token}` };
}

/** The current user's own invitation links (newest first). */
export async function listMyInvites(): Promise<InviteRow[]> {
  const session = await requireSession();
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_invites")
    .select("token, note, used_at, expires_at, created_at")
    .eq("created_by", session.user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => ({ ...r, url: `${siteUrl()}/join/${r.token}` }));
}

/** Revoke an unused invite the current user created. */
export async function revokeInvite(token: string) {
  const session = await requireSession();
  const admin = createAdminClient();
  const { error } = await admin
    .from("user_invites")
    .delete()
    .eq("token", token)
    .eq("created_by", session.user.id)
    .is("used_at", null);
  if (error) return { error: error.message };
  return { ok: true };
}
