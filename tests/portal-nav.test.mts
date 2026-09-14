/** Portal hash router + formatters + monotone curve (SPEC-Mobile-Portal.md §5.3). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHash, toHash, fmtDateTh, fmtTimeTh, fmtNum, levelShort, monotonePath, scaleSeries, daysBetween } from "../lib/health-design/portal-nav.ts";

test("parseHash: tabs, domain, metric, ai layers; junk → home", () => {
  assert.deepEqual(parseHash(""), { page: "home", tab: "home", domain: null, metric: null, ai: false });
  assert.deepEqual(parseHash("#health"), { page: "health", tab: "health", domain: null, metric: null, ai: false });
  assert.deepEqual(parseHash("#health/body_comp"), { page: "health", tab: "health", domain: "body_comp", metric: null, ai: false });
  assert.deepEqual(parseHash("#health/body_comp/fat_pct"), { page: "health", tab: "health", domain: "body_comp", metric: "fat_pct", ai: false });
  assert.deepEqual(parseHash("#health/body_comp/fat_pct/ai"), { page: "health", tab: "health", domain: "body_comp", metric: "fat_pct", ai: true });
  assert.deepEqual(parseHash("#health/body_comp/ai"), { page: "health", tab: "health", domain: "body_comp", metric: null, ai: true });
  assert.deepEqual(parseHash("#home/ai").ai, true);
  assert.equal(parseHash("#health/not_a_domain").domain, null);
  assert.deepEqual(parseHash("#src/labs/hba1c"), { page: "src-labs", tab: "health", domain: null, metric: "hba1c", ai: false });
  assert.equal(parseHash("#food/new").page, "food-new");
  assert.equal(parseHash("#garbage").page, "home");
});

test("toHash round-trips parseHash", () => {
  for (const h of ["#home", "#home/ai", "#health", "#health/metabolic", "#health/metabolic/hba1c", "#health/metabolic/hba1c/ai", "#health/recovery/ai", "#src/cgm", "#src/labs/ldl", "#src/labs/ldl/ai", "#food", "#food/new", "#plan", "#me"]) {
    assert.equal(toHash(parseHash(h)), h, h);
  }
});

test("formatters: Thai short dates in Bangkok time, level chips split clinical vs lifestyle", () => {
  assert.equal(fmtDateTh("2026-09-08", "2026-09-14"), "8 ก.ย.");
  assert.equal(fmtDateTh("2026-02-13", "2026-09-14"), "13 ก.พ.");
  assert.equal(fmtDateTh("2025-12-31T20:00:00Z", "2026-09-14"), "1 ม.ค."); // 03:00 Bangkok next day
  assert.equal(fmtDateTh("2025-06-01", "2026-09-14"), "1 มิ.ย. 68");
  assert.equal(fmtTimeTh("2026-09-13T15:58:05Z"), "22:58");
  assert.equal(fmtNum(7096), "7,096"); assert.equal(fmtNum(31.26), "31.3"); assert.equal(fmtNum(null), "—");
  assert.equal(levelShort("metabolic", "attention"), "ปรึกษาแพทย์"); assert.equal(levelShort("body_comp", "attention"), "ดูแลจริงจัง");
  assert.equal(levelShort("recovery", null), "ยังไม่มีข้อมูล");
  assert.equal(daysBetween("2026-09-02", "2026-09-14"), 12);
});

test("monotonePath never overshoots: a flat run stays flat, a rise stays inside the sample bounds", () => {
  const flat = monotonePath([{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 10 }]);
  const flatYs = flat.match(/[\d.]+ ([\d.]+)/g)!.map((s) => Number(s.split(" ")[1]));
  assert.ok(flatYs.every((y) => y === 10), flat);
  const rise = monotonePath([{ x: 0, y: 100 }, { x: 10, y: 100 }, { x: 20, y: 50 }, { x: 30, y: 50 }]);
  const ys = rise.match(/[\d.]+ ([\d.]+)/g)!.map((s) => Number(s.split(" ")[1]));
  assert.ok(ys.every((y) => y >= 50 && y <= 100), rise);
  const { pts, lo, hi } = scaleSeries([1, 2, 3], 100, 50);
  assert.equal(lo, 1); assert.equal(hi, 3); assert.equal(pts[0].y > pts[2].y, true); assert.equal(pts.length, 3);
});
