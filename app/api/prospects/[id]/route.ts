import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Patch + delete a prospect row.
 */

const ALLOWED_FIELDS = [
  "name",
  "tier",
  "context",
  "source",
  "status",
  "notes",
  "contacted_at",
  "replied_at",
  "closed_at",
] as const;

const ALLOWED_TIERS = ["A", "B", "C"];
const ALLOWED_STATUSES = [
  "lead", "messaged", "replied", "scheduled", "analyzed",
  "closed", "not_interested", "dropped",
];

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const update: Record<string, any> = {};
    for (const f of ALLOWED_FIELDS) {
      if (f in body) update[f] = body[f];
    }

    if (update.tier && !ALLOWED_TIERS.includes(update.tier)) {
      return NextResponse.json({ error: "invalid tier" }, { status: 400 });
    }
    if (update.status && !ALLOWED_STATUSES.includes(update.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }

    // Auto-stamp transitions
    if (update.status === "messaged" && !update.contacted_at) {
      update.contacted_at = new Date().toISOString();
    }
    if (update.status === "replied" && !update.replied_at) {
      update.replied_at = new Date().toISOString();
    }
    if (update.status === "closed" && !update.closed_at) {
      update.closed_at = new Date().toISOString();
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "no valid fields" }, { status: 400 });
    }

    const supa = createClient();
    const { data, error } = await supa
      .from("prospect_list")
      .update(update)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ prospect: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { error } = await supa
      .from("prospect_list")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
