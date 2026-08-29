/**
 * Tests for the token-reach rule.
 *
 * The invariant under test: a token can never see more than its owner can see RIGHT
 * NOW. These are the cases where getting it wrong leaks one coach's customers to
 * another, so they are worth spelling out.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveReach, intersectWithOwnerReach, describeReach } from "../lib/api/reach.ts";

test("'owner' means the owner's own hierarchy, whoever they are", () => {
  for (const role of ["abo", "admin", "member", "other", null]) {
    const r = resolveReach("owner", role);
    assert.equal(r.kind, "owner", `role ${role}`);
    assert.equal(r.downgraded, false);
  }
});

test("'all' is honoured only while the owner is still an admin", () => {
  assert.equal(resolveReach("all", "admin").kind, "all");
});

test("★ an 'all' token whose owner is no longer admin drops to their own hierarchy", () => {
  // the case that matters: someone was an admin when the token was issued, then wasn't
  for (const role of ["abo", "member", "other", null, undefined]) {
    const r = resolveReach("all", role as any);
    assert.equal(r.kind, "owner", `role ${role} must not keep全部 access`);
    assert.equal(r.downgraded, true);
    assert.match(r.reason ?? "", /ไม่ได้เป็นแอดมิน/);
  }
});

test("an unrecognised scope string fails closed, it does not fall open", () => {
  for (const spec of ["everything", "coach:11111111-1111-1111-1111-111111111111", "*", "admin"]) {
    const r = resolveReach(spec, "abo");
    assert.equal(r.kind, "owner", `"${spec}" must not widen access`);
    assert.equal(r.downgraded, true);
  }
});

test("the legacy coach:<id> form no longer grants anything by itself", () => {
  // it used to name the coach; now ownership is explicit, so the string is meaningless
  const r = resolveReach("coach:99999999-9999-9999-9999-999999999999", "abo");
  assert.equal(r.kind, "owner");
  assert.equal(r.downgraded, true);
});

test("an empty or missing scope defaults to the owner's hierarchy", () => {
  assert.equal(resolveReach("", "abo").kind, "owner");
  assert.equal(resolveReach(undefined as any, "abo").kind, "owner");
});

test("a list scope parses its ids", () => {
  const r = resolveReach("list:aaa,bbb , ccc", "abo");
  assert.equal(r.kind, "list");
  assert.deepEqual((r as any).ids, ["aaa", "bbb", "ccc"]);
});

test("an empty list reaches nobody rather than everybody", () => {
  const r = resolveReach("list:", "admin");
  assert.equal(r.kind, "list");
  assert.deepEqual((r as any).ids, []);
  assert.equal(r.downgraded, true);
});

test("★ a list can only subtract from the owner's reach, never add to it", () => {
  const listed = ["in-1", "OUTSIDE", "in-2"];
  const ownerCanSee = ["in-1", "in-2", "in-3"];
  const { allowed, rejected } = intersectWithOwnerReach(listed, ownerCanSee);
  assert.deepEqual(allowed, ["in-1", "in-2"]);
  assert.deepEqual(rejected, ["OUTSIDE"], "an id outside the downline must be dropped, not honoured");
});

test("a list naming only unreachable customers ends up reaching none", () => {
  const { allowed } = intersectWithOwnerReach(["x", "y"], ["a", "b"]);
  assert.deepEqual(allowed, []);
});

test("an empty owner reach means an empty result even for a long list", () => {
  const { allowed, rejected } = intersectWithOwnerReach(["a", "b", "c"], []);
  assert.deepEqual(allowed, []);
  assert.equal(rejected.length, 3);
});

test("reach descriptions are human-readable for the admin table", () => {
  assert.match(describeReach(resolveReach("all", "admin"), 83), /ทุกคน/);
  assert.match(describeReach(resolveReach("owner", "abo"), 12), /สายงาน/);
  assert.match(describeReach(resolveReach("list:a,b", "abo"), 2), /2 คน/);
});
