/**
 * Canonical site origin for building outbound links (invite links, password-reset
 * redirects, OAuth callbacks…).
 *
 * Reads NEXT_PUBLIC_SITE_URL and normalizes it so a misconfigured env value can't
 * produce broken links:
 *   - strips any trailing slash(es)  → prevents `https://host//join/…` (double slash
 *     lands on a non-existent path → 404 when opening invite / reset-password links)
 *   - adds `https://` if the scheme was omitted
 *
 * Falls back to http://localhost:3000 for local dev when the env var is unset.
 */
export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}
