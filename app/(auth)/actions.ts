"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signIn(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!identifier || !password) {
    return { error: "กรุณากรอก email/ABO/เบอร์โทร และ password" };
  }

  const supa = createClient();

  // Resolve identifier → email (looks up ABO number or phone if not an email)
  let email = identifier;
  if (!identifier.includes("@")) {
    const { data, error: rpcErr } = await supa.rpc("resolve_email", { identifier });
    if (rpcErr || !data) {
      return { error: "ไม่พบบัญชีนี้ — ตรวจ ABO/เบอร์โทร/email อีกครั้ง" };
    }
    email = data as string;
  }

  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Email หรือ password ไม่ถูกต้อง" };
  }
  revalidatePath("/", "layout");
  redirect(next || "/");
}

export async function signOut() {
  const supa = createClient();
  await supa.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "กรุณากรอก email" };

  const supa = createClient();
  const { error } = await supa.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/reset-password`,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm  = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Password ต้องมีอย่างน้อย 8 ตัว" };
  if (password !== confirm) return { error: "Password ไม่ตรงกัน" };

  const supa = createClient();
  const { error } = await supa.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/");
}
