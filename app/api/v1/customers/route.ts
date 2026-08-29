import { withApi, requireScope, visibleCustomerIds } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { searchCustomers, ageFrom } from "@/lib/api/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET /api/v1/customers?q=&limit= — search, already narrowed to the token's reach. */
export async function GET(req: Request) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "customers:read");
    if (err) return err;

    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? 20);

    const visible = await visibleCustomerIds(ctx);
    const rows = await searchCustomers(q, visible, limit);
    return apiOk(rows.map((c) => ({ ...c, age: ageFrom(c.birth_date) })), {
      meta: { token: ctx.token.name, row_count: rows.length, query: q },
    });
  });
}

/** POST /api/v1/customers — create. Owner is the token's coach, or explicit for admin tokens. */
export async function POST(req: Request) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "customers:write");
    if (err) return err;

    let body: any;
    try { body = await req.json(); } catch { return apiError("bad_request", "body ต้องเป็น JSON"); }
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return apiError("bad_request", 'ต้องมี "name"');

    // A new customer is owned by the token's owner. Anything else would let a token
    // create a record it is then not allowed to read back — or worse, park a customer
    // in somebody else's book. Only an all-reach token (owner is an admin) may name a
    // different coach, and even then that coach must exist.
    let coachId = ctx.token.owner_user_id!;
    if (ctx.reach.kind === "all" && typeof body?.coach_id === "string" && body.coach_id) {
      coachId = body.coach_id;
    } else if (typeof body?.coach_id === "string" && body.coach_id && body.coach_id !== coachId) {
      return apiError("customer_out_of_scope",
        "token นี้สร้างลูกค้าให้โค้ชคนอื่นไม่ได้ — ลูกค้าใหม่จะถูกผูกกับเจ้าของ token เสมอ");
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("customers").insert({
      name,
      gender: body?.gender ?? null,
      birth_date: body?.birth_date ?? null,
      height: body?.height ?? null,
      coach_id: coachId,
    }).select("id, name, gender, birth_date, height, coach_id").single();

    if (error) return apiError("bad_request", "สร้างลูกค้าไม่สำเร็จ — ตรวจรูปแบบข้อมูลที่ส่งมา");
    return apiOk(data, { meta: { token: ctx.token.name, row_count: 1 } });
  });
}
