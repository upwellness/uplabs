/**
 * Tests for the External API intent resolver.
 *
 * The resolver is the only part of the API that guesses anything, so it is the part
 * worth pinning down. Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveIntent, extractRounds, extractMetric, extractNameQuery, intentCatalogue, INTENT_NAMES,
} from "../lib/api/resolver.ts";

test("the headline ask routes to labs.compare with the right round count", () => {
  const r = resolveIntent("ช่วยเทียบผลแล็บย้อนหลัง 3 รอบ ของ คุณสมหญิง หน่อย");
  assert.equal(r.intent, "labs.compare");
  assert.equal(r.params.rounds, 3);
  assert.ok(r.confidence > 0.6, `confidence too low: ${r.confidence}`);
});

test("the other two asks from the brief resolve", () => {
  assert.equal(resolveIntent("ช่วยวิเคราะห์ภาพรวมจากทุก factor ของ ต้น หน่อย").intent, "overview.longevity");
  assert.equal(resolveIntent("ขอ Link สมัคร ให้ที").intent, "links.invite");
});

test("English commands work too", () => {
  assert.equal(resolveIntent("compare the last 5 lab rounds").intent, "labs.compare");
  assert.equal(resolveIntent("compare the last 5 lab rounds").params.rounds, 5);
});

test("round count: digits, Thai number words, and sane defaults", () => {
  assert.equal(extractRounds("ย้อนหลัง 5 ครั้ง"), 5);
  assert.equal(extractRounds("เทียบ 2 รอบ"), 2);
  assert.equal(extractRounds("เทียบสามรอบ"), 3);
  assert.equal(extractRounds("last 4 rounds"), 4);
  assert.equal(extractRounds("เทียบผลแล็บหน่อย"), 3, "no number given → default 3");
  assert.equal(extractRounds("ย้อนหลัง 999 รอบ"), 20, "clamped to the query cap");
  assert.equal(extractRounds("ย้อนหลัง 0 รอบ"), 1, "never zero");
});

test("metric names resolve from Thai and English, longest match winning", () => {
  assert.equal(extractMetric("ค่า HbA1c ย้อนหลัง"), "hba1c");
  assert.equal(extractMetric("ดูค่าน้ำตาลสะสม"), "hba1c");
  assert.equal(extractMetric("ไขมันดีเป็นยังไง"), "hdl", "ไขมันดี must beat a bare ไขมัน");
  assert.equal(extractMetric("ไขมันเลวสูงไหม"), "ldl");
  assert.equal(extractMetric("ค่าไตรกลีเซอไรด์"), "triglyceride");
  assert.equal(extractMetric("สวัสดีครับ"), null);
});

test("labs.metric only fires when a real metric is named", () => {
  // "ค่า" alone is far too common a word to route on
  const vague = resolveIntent("ขอดูค่าของ ต้น");
  assert.notEqual(vague.intent, "labs.metric");
  assert.equal(resolveIntent("ขอดูค่า LDL ของ ต้น ย้อนหลัง").intent, "labs.metric");
});

test("a name is extracted, not decided", () => {
  assert.equal(extractNameQuery('ผลแล็บของ "คุณมาลี ก."'), "คุณมาลี ก.", "quoted wins");
  assert.ok((extractNameQuery("ผลแล็บล่าสุดของ คุณสมหญิง") ?? "").includes("คุณสมหญิง"));
  assert.ok((extractNameQuery("หาลูกค้าชื่อ สมหญิง") ?? "").includes("สมหญิง"));
});

test("filler words never become a name", () => {
  // "ช่วย…หน่อย" and "ครับ" are politeness, not people
  const n = extractNameQuery("ช่วยเทียบผลแล็บย้อนหลัง 3 รอบหน่อยครับ");
  assert.ok(n === null || n.length < 3, `filler leaked into the name: ${n}`);
});

test("an unrecognised command returns no intent instead of a wrong one", () => {
  const r = resolveIntent("วันนี้อากาศเป็นยังไงบ้าง");
  assert.equal(r.intent, null);
  assert.equal(r.confidence, 0);
});

test("an explicit intent skips scoring entirely", () => {
  const r = resolveIntent("อะไรก็ไม่รู้", "labs.compare");
  assert.equal(r.intent, "labs.compare");
  assert.equal(r.confidence, 1);
});

test("a bogus forced intent falls back to scoring rather than being trusted", () => {
  const r = resolveIntent("ขอลิงก์สมัคร", "labs.explode");
  assert.equal(r.intent, "links.invite");
});

test("notes.add captures the body after ว่า", () => {
  const r = resolveIntent("จดโน้ตให้ ต้น ว่า นัดตรวจเอนไซม์ตับรอบหน้า");
  assert.equal(r.intent, "notes.add");
  assert.match(r.params.body, /เอนไซม์ตับ/);
});

test("BCA and supplements do not collide with lab queries", () => {
  assert.equal(resolveIntent("ค่า BCA ของ ต้น").intent, "measurements.list");
  assert.equal(resolveIntent("ต้น ทานอาหารเสริมอะไรอยู่").intent, "supplements.list");
});

test("abnormal-value questions beat the generic lab lookup", () => {
  assert.equal(resolveIntent("ค่าผิดปกติของ ต้น มีอะไรบ้าง").intent, "labs.abnormal");
});

test("every catalogued intent is real and every example resolves to itself", () => {
  for (const entry of intentCatalogue()) {
    assert.ok(INTENT_NAMES.includes(entry.intent), `${entry.intent} is not a real intent`);
    for (const ex of entry.examples) {
      const got = resolveIntent(ex).intent;
      assert.equal(got, entry.intent, `example "${ex}" resolved to ${got}, expected ${entry.intent}`);
    }
  }
});

test("the resolver is pure — same input, same output", () => {
  const q = "เทียบผลแล็บย้อนหลัง 3 รอบของ ต้น";
  assert.deepEqual(resolveIntent(q), resolveIntent(q));
});
