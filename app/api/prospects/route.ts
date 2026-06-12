import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Prospect List API · per-coach RLS automatic
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data, error } = await supa
      .from("prospect_list")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ prospects: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { name, tier, context, source, notes, bulk } = body ?? {};

    const supa = createClient();

    // Bulk paste mode — array of names, one per line
    if (Array.isArray(bulk) && bulk.length > 0) {
      const rows = bulk
        .map((n: any) => (typeof n === "string" ? n.trim() : ""))
        .filter((n: string) => n.length > 0)
        .map((n: string) => ({
          coach_id: session.user.id,
          name: n,
          tier: (tier && ["A", "B", "C"].includes(tier)) ? tier : "B",
          source: source ?? null,
        }));

      if (rows.length === 0) {
        return NextResponse.json({ error: "no valid names in bulk" }, { status: 400 });
      }

      const { data, error } = await supa
        .from("prospect_list")
        .insert(rows)
        .select();

      if (error) throw error;
      return NextResponse.json({ prospects: data, inserted: data?.length ?? 0 });
    }

    // Single add
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const { data, error } = await supa
      .from("prospect_list")
      .insert({
        coach_id: session.user.id,
        name: name.trim(),
        tier: (tier && ["A", "B", "C"].includes(tier)) ? tier : "B",
        context: context ?? null,
        source: source ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ prospect: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
