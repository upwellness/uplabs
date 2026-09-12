import { NextResponse } from "next/server";
import { customerByPortalToken } from "@/lib/health-design/portal";
import { gridFromFile, importCgmForCustomer } from "@/lib/api/cgm-import-flow";
import { recomputeQuietly } from "@/lib/health-design/load";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_BYTES = 5 * 1024 * 1024;

/** POST multipart file=<Ottai .xlsx/.csv> — the customer uploads their own sensor export. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const c = await customerByPortalToken(params.token);
  if (!c) return NextResponse.json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" }, { status: 404 });
  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ error: "อ่านไฟล์ไม่ได้" }, { status: 400 }); }
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ต้องแนบไฟล์" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "ไฟล์เกิน 5 MB" }, { status: 400 });
  const grid = gridFromFile(Buffer.from(await file.arrayBuffer()));
  if (!grid) return NextResponse.json({ error: "เปิดไฟล์ไม่ได้ — ต้องเป็น .xlsx หรือ .csv ที่ export จากแอป Ottai" }, { status: 400 });
  const out = await importCgmForCustomer(c.id, grid, null, file.name);
  if (!out.ok) return NextResponse.json({ error: out.error, ...(out.extra ?? {}) }, { status: out.status });
  if ((out.result.inserted as number) > 0) await recomputeQuietly(c.id, "cgm_import");
  return NextResponse.json({ ok: true, inserted: out.result.inserted, skipped_existing: out.result.skipped_existing, message: out.result.message, parsed: out.result.parsed });
}
