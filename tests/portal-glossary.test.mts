/** Customer-portal glossary: every engine driver has a plain-Thai line; bands mirror the engine (SPEC-Mobile-Portal.md Q4). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOSSARY, ENGINE_DRIVER_METRICS, bandsFor, barPosition, barSegments, panelOf, explain as glossaryOf } from "../lib/health-design/glossary.ts";

test("glossary: every engine driver metric has a plain-Thai line and a source; all lines are unreviewed until the pharmacist signs off", () => {
  for (const m of ENGINE_DRIVER_METRICS) {
    const g = GLOSSARY[m];
    assert.ok(g, `missing glossary for ${m}`);
    assert.ok(g.what_th.length >= 15 && g.source.length >= 1, m);
    assert.equal(g.reviewed, false, m);
    assert.ok(!/วินิจฉัย|รักษา|Nutrilite/.test(g.what_th), m);
  }
  assert.equal(glossaryOf("no_such_metric"), null);
});

test("glossary bands mirror the engine: HbA1c cut-points 5.7/6.5, fat% split by sex, trend-only metrics have none", () => {
  assert.deepEqual(bandsFor("hba1c", null)!.map((b) => b.to), [5.7, 6.5, undefined]);
  assert.equal(bandsFor("fat_pct", "male")![1].to, 20); assert.equal(bandsFor("fat_pct", "female")![1].to, 30);
  assert.equal(bandsFor("hrv", null), null); assert.equal(bandsFor("cgm_gmi", null), null);
  // bar geometry: value inside the watch band lands inside the watch segment
  const bands = bandsFor("hba1c", null)!;
  const segs = barSegments(bands); const p = barPosition(5.8, bands);
  const seg = segs.find((s) => p >= s.from && p < s.to)!;
  assert.equal(seg.level, "watch");
  assert.ok(barPosition(3, bands) === 0 && barPosition(99, bands) === 1);
  assert.equal(panelOf("ldl"), "lipid"); assert.equal(panelOf("tsh"), "thyroid"); assert.equal(panelOf("mystery"), "other");
});

