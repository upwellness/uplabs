import { NextResponse } from "next/server";
import { getRealSession } from "@/lib/auth/session";

/** Admin-only gate for every backup/restore route. Uses the REAL session — view-as must never reach these. */
export async function requireBackupAdmin() {
  const session = await getRealSession();
  if (!session) return { res: NextResponse.json({ error: "unauthenticated" }, { status: 401 }), session: null };
  if (session.profile.role !== "admin") return { res: NextResponse.json({ error: "admin only" }, { status: 403 }), session: null };
  return { res: null, session };
}
