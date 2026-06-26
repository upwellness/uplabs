/**
 * POST /api/plate-image — สร้าง/แคชภาพจานอาหาร (Plate Planner)
 * พอร์ตจาก standalone api/image.js → ใช้ server-side GEMINI_API_KEY + Supabase Storage cache (get-or-create)
 * Body: { prompt: string, sig: string } → { image: <publicURL|dataURI>, cached } | { error }
 * เมนูเดียวกัน (sig เดียวกัน) gen ครั้งเดียวพอ — แคชกลางใน bucket meal-images (ข้ามเครื่อง/ข้ามผู้ใช้)
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "meal-images";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const keyOf = (sig: string) => crypto.createHash("sha256").update(String(sig)).digest("hex") + ".png";
const pubUrl = (k: string) => `${SB_URL}/storage/v1/object/public/${BUCKET}/${k}`;

export async function POST(req: Request) {
  // native = ต้อง login ก่อน (ไม่มี BYO key — ใช้คีย์ฝั่งเซิร์ฟเวอร์)
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { prompt?: string; sig?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const prompt = body.prompt;
  const sig = body.sig;
  if (!prompt) return NextResponse.json({ error: "no prompt" }, { status: 400 });

  const key = keyOf(sig || prompt);

  // 1) เช็คแคชกลางก่อน — เมนูนี้เคย gen แล้วไหม
  if (sig && SB_URL) {
    try {
      const head = await fetch(pubUrl(key), { method: "HEAD" });
      if (head.ok) return NextResponse.json({ image: pubUrl(key), cached: true });
    } catch { /* เช็คไม่ได้ก็ gen ต่อ */ }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      },
    );
    const j = await r.json();
    if (j.error) return NextResponse.json({ error: "Gemini: " + (j.error.message || "error") }, { status: 400 });
    const parts = j?.candidates?.[0]?.content?.parts || [];
    const p = parts.find((x: { inlineData?: { data: string; mimeType?: string } }) => x.inlineData);
    if (!p?.inlineData) {
      return NextResponse.json({ error: "ไม่ได้ภาพกลับมา (อาจโดน safety filter)" }, { status: 502 });
    }
    const b64: string = p.inlineData.data;
    const mime: string = p.inlineData.mimeType || "image/png";

    // 2) อัปโหลดเข้าแคชกลาง → คืน public URL ; พลาด → คืน base64 (ผู้ใช้ยังได้รูป)
    if (SB_URL) {
      try {
        const supa = createAdminClient();
        const { error } = await supa.storage
          .from(BUCKET)
          .upload(key, Buffer.from(b64, "base64"), { contentType: mime, upsert: true, cacheControl: "31536000" });
        if (!error) return NextResponse.json({ image: pubUrl(key), cached: false });
      } catch { /* fallback base64 */ }
    }
    return NextResponse.json({ image: `data:${mime};base64,${b64}` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}
