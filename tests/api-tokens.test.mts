/**
 * Tests for token minting, parsing, and verification.
 * The security properties here are the ones that matter most in this feature.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mintToken, parseToken, verifySecret, sha256, maskToken } from "../lib/api/tokens.ts";

test("a minted token parses back into its own parts", () => {
  const m = mintToken("live");
  const p = parseToken(m.token);
  assert.ok(p, "freshly minted token failed to parse");
  assert.equal(p!.prefix, m.prefix);
  assert.equal(p!.env, "live");
  assert.equal(p!.secret.length, 32);
});

test("the full token is never recoverable from what we store", () => {
  const m = mintToken();
  assert.notEqual(m.hash, m.token);
  assert.ok(!m.token.includes(m.hash));
  assert.equal(m.hash.length, 64, "sha-256 hex");
  assert.ok(!m.hash.includes(parseToken(m.token)!.secret), "hash must not contain the secret");
});

test("verification accepts the real secret and rejects near misses", () => {
  const m = mintToken();
  const secret = parseToken(m.token)!.secret;
  assert.equal(verifySecret(secret, m.hash), true);
  // Flip the last character to something it definitely is not. Appending a fixed
  // letter used to be the test, which silently passed nothing whenever the random
  // secret happened to end in that same letter — a test that fails ~1 run in 57 is a
  // test nobody trusts.
  const lastDiffers = secret.slice(0, -1) + (secret.endsWith("A") ? "B" : "A");
  assert.notEqual(lastDiffers, secret, "the mutation must actually change the secret");
  assert.equal(verifySecret(lastDiffers, m.hash), false, "one wrong char must fail");
  assert.equal(verifySecret("", m.hash), false);
  assert.equal(verifySecret(secret, ""), false, "empty stored hash must never pass");
  assert.equal(verifySecret(secret, "not-hex"), false);
});

test("malformed tokens are refused before any database lookup", () => {
  for (const bad of [
    "", "uplab_live_short_x", "bearer something", "uplab_prod_abcdefgh_" + "x".repeat(32),
    "uplab_live_ABCDEFGH_" + "x".repeat(32), // prefix must be lowercase
    "uplab_live_abcdefgh_" + "x".repeat(31), // secret one char short
  ]) {
    assert.equal(parseToken(bad), null, `should have refused: ${bad}`);
  }
  assert.equal(parseToken(null), null);
});

test("tokens are unique across mints", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const m = mintToken();
    assert.ok(!seen.has(m.prefix), "prefix collision");
    seen.add(m.prefix);
  }
});

test("sha256 is stable", () => {
  assert.equal(sha256("hello"), sha256("hello"));
  assert.notEqual(sha256("hello"), sha256("hellp"));
});

test("the masked form shows the prefix and hides the secret", () => {
  const m = mintToken();
  const masked = maskToken(m.prefix);
  assert.ok(masked.includes(m.prefix));
  assert.ok(!masked.includes(parseToken(m.token)!.secret));
});
