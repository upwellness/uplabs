import { withApi } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { exifDateTime, parseEatenAt } from "@/lib/food/entries";

export const dynamic = "force-dynamic";
const MAX = 6 * 1024 * 1024; // base64 of a ~4.5 MB JPEG

/**
 * POST /food/photo-date — "when was this photo taken?" for logging old meals.
 * Returns the EXIF time as a *suggestion*; the caller must still get the person to
 * confirm before logFood. No image analysis happens here (BYO-key rule), and the
 * bytes are not stored.
 */
export async function POST(req: Request) {
  return withApi(req, async (ctx) => {
    let body: any;
    try { body = await req.json(); } catch { return apiError("bad_request", "body ต้องเป็น JSON { photo_base64 }"); }
    const b64 = typeof body?.photo_base64 === "string" ? body.photo_base64.replace(/^data:image\/\w+;base64,/, "") : "";
    if (!b64) return apiError("bad_request", 'ต้องส่ง "photo_base64"');
    if (b64.length > MAX) return apiError("bad_request", "รูปใหญ่เกิน 4.5 MB — ย่อก่อน");
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(Buffer.from(b64, "base64")); } catch { return apiError("bad_request", "base64 ไม่ถูกต้อง"); }
    const exif = exifDateTime(bytes);
    const parsed = exif ? parseEatenAt(exif, new Date().toISOString()) : null;
    return apiOk({
      has_exif: !!exif, exif_datetime: exif, eaten_at_suggested: parsed ? exif!.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").slice(0, 16) : null,
      note: parsed ? "เวลาจากรูป (EXIF, เวลาไทย) — ให้คนยืนยันก่อนบันทึก" : exif ? "รูปมี EXIF แต่เวลาเป็นอนาคตหรืออ่านไม่ได้ — ถามคนว่ากินเมื่อไร" : "รูปไม่มีเวลาถ่าย (ภาพหน้าจอ/ส่งผ่านแชต/PNG) — ถามคนว่ากินวันไหน มื้อไหน ห้ามเดา",
    }, { meta: { token: ctx.token.name } });
  });
}
