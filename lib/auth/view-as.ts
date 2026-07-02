"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "./session";
import { VIEW_AS_COOKIE } from "./view-as-constants";

const MAX_AGE = 60 * 60 * 4; // 4 ชั่วโมง

/** Admin starts "viewing as" another user — read-only (writes blocked in middleware.ts). */
export async function startViewAs(targetUserId: string) {
  const session = await requireAdmin();
  if (!targetUserId) return { error: "ไม่มี user ที่เลือก" };
  if (targetUserId === session.user.id) return { error: "เลือก user อื่นที่ไม่ใช่ตัวเอง" };

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id").eq("id", targetUserId).maybeSingle();
  if (!target) return { error: "ไม่พบ user นี้" };

  await admin.from("admin_view_as_log").insert({
    admin_id: session.user.id,
    target_user_id: targetUserId,
    action: "start",
  });

  const jar = await cookies();
  jar.set(VIEW_AS_COOKIE, targetUserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return { ok: true };
}

/** Exit "view as" mode and return to the admin's own session. */
export async function stopViewAs() {
  const session = await requireAdmin();
  const jar = await cookies();
  const targetUserId = jar.get(VIEW_AS_COOKIE)?.value ?? null;
  jar.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0 });

  if (targetUserId) {
    const admin = createAdminClient();
    await admin.from("admin_view_as_log").insert({
      admin_id: session.user.id,
      target_user_id: targetUserId,
      action: "stop",
    });
  }

  return { ok: true };
}
