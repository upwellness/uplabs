/**
 * OAuth 2.1 authorization server — the pure decisions. Each test pins one rule that,
 * if quietly relaxed, would let a token reach the wrong party.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  verifyPkce, isValidRedirectUri, validateRegistration, parseAuthorizeRequest, defaultScopes,
  withParams, protectedResourceMetadata, authorizationServerMetadata, readClientAuth, MCP_PATH,
} from "../lib/oauth/core.ts";
import { SCOPES } from "../lib/api/scopes.ts";

const BASE = "https://x.test";
const RESOURCE = `${BASE}${MCP_PATH}`;
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";           // RFC 7636 appendix B
const challenge = createHash("sha256").update(verifier, "ascii").digest("base64url");
const CLIENT = { redirect_uris: ["https://claude.ai/api/mcp/auth_callback", "http://localhost:3000/cb"] };
const good = { response_type: "code", client_id: "c1", redirect_uri: CLIENT.redirect_uris[0], code_challenge: challenge, code_challenge_method: "S256", state: "xyz" };

test("PKCE S256: RFC 7636 vector verifies; wrong verifier, plain, and bad lengths do not", () => {
  assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  assert.equal(verifyPkce(verifier, challenge), true);
  assert.equal(verifyPkce(verifier + "x", challenge), false);
  assert.equal(verifyPkce(challenge, challenge), false);          // "plain" would pass this — we refuse plain
  assert.equal(verifyPkce("short", createHash("sha256").update("short").digest("base64url")), false);
  assert.equal(verifyPkce(undefined, challenge), false);
});

test("redirect URIs: https anywhere, http only on loopback, never a fragment", () => {
  assert.equal(isValidRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect"), true);
  assert.equal(isValidRedirectUri("http://localhost:6274/oauth/callback"), true);
  assert.equal(isValidRedirectUri("http://127.0.0.1/cb"), true);
  assert.equal(isValidRedirectUri("http://evil.test/cb"), false);
  assert.equal(isValidRedirectUri("https://claude.ai/cb#frag"), false);
  assert.equal(isValidRedirectUri("javascript:alert(1)"), false);
  assert.equal(isValidRedirectUri(42), false);
});

test("registration: claude.ai-style public client and a confidential client both pass; junk fails", () => {
  const pub = validateRegistration({ client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
  assert.ok(pub.ok); assert.equal(pub.value.token_endpoint_auth_method, "none");
  const conf = validateRegistration({ redirect_uris: ["https://chatgpt.com/cb"], token_endpoint_auth_method: "client_secret_post" });
  assert.ok(conf.ok); assert.equal(conf.value.client_name, "MCP client"); assert.deepEqual(conf.value.grant_types, ["authorization_code", "refresh_token"]);
  assert.equal(validateRegistration({}).ok, false);
  assert.equal((validateRegistration({ redirect_uris: ["http://evil.test"] }) as any).error, "invalid_redirect_uri");
  assert.equal((validateRegistration({ redirect_uris: ["https://a.test"], grant_types: ["client_credentials"] }) as any).error, "invalid_client_metadata");
  assert.equal((validateRegistration({ redirect_uris: ["https://a.test"], token_endpoint_auth_method: "private_key_jwt" }) as any).error, "invalid_client_metadata");
  assert.equal((validateRegistration({ redirect_uris: ["https://a.test"], response_types: ["token"] }) as any).error, "invalid_client_metadata");
});

test("authorize: a valid request parses; scopes split on whitespace; resource must be ours", () => {
  const r = parseAuthorizeRequest({ ...good, scope: "labs:read  cgm:read", resource: RESOURCE + "/" }, CLIENT, RESOURCE);
  assert.ok(r.ok);
  assert.deepEqual(r.value.scopes, ["labs:read", "cgm:read"]);
  assert.equal(r.value.state, "xyz");
  const bad = parseAuthorizeRequest({ ...good, resource: "https://other.test/api/mcp" }, CLIENT, RESOURCE);
  assert.equal(bad.ok, false); assert.equal((bad as any).error, "invalid_target"); assert.equal((bad as any).redirectable, true);
});

test("authorize: unknown client or mismatched redirect_uri is NOT redirectable (open-redirect guard)", () => {
  const noClient = parseAuthorizeRequest(good, null, RESOURCE);
  assert.equal(noClient.ok, false); assert.equal((noClient as any).redirectable, false);
  const wrongUri = parseAuthorizeRequest({ ...good, redirect_uri: "https://claude.ai/api/mcp/auth_callback/../evil" }, CLIENT, RESOURCE);
  assert.equal(wrongUri.ok, false); assert.equal((wrongUri as any).redirectable, false);
  const prefixTrick = parseAuthorizeRequest({ ...good, redirect_uri: "https://claude.ai/api/mcp/auth_callback?x=1" }, CLIENT, RESOURCE);
  assert.equal(prefixTrick.ok, false);   // exact match only
});

test("authorize: PKCE is mandatory and S256-only; response_type must be code", () => {
  const noPkce = parseAuthorizeRequest({ ...good, code_challenge: undefined }, CLIENT, RESOURCE) as any;
  assert.equal(noPkce.error, "invalid_request"); assert.equal(noPkce.redirectable, true);
  const plain = parseAuthorizeRequest({ ...good, code_challenge_method: "plain" }, CLIENT, RESOURCE) as any;
  assert.equal(plain.error, "invalid_request");
  const noMethod = parseAuthorizeRequest({ ...good, code_challenge_method: undefined }, CLIENT, RESOURCE) as any;
  assert.equal(noMethod.ok, false);                                  // default is plain → refused
  const token = parseAuthorizeRequest({ ...good, response_type: "token" }, CLIENT, RESOURCE) as any;
  assert.equal(token.error, "unsupported_response_type");
});

test("default scopes: requested ∩ allowed, else everything but labs:write", () => {
  assert.deepEqual(defaultScopes(["labs:read", "bogus:x"], SCOPES), ["labs:read"]);
  const d = defaultScopes([], SCOPES);
  assert.ok(!d.includes("labs:write"));
  assert.ok(d.includes("labs:submit") && d.includes("cgm:read") && d.includes("customers:read"));
  assert.equal(d.length, SCOPES.length - 1);
});

test("withParams keeps the client's existing query and adds ours", () => {
  const u = withParams("https://claude.ai/cb?keep=1", { code: "abc", state: "s t", skip: null });
  assert.equal(u, "https://claude.ai/cb?keep=1&code=abc&state=s+t");
});

test("discovery documents point every client at the same endpoints", () => {
  const prm = protectedResourceMetadata(BASE, SCOPES);
  assert.equal(prm.resource, RESOURCE);
  assert.deepEqual(prm.authorization_servers, [BASE]);
  const as = authorizationServerMetadata(BASE, SCOPES);
  assert.equal(as.issuer, BASE);
  assert.equal(as.authorization_endpoint, `${BASE}/oauth/authorize`);
  assert.equal(as.token_endpoint, `${BASE}/api/oauth/token`);
  assert.equal(as.registration_endpoint, `${BASE}/api/oauth/register`);
  assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(as.grant_types_supported, ["authorization_code", "refresh_token"]);
  assert.ok(as.token_endpoint_auth_methods_supported.includes("none"));
  assert.deepEqual(as.scopes_supported, [...SCOPES]);
});

test("client auth is read from Basic header or form fields", () => {
  const basic = readClientAuth("Basic " + Buffer.from("id1:sec%3A1").toString("base64"), {});
  assert.deepEqual(basic, { client_id: "id1", client_secret: "sec:1", via: "basic" });
  assert.deepEqual(readClientAuth(null, { client_id: "id2", client_secret: "s" }), { client_id: "id2", client_secret: "s", via: "post" });
  assert.deepEqual(readClientAuth(null, { client_id: "id3" }), { client_id: "id3", client_secret: null, via: "none" });
  assert.equal(readClientAuth(null, {}).client_id, null);
});
