/**
 * API token minting and verification.
 *
 * The full token is shown to the admin exactly once and is never written anywhere —
 * not to the database, not to the request log. What we persist is:
 *   token_prefix : 8 chars, plaintext, indexed — how we find the row
 *   token_hash   : SHA-256 of the secret half — what we compare against
 *
 * So a dump of `api_tokens` is not a set of working credentials.
 *
 * Comparison is timing-safe. A plain `===` on a secret leaks, through response
 * timing, how many leading characters a guess got right; over enough attempts that
 * turns brute force from impossible into merely slow.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no 0/O/1/l
const PREFIX_LEN = 8;
const SECRET_LEN = 32;

export interface MintedToken {
  /** Full credential — show once, then forget. */
  token: string;
  prefix: string;
  hash: string;
}

function randomString(len: number): string {
  const bytes = randomBytes(len * 2);
  let out = "";
  for (let i = 0; out.length < len && i < bytes.length; i++) {
    const v = bytes[i];
    // reject values in the wrap-around tail so every letter stays equally likely
    if (v < Math.floor(256 / ALPHABET.length) * ALPHABET.length) out += ALPHABET[v % ALPHABET.length];
  }
  return out.length === len ? out : out + randomString(len - out.length);
}

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** `uplab_live_<prefix8>_<secret32>` */
export function mintToken(env: "live" | "test" = "live"): MintedToken {
  const prefix = randomString(PREFIX_LEN).toLowerCase();
  const secret = randomString(SECRET_LEN);
  return { token: `uplab_${env}_${prefix}_${secret}`, prefix, hash: sha256(secret) };
}

export interface ParsedToken {
  env: string;
  prefix: string;
  secret: string;
}

/** Structural parse only — says nothing about whether the token is real. */
export function parseToken(raw: string | null | undefined): ParsedToken | null {
  if (!raw) return null;
  const t = raw.trim();
  const m = t.match(/^uplab_(live|test)_([a-z0-9]{8})_([A-Za-z0-9]{32})$/);
  if (!m) return null;
  return { env: m[1], prefix: m[2], secret: m[3] };
}

/** Constant-time hash comparison. */
export function verifySecret(secret: string, expectedHash: string): boolean {
  const a = Buffer.from(sha256(secret), "hex");
  const b = Buffer.from(expectedHash ?? "", "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** Pull the credential out of a request — Bearer first, then x-api-key. */
export function readTokenFromHeaders(h: Headers): string | null {
  const auth = h.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  return h.get("x-api-key")?.trim() || null;
}

/** For display in the admin table: `uplab_live_a3f9c210_••••` */
export function maskToken(prefix: string, env = "live"): string {
  return `uplab_${env}_${prefix}_${"•".repeat(8)}`;
}
