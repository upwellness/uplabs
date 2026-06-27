/**
 * LINE Messaging API helpers — น้องจาน (Plate Planner LINE Bot).
 *
 * Plain `fetch` + node `crypto` only — NO @line/bot-sdk dependency (kept the repo dep-free).
 * Credentials are read from the environment EVERY call (never hardcoded):
 *   - LINE_CHANNEL_ACCESS_TOKEN  (long-lived channel access token for push/reply)
 *   - LINE_CHANNEL_SECRET        (channel secret for x-line-signature verification)
 *
 * This module is server-only (uses process.env secrets). Import it from route handlers.
 */
import crypto from "crypto";

const LINE_API = "https://api.line.me/v2/bot";

/** A LINE message object (text / flex / quickReply etc.). Loosely typed on purpose. */
export type LineMessage = Record<string, unknown>;

function accessToken(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  return t;
}

function channelSecret(): string {
  const s = process.env.LINE_CHANNEL_SECRET;
  if (!s) throw new Error("LINE_CHANNEL_SECRET is not set");
  return s;
}

/**
 * Verify a LINE webhook request signature.
 * HMAC-SHA256(channelSecret, rawBody) → base64, compared to the `x-line-signature` header.
 * Uses a constant-time compare. Returns false (never throws) on any malformed input
 * so the caller can simply reply 401.
 */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  let secret: string;
  try {
    secret = channelSecret();
  } catch {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // timingSafeEqual throws if lengths differ — guard first.
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`${LINE_API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken()}`,
    },
    body: JSON.stringify(body),
  });
  // LINE returns 200 with empty body on success; non-2xx carries an error JSON we surface for logs.
  const text = res.ok ? "" : await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}

/**
 * Reply to an incoming event using its short-lived replyToken.
 * `messages` is 1–5 LINE message objects.
 */
export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  return postJson("/message/reply", { replyToken, messages: messages.slice(0, 5) });
}

/**
 * Push messages to a target (userId / groupId / roomId). Used by the scheduled push.
 * `messages` is 1–5 LINE message objects.
 */
export async function pushMessage(to: string, messages: LineMessage[]) {
  return postJson("/message/push", { to, messages: messages.slice(0, 5) });
}
