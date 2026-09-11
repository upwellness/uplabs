"use server";

/**
 * The consent decision. Re-validates everything the page validated — a server action
 * is a POST endpoint of its own, and hidden form fields are just request parameters.
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getRealSession } from "@/lib/auth/session";
import { normalizeScopes } from "@/lib/api/scopes";
import { parseAuthorizeRequest, withParams, MCP_PATH } from "@/lib/oauth/core";
import { getClient, issueCode } from "@/lib/oauth/store";

const AUTHZ_FIELDS = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "scope", "resource"] as const;

function readAuthzFields(fd: FormData): Record<string, string | undefined> {
  const q: Record<string, string | undefined> = {};
  for (const k of AUTHZ_FIELDS) { const v = fd.get(k); if (typeof v === "string" && v !== "") q[k] = v; }
  return q;
}

function siteBase(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return `${proto}://${host}`;
}

export async function decide(formData: FormData): Promise<{ error: string } | void> {
  const session = await getRealSession();
  if (!session) return { error: "หมดเวลาเข้าสู่ระบบ — โหลดหน้านี้ใหม่แล้วเข้าสู่ระบบอีกครั้ง" };

  const q = readAuthzFields(formData);
  const client = await getClient(q.client_id ?? "");
  const parsed = parseAuthorizeRequest(q, client, `${siteBase()}${MCP_PATH}`);
  if (!parsed.ok) return { error: parsed.error_description };
  const { value } = parsed;

  const decision = formData.get("decision");
  if (decision !== "allow") {
    redirect(withParams(value.redirect_uri, { error: "access_denied", error_description: "ผู้ใช้ไม่อนุญาต", state: value.state }));
  }

  const scopes = normalizeScopes(formData.getAll("scopes"));
  if (scopes.length === 0) return { error: "ต้องเลือกสิทธิ์อย่างน้อย 1 อย่าง" };

  let code: string;
  try {
    code = await issueCode({
      client_id: value.client_id, user_id: session.profile.id, redirect_uri: value.redirect_uri,
      code_challenge: value.code_challenge, scopes, resource: value.resource,
    });
  } catch (e: any) {
    console.error("[oauth] issueCode failed:", e?.message ?? e);
    return { error: "ออกรหัสอนุญาตไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  redirect(withParams(value.redirect_uri, { code, state: value.state }));
}
