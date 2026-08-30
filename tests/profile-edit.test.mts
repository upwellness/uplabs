/**
 * Validation for the customer identity fields.
 *
 * These four values feed age, BMI, PhenoAge and every reference range in the app.
 * A wrong birth year produces wrong numbers everywhere and nothing looks broken —
 * which is exactly why the rules are pinned here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProfileEdit } from "../lib/v2/identity.ts";

const TODAY = new Date("2026-08-30T00:00:00Z");
const v = (i: any) => validateProfileEdit(i, TODAY);

test("a complete, sane profile passes and comes back normalised", () => {
  const r = v({ name: "  คุณสมหญิง  ", gender: "female", birth_date: "1984-01-01", height: "165" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { name: "คุณสมหญิง", gender: "female", birth_date: "1984-01-01", height: 165 });
});

test("name is required and trimmed", () => {
  assert.equal(v({ name: "" }).ok, false);
  assert.equal(v({ name: "   " }).ok, false);
  assert.equal(v({ name: "ก" }).value!.name, "ก");
});

test("★ a Buddhist year is caught and the Gregorian one is offered", () => {
  // The real mistake: Thai lab slips print พ.ศ., so 2569 gets typed into a ค.ศ. field
  const r = v({ name: "x", birth_date: "2569-01-01" });
  assert.equal(r.ok, false);
  assert.match(r.error!, /2569/);
  assert.match(r.error!, /2026/, "must show the Gregorian equivalent, not just refuse");
});

test("any future birth date is refused, not only a Buddhist-looking one", () => {
  assert.equal(v({ name: "x", birth_date: "2027-01-01" }).ok, false);
  assert.equal(v({ name: "x", birth_date: "2026-12-31" }).ok, false, "later this year is still the future");
  assert.equal(v({ name: "x", birth_date: "2026-08-30" }).ok, true, "today is allowed");
});

test("an implausibly old year is refused", () => {
  assert.equal(v({ name: "x", birth_date: "1899-01-01" }).ok, false);
  assert.equal(v({ name: "x", birth_date: "1900-01-01" }).ok, true);
});

test("a malformed date does not slip through", () => {
  for (const bad of ["1984", "01/01/1984", "1984-1-1", "not-a-date", "1984-13-01"]) {
    assert.equal(v({ name: "x", birth_date: bad }).ok, false, `should refuse ${bad}`);
  }
});

test("birth date is optional", () => {
  assert.equal(v({ name: "x" }).ok, true);
  assert.equal(v({ name: "x", birth_date: "" }).value!.birth_date, null);
  assert.equal(v({ name: "x", birth_date: null }).value!.birth_date, null);
});

test("★ height in metres is caught — 1.65 is not a height in cm", () => {
  assert.equal(v({ name: "x", height: "1.65" }).ok, false);
  assert.equal(v({ name: "x", height: "165" }).ok, true);
});

test("a weight typed into the height box is caught", () => {
  assert.equal(v({ name: "x", height: "58" }).ok, true, "58cm is a plausible child, allowed");
  assert.equal(v({ name: "x", height: "300" }).ok, false);
  assert.equal(v({ name: "x", height: "0" }).ok, false);
  assert.equal(v({ name: "x", height: "-165" }).ok, false);
});

test("height accepts a number as well as a string, and stays optional", () => {
  assert.equal(v({ name: "x", height: 172 }).value!.height, 172);
  assert.equal(v({ name: "x", height: "" }).value!.height, null);
  assert.equal(v({ name: "x", height: null }).value!.height, null);
  assert.equal(v({ name: "x", height: "abc" }).ok, false);
});

test("gender is limited to the values the clinical thresholds understand", () => {
  assert.equal(v({ name: "x", gender: "male" }).ok, true);
  assert.equal(v({ name: "x", gender: "female" }).ok, true);
  assert.equal(v({ name: "x", gender: "" }).value!.gender, null, "blank means not stated");
  assert.equal(v({ name: "x", gender: "ชาย" }).ok, false, "must be the stored code, not a label");
});

test("validation is pure — same input, same result", () => {
  const i = { name: "x", gender: "male", birth_date: "1990-05-05", height: "170" };
  assert.deepEqual(v(i), v(i));
});

/* ── partial updates ──────────────────────────────────────────────────────────
 * Found by testing against production: merging the stored row in before validating
 * made a record with an already-bad birth date impossible to edit at all — every
 * change failed on the old date, and the error named a field the user never touched.
 * Records that need repair are exactly the records people edit.
 */

test("★ a field that was not sent is not validated", () => {
  // fixing the height on a profile whose stored birth date is already wrong
  const r = v({ height: "172" });
  assert.equal(r.ok, true, "must not fail on a field the caller did not touch");
  assert.equal(r.value!.height, 172);
});

test("★ a name can be corrected on its own", () => {
  const r = v({ name: "ชื่อที่แก้แล้ว" });
  assert.equal(r.ok, true);
  assert.equal(r.value!.name, "ชื่อที่แก้แล้ว");
});

test("a bad value is still caught when it IS the field being sent", () => {
  assert.equal(v({ height: "1.65" }).ok, false);
  assert.equal(v({ birth_date: "2569-01-01" }).ok, false);
  assert.equal(v({ gender: "ชาย" }).ok, false);
  assert.equal(v({ name: "" }).ok, false);
});

test("sending nothing is valid — it simply changes nothing", () => {
  assert.equal(v({}).ok, true);
});

test("an explicit null still clears the field", () => {
  assert.equal(v({ birth_date: null }).value!.birth_date, null);
  assert.equal(v({ height: null }).value!.height, null);
  assert.equal(v({ gender: null }).value!.gender, null);
});

test("all four together still validate as before", () => {
  const r = v({ name: "ก", gender: "male", birth_date: "1980-06-01", height: 175 });
  assert.deepEqual(r.value, { name: "ก", gender: "male", birth_date: "1980-06-01", height: 175 });
});
