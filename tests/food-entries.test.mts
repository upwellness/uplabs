/**
 * Food log decisions — time is never guessed, macros are never stored unconfirmed,
 * EXIF is read correctly from both byte orders, summaries average over logged days.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEatenAt, exifDateTime, validateEntry, summariseFood, bangkokDate } from "../lib/food/entries.ts";

const NOW = "2026-09-12T10:00:00.000Z"; // 17:00 Bangkok

test("parseEatenAt: Thai wall-clock, EXIF, ISO and bare date all land on the right instant", () => {
  assert.equal(parseEatenAt("2026-09-12 12:30", NOW)!.iso, "2026-09-12T05:30:00.000Z");
  assert.equal(parseEatenAt("2026-09-12T12:30", NOW)!.iso, "2026-09-12T05:30:00.000Z");
  assert.equal(parseEatenAt("2026:09:12 12:30:15", NOW)!.iso, "2026-09-12T05:30:15.000Z"); // EXIF form
  assert.equal(parseEatenAt("2026-09-12T05:30:00+00:00", NOW)!.iso, "2026-09-12T05:30:00.000Z");
  assert.equal(parseEatenAt("2026-09-12T12:30:00+07:00", NOW)!.iso, "2026-09-12T05:30:00.000Z");
  const bare = parseEatenAt("2026-09-10", NOW)!;
  assert.equal(bare.time_known, false); assert.equal(bare.iso, "2026-09-10T05:00:00.000Z"); assert.equal(bare.date_bkk, "2026-09-10");
  assert.equal(parseEatenAt("2026-09-12 12:30", NOW)!.time_known, true);
});

test("parseEatenAt: refuses the future, garbage, and impossible dates — never falls back to now", () => {
  assert.equal(parseEatenAt("2026-09-12 18:00", NOW), null);      // 18:00 BKK > 17:05 BKK
  assert.equal(parseEatenAt("2026-09-12 17:04", NOW)!.iso, "2026-09-12T10:04:00.000Z"); // within +5 min grace
  for (const bad of ["", "yesterday", "12/09/2026", "2026-13-01 10:00", "2026-09-12 25:00", 123, null, undefined]) {
    assert.equal(parseEatenAt(bad, NOW), null, String(bad));
  }
});

test("bangkokDate crosses midnight correctly", () => {
  assert.equal(bangkokDate("2026-09-12T16:59:00.000Z"), "2026-09-12");
  assert.equal(bangkokDate("2026-09-12T17:00:00.000Z"), "2026-09-13");
});

/** Minimal JPEG: SOI · APP1 "Exif\0\0" + TIFF with IFD0 → ExifIFD holding DateTimeOriginal */
function jpegWithExif(dt: string, littleEndian: boolean, tag = 0x9003): Uint8Array {
  const le = littleEndian;
  const u16 = (v: number) => (le ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (le ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const tiff: number[] = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(0x2a), ...u32(8)];
  // IFD0 at 8: 1 entry (ExifIFD pointer) → next IFD 0
  const ifd0 = [...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0)];
  tiff.push(...ifd0);                                  // 8..25  (2 + 12 + 4 = 18 bytes → ends at 26)
  // ExifIFD at 26: 1 entry (date ASCII, count 20, offset 44) → next 0
  const exifIfd = [...u16(1), ...u16(tag), ...u16(2), ...u32(20), ...u32(44), ...u32(0)];
  tiff.push(...exifIfd);                               // 26..43
  tiff.push(...Array.from(dt, (c) => c.charCodeAt(0)), 0); // 44..63
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...app1, 0xff, 0xd9]);
}

test("exifDateTime: reads DateTimeOriginal in both byte orders and falls back to DateTime; non-JPEG → null", () => {
  assert.equal(exifDateTime(jpegWithExif("2026:09:05 07:41:12", true)), "2026:09:05 07:41:12");
  assert.equal(exifDateTime(jpegWithExif("2026:09:05 07:41:12", false)), "2026:09:05 07:41:12");
  assert.equal(exifDateTime(jpegWithExif("2026:09:05 07:41:12", true, 0x0132)), "2026:09:05 07:41:12");
  assert.equal(exifDateTime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])), null); // PNG
  assert.equal(exifDateTime(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0, 0xff, 0xd9])), null);  // JPEG with no APP1
  // an EXIF date is a suggestion that still goes through parseEatenAt
  assert.equal(parseEatenAt(exifDateTime(jpegWithExif("2026:09:05 07:41:12", true))!, NOW)!.iso, "2026-09-05T00:41:12.000Z");
});

test("validateEntry: confirmed must be literally true; time and description required; ranges enforced", () => {
  const D = { source: "api" as const, estimated_by: "client_ai" as const };
  const ok = validateEntry({ confirmed: true, eaten_at: "2026-09-12 12:30", description: "ข้าวมันไก่ 1 จาน", calories: 650, carb_g: 80, protein_g: 30, fat_g: 22, meal_type: "lunch", items: ["ข้าวมันไก่", "น้ำจิ้ม"] }, NOW, D);
  assert.ok(ok.ok);
  assert.equal(ok.value.eaten_at.iso, "2026-09-12T05:30:00.000Z"); assert.equal(ok.value.meal_type, "lunch"); assert.equal(ok.value.items.length, 2);
  assert.equal(ok.value.source, "api"); assert.equal(ok.value.estimated_by, "client_ai"); assert.equal(ok.value.fiber_g, null);

  assert.match((validateEntry({ confirmed: "yes", eaten_at: "2026-09-12 12:30", description: "x", calories: 1 }, NOW, D) as any).error, /confirmed/);
  assert.match((validateEntry({ confirmed: true, description: "x", calories: 1 }, NOW, D) as any).error, /eaten_at/);
  assert.match((validateEntry({ confirmed: true, eaten_at: "2026-09-12 12:30", calories: 1 }, NOW, D) as any).error, /description/);
  assert.match((validateEntry({ confirmed: true, eaten_at: "2026-09-12 12:30", description: "x" }, NOW, D) as any).error, /อย่างน้อย/);
  assert.match((validateEntry({ confirmed: true, eaten_at: "2026-09-12 12:30", description: "x", calories: 9999 }, NOW, D) as any).error, /calories/);
  assert.match((validateEntry({ confirmed: true, eaten_at: "2026-09-12 12:30", description: "x", protein_g: -1 }, NOW, D) as any).error, /protein_g/);
  const bare = validateEntry({ confirmed: true, eaten_at: "2026-09-11", description: "x", calories: 300, meal_type: "brunch" }, NOW, D);
  assert.ok(bare.ok); assert.equal(bare.value.eaten_at.time_known, false); assert.equal(bare.value.meal_type, null);
});

test("summariseFood: groups by Bangkok date, C:P:F from macros, averages over logged days only", () => {
  const rows = [
    { eaten_at: "2026-09-10T01:00:00Z", calories: 500, carb_g: 60, protein_g: 20, fat_g: 15, fiber_g: 5, glucose_impact_score: 6, health_score: 7 },
    { eaten_at: "2026-09-10T12:00:00Z", calories: 700, carb_g: 80, protein_g: 40, fat_g: 20, fiber_g: 4, glucose_impact_score: 4, health_score: 8 },
    { eaten_at: "2026-09-11T17:30:00Z", calories: 400, carb_g: 30, protein_g: 30, fat_g: 10, fiber_g: null, glucose_impact_score: null, health_score: 6 }, // 00:30 on the 12th BKK
  ];
  const s = summariseFood(rows, 14);
  assert.equal(s.days_logged, 2); assert.equal(s.entries, 3); assert.equal(s.coverage_pct, 14);
  assert.deepEqual(s.days.map((d) => d.date), ["2026-09-10", "2026-09-12"]);
  assert.equal(s.days[0].calories, 1200); assert.equal(s.days[0].protein_g, 60);
  assert.deepEqual(s.days[0].cpf_pct, { carb: 50, protein: 22, fat: 28 });    // 560+240+315 = 1115 kcal
  assert.equal(s.avg_calories, 800);                                             // (1200 + 400) / 2 — logged days only
  assert.equal(s.avg_protein_g, 45);
  assert.equal(s.avg_health_score, 7);
  assert.equal(s.avg_glucose_impact, 5);
  assert.equal(summariseFood([], 14).avg_calories, null);
});
