/**
 * AES-256-GCM token encryption — free alternative to Supabase Vault.
 * Key comes from PULSE_ENC_KEY env var (32 bytes base64).
 * Generate one via:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

function getKey(): Buffer {
  const key = process.env.PULSE_ENC_KEY;
  if (!key) throw new Error("PULSE_ENC_KEY missing");
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) throw new Error("PULSE_ENC_KEY must be 32 bytes base64");
  return buf;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv|tag|ct)
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptToken(enc: string): string {
  const buf = Buffer.from(enc, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
