import { NextResponse } from "next/server";
import { customerByPortalToken, logPortalEvent } from "@/lib/health-design/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { kind: "metric", metric } — portal usage log (SPEC-Mobile-Portal.md R7). Only the metric kind is accepted from the client; the rest are logged server-side. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const c = await customerByPortalToken(params.token);
  if (!c) return NextResponse.json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" }, { status: 404 });
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (body?.kind !== "metric" || typeof body.metric !== "string" || !/^[a-z0-9_]{1,40}$/.test(body.metric)) return NextResponse.json({ ok: false }, { status: 400 });
  await logPortalEvent(c.id, "metric", { metric: body.metric });
  return NextResponse.json({ ok: true });
}
