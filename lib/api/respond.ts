/**
 * One response shape for the whole External API.
 *
 * Every error goes through `apiError` so a Postgres message can never reach the
 * caller. Raw database errors leak table and column names, and in a public repo
 * that is free reconnaissance — the caller gets our error code, the details go to
 * the server log.
 */
import { NextResponse } from "next/server";

export const DISCLAIMER =
  "ข้อมูลสุขภาพนี้ใช้เพื่อการดูแลเชิงป้องกันและชะลอวัย ไม่ใช่การวินิจฉัยหรือการรักษาทางการแพทย์ · ค่าที่ผิดปกติควรให้แพทย์เป็นผู้ตรวจเพิ่มและสรุป · การเริ่มอาหารเสริมทุกชนิดควรผ่านเภสัชกรและแพทย์ก่อน";

export type ApiErrorCode =
  | "bad_request"
  | "needs_disambiguation"
  | "unknown_intent"
  | "missing_token"
  | "malformed_token"
  | "invalid_token"
  | "token_expired"
  | "token_revoked"
  | "insufficient_scope"
  | "customer_out_of_scope"
  | "not_found"
  | "rate_limited"
  | "method_not_allowed"
  | "internal_error";

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  needs_disambiguation: 400,
  unknown_intent: 400,
  missing_token: 401,
  malformed_token: 401,
  invalid_token: 401,
  token_expired: 401,
  token_revoked: 401,
  insufficient_scope: 403,
  customer_out_of_scope: 403,
  not_found: 404,
  rate_limited: 429,
  method_not_allowed: 405,
  internal_error: 500,
};

export interface ApiMeta {
  token?: string;
  generated_at: string;
  row_count?: number;
  [k: string]: unknown;
}

export function apiOk(
  data: unknown,
  opts: { meta?: Partial<ApiMeta>; clinical?: boolean; extra?: Record<string, unknown> } = {},
) {
  const body: Record<string, unknown> = {
    ok: true,
    ...(opts.extra ?? {}),
    data,
    meta: { generated_at: new Date().toISOString(), ...(opts.meta ?? {}) },
  };
  if (opts.clinical) body.disclaimer = DISCLAIMER;
  return NextResponse.json(body, { status: 200 });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
) {
  const status = STATUS[code] ?? 400;
  const headers: Record<string, string> = {};
  if (code === "rate_limited" && typeof extra.retry_after === "number") {
    headers["Retry-After"] = String(extra.retry_after);
  }
  return NextResponse.json({ ok: false, error: code, message, ...extra }, { status, headers });
}

/**
 * Wrap a handler so an unexpected throw becomes a clean 500 instead of a Next.js
 * stack page — and so the real cause still lands in the server log.
 */
export async function guard(
  label: string,
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (err: any) {
    console.error(`[api/v1] ${label} failed:`, err?.message ?? err);
    return apiError("internal_error", "เกิดข้อผิดพลาดภายในระบบ");
  }
}
