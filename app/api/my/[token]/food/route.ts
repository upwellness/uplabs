import { NextResponse } from "next/server";
import { customerByPortalToken, portalAiUsedToday, PORTAL_DAILY_AI_CAP } from "@/lib/health-design/portal";
import { analyzeFood } from "@/lib/nutriscan/gemini-vision";
import { validateEntry } from "@/lib/food/entries";
import { insertEntry, foodWindow } from "@/lib/food/store";
import { recomputeQuietly } from "@/lib/health-design/load";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** GET — the customer's last 7 days. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const c = await customerByPortalToken(params.token);
  if (!c) return NextResponse.json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" }, { status: 404 });
  const w = await foodWindow(c.id, 7);
  return NextResponse.json({ window: { from: w.from, to: w.to }, summary: w.summary, entries: w.entries.slice(-30).reverse() }, { headers: { "cache-control": "no-store" } });
}

/**
 * POST — two steps, same shape as the coach app:
 *   { step: "estimate", image_base64?, mime_type?, text_description?, meal_type? }  → AI estimate (server key, capped)
 *   { step: "save", confirmed: true, eaten_at, description, calories…, raw_analysis? } → stored
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const c = await customerByPortalToken(params.token);
  if (!c) return NextResponse.json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" }, { status: 404 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "body ต้องเป็น JSON" }, { status: 400 }); }

  if (body.step === "estimate") {
    const key = process.env.GEMINI_API_KEY ?? "";
    if (!key) return NextResponse.json({ error: "ระบบวิเคราะห์อาหารยังไม่พร้อม — พิมพ์ตัวเลขเองได้ หรือแจ้งโค้ช" }, { status: 503 });
    if ((await portalAiUsedToday(c.id)) >= PORTAL_DAILY_AI_CAP) return NextResponse.json({ error: `วันนี้ใช้การวิเคราะห์ครบ ${PORTAL_DAILY_AI_CAP} ครั้งแล้ว — พิมพ์ตัวเลขเองได้` }, { status: 429 });
    if (!body.image_base64 && !body.text_description) return NextResponse.json({ error: "ต้องมีรูปหรือข้อความ" }, { status: 400 });
    try {
      const args: Parameters<typeof analyzeFood>[0] = { context: { meal_time: body.meal_type } };
      if (body.image_base64) { args.imageBase64 = String(body.image_base64).replace(/^data:image\/\w+;base64,/, ""); args.mimeType = body.mime_type; }
      if (body.text_description) args.textDescription = String(body.text_description).slice(0, 500);
      const result = await analyzeFood(args, key);
      return NextResponse.json({ result });
    } catch (e: any) {
      console.error("[portal food] analyze:", e?.message ?? e);
      return NextResponse.json({ error: "วิเคราะห์ไม่สำเร็จ — ลองใหม่หรือพิมพ์ตัวเลขเอง" }, { status: 500 });
    }
  }

  if (body.step === "save") {
    const v = validateEntry(body, new Date().toISOString(), { source: body.source === "text" ? "text" : body.source === "photo_backfill" ? "photo_backfill" : "photo", estimated_by: body.estimated_by === "manual" ? "manual" : "gemini" });
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    try {
      // user_id = the coach who owns the customer (the portal has no auth user); confirmed_by is the same — the customer's confirmation is recorded via source/estimated_by
      const entry = await insertEntry({ customerId: c.id, userId: c.coach_id!, entry: v.value, raw: body.raw_analysis ?? { via: "portal" }, edited: body.edited ?? null });
      await recomputeQuietly(c.id, "food_log");
      return NextResponse.json({ saved: true, entry });
    } catch (e: any) {
      console.error("[portal food] save:", e?.message ?? e);
      return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'step ต้องเป็น "estimate" หรือ "save"' }, { status: 400 });
}
