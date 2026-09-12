import { NextResponse } from "next/server";
import { requireBackupAdmin } from "@/lib/backup/guard";
import { getCatalog } from "@/lib/backup/engine";
import { orderTables } from "@/lib/backup/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — every public table with real row counts, PKs and the restore order. */
export async function GET() {
  const g = await requireBackupAdmin(); if (g.res) return g.res;
  try {
    const catalog = await getCatalog(true);
    return NextResponse.json({ catalog, order: orderTables(catalog), totals: { tables: catalog.length, rows: catalog.reduce((a, c) => a + (c.exact_rows ?? 0), 0) } }, { headers: { "cache-control": "no-store" } });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "catalog failed" }, { status: 500 }); }
}
