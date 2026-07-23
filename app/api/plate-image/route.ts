/**
 * POST /api/plate-image — สร้าง/แคชภาพจานอาหาร (Plate Planner)
 * Body: { provider?: 'gemini'|'openai', apiKey?: string, prompt: string, sig: string } → { image, cached } | { error }
 * คีย์: ต้องใส่เอง (BYO) เท่านั้น — ไม่มี fallback คีย์ระบบ · ไม่มีคีย์ = error "กรุณาใส่ API Key"
 * แคชกลางใน Supabase Storage (bucket meal-images) — เมนูเดียวกัน (sig เดียวกัน) gen ครั้งเดียวพอ
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
  // ต้อง login ก่อน (ภายใต้ระบบ uplabs)
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { provider?: string; apiKey?: string; prompt?: string; sig?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const provider = body.provider === "openai" ? "openai" : "gemini";
  const apiKey = body.apiKey || "";   // BYO เท่านั้น — ไม่ fallback คีย์ระบบ
  const prompt = body.prompt;
  const sig = body.sig;
  if (!prompt) return NextResponse.json({ error: "no prompt" }, { status: 400 });

  const key = keyOf(sig || prompt);

  // 1) เช็คแคชกลางก่อน (public read — ไม่ต้องใช้ service key)
  if (sig && SB_URL) {
    try {
      const head = await fetch(pubUrl(key), { method: "HEAD" });
      if (head.ok) return NextResponse.json({ image: pubUrl(key), cached: true });
    } catch { /* เช็คไม่ได้ก็ gen ต่อ */ }
  }

  if (!apiKey) {
    return NextResponse.json({ error: "กรุณาใส่ API Key ก่อน (กด ⚙️ ตั้งค่า API key)" }, { status: 400 });
  }

  try {
    let b64: string | undefined;
    let mime = "image/png";

    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "medium", n: 1 }),
      });
      const j = await r.json();
      if (j.error) return NextResponse.json({ error: "OpenAI: " + (j.error.message || "error") }, { status: 400 });
      b64 = j?.data?.[0]?.b64_json;
    } else {
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
      if (j.error) {
        const gm = j.error.message || "error";
        const keyBad = j.error.status === "INVALID_ARGUMENT" || j.error.status === "PERMISSION_DENIED" || /api[_ ]?key/i.test(gm);
        return NextResponse.json({ error: keyBad ? "GEMINI_KEY_INVALID" : ("Gemini: " + gm) }, { status: 400 });
      }
      const parts = j?.candidates?.[0]?.content?.parts || [];
      const p = parts.find((x: { inlineData?: { data: string; mimeType?: string } }) => x.inlineData);
      if (p?.inlineData) { b64 = p.inlineData.data; mime = p.inlineData.mimeType || "image/png"; }
    }

    if (!b64) return NextResponse.json({ error: "ไม่ได้ภาพกลับมา (อาจโดน safety filter หรือคีย์ไม่มีสิทธิ์สร้างภาพ)" }, { status: 502 });

    // 2) อัปโหลดเข้าแคชกลาง (ต้องมี SUPABASE_SERVICE_ROLE_KEY) → คืน public URL ; พลาด → คืน base64
    if (SB_URL) {
      try {
        const supa = createAdminClient();
        const { error } = await supa.storage
          .from(BUCKET)
          .upload(key, Buffer.from(b64, "base64"), { contentType: mime, upsert: true, cacheControl: "31536000" });
        if (!error) return NextResponse.json({ image: pubUrl(key), cached: false });
      } catch { /* ไม่มี service key / อัปโหลดพลาด → คืน base64 */ }
    }
    return NextResponse.json({ image: `data:${mime};base64,${b64}` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}
