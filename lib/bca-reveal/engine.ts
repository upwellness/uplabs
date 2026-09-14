/**
 * BCA Reveal — the customer-facing result page for one body-composition scan
 * (/r/bca/<token>). Pure: numbers in, view model out. Tested in tests/bca-reveal.test.mts.
 *
 * Every verdict comes from lib/medical-status.ts (the clinic's official chart) — this file
 * never invents a threshold. What it adds is arithmetic the customer can play with
 * (fat mass, the weight where fat% would land in the healthy band, energy by activity,
 * a protein range) and a rule-based ranking of the L1/L2/L3 guidance so the page reads
 * as "for you" rather than a brochure.
 *
 * Longevity levels follow the UP Wellness pyramid (reference_opp_frameworks):
 *   L1 Lifestyle+ (0 บาท · ~95% of results) · L2 Foundation supplements · L3 Biomarker tracking
 * L2 names only foundation nutrients — no products, no doses; the pharmacist/coach sets those.
 */
import { bandBodyFat, bandMusclePct, bandVisceralFat, bandBMI, classifyBodyAge, STATUS_LABEL_TH, type StatusLevel, type Gender } from "@/lib/medical-status";
import { deriveBMI } from "@/lib/bca-derive";

export interface RevealInput {
  gender: Gender | null; age: number | null; height_cm: number | null;
  weight: number | null; fat_pct: number | null; muscle_pct: number | null; visceral: number | null; body_age: number | null; bmr: number | null;
}
export type MetricKey = "fat_pct" | "muscle_pct" | "visceral" | "bmi" | "body_age" | "bmr";
export interface MetricView { key: MetricKey; value: number | null; unit: string; level: StatusLevel | null; label: string; note?: string }

export interface RevealAssessment {
  metrics: MetricView[];
  /** worst level across graded metrics — drives the hero colour */
  overall: StatusLevel | null;
  headline: string;
  fat_mass_kg: number | null; lean_mass_kg: number | null;
  /** weight at which fat% would sit in the middle of the healthy band, keeping lean mass */
  healthy_weight_kg: number | null; healthy_fat_target_pct: number | null;
  gender_used: Gender; gender_assumed: boolean;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const RANK: Record<StatusLevel, number> = { optimal: 0, good: 1, caution: 2, warning: 3, danger: 4 };
export const worstLevel = (ls: (StatusLevel | null)[]): StatusLevel | null => ls.reduce<StatusLevel | null>((w, l) => (l == null ? w : w == null || RANK[l] > RANK[w] ? l : w), null);

/** Healthy fat% band per the clinic chart (female 20–29.9 · male 10–19.9) → midpoint target. */
export const healthyFatTarget = (g: Gender) => (g === "male" ? 15 : 25);

export function assessScan(i: RevealInput): RevealAssessment {
  const g: Gender = i.gender ?? "female";
  const bmi = deriveBMI(i.weight, i.height_cm);
  const metrics: MetricView[] = [];
  if (i.fat_pct != null) { const b = bandBodyFat(i.fat_pct, g); metrics.push({ key: "fat_pct", value: i.fat_pct, unit: "%", level: b.level, label: b.label }); }
  else metrics.push({ key: "fat_pct", value: null, unit: "%", level: null, label: "ไม่มีข้อมูล" });
  if (i.muscle_pct != null) { const b = bandMusclePct(i.muscle_pct, g); metrics.push({ key: "muscle_pct", value: i.muscle_pct, unit: "%", level: b.level, label: b.label }); }
  else metrics.push({ key: "muscle_pct", value: null, unit: "%", level: null, label: "ไม่มีข้อมูล" });
  if (i.visceral != null) { const b = bandVisceralFat(i.visceral); metrics.push({ key: "visceral", value: i.visceral, unit: "ระดับ", level: b.level, label: b.label }); }
  else metrics.push({ key: "visceral", value: null, unit: "ระดับ", level: null, label: "ไม่มีข้อมูล" });
  if (bmi != null) { const b = bandBMI(bmi); metrics.push({ key: "bmi", value: bmi, unit: "kg/m²", level: b.level, label: b.label }); }
  else metrics.push({ key: "bmi", value: null, unit: "kg/m²", level: null, label: i.height_cm ? "ไม่มีน้ำหนัก" : "ไม่มีส่วนสูง", note: "ต้องมีส่วนสูงและน้ำหนักถึงคำนวณได้" });
  if (i.body_age != null && i.age != null) { const l = classifyBodyAge(i.body_age, i.age); metrics.push({ key: "body_age", value: i.body_age, unit: "ปี", level: l, label: STATUS_LABEL_TH[l], note: `อายุจริง ${i.age}` }); }
  else metrics.push({ key: "body_age", value: i.body_age, unit: "ปี", level: null, label: i.body_age == null ? "ไม่มีข้อมูล" : "ไม่ทราบอายุจริง" });
  metrics.push({ key: "bmr", value: i.bmr, unit: "kcal", level: null, label: i.bmr == null ? "ไม่มีข้อมูล" : "ตอนพัก" });

  const fat_mass_kg = i.weight != null && i.fat_pct != null ? r1((i.weight * i.fat_pct) / 100) : null;
  const lean_mass_kg = i.weight != null && fat_mass_kg != null ? r1(i.weight - fat_mass_kg) : null;
  const target = healthyFatTarget(g);
  // keep lean mass, change only fat: W = lean / (1 − target)
  const healthy_weight_kg = i.weight != null && i.fat_pct != null ? r1((i.weight * (1 - i.fat_pct / 100)) / (1 - target / 100)) : null;

  const fat = metrics.find((m) => m.key === "fat_pct")!, mus = metrics.find((m) => m.key === "muscle_pct")!, vis = metrics.find((m) => m.key === "visceral")!;
  const overall = worstLevel([fat.level, mus.level, vis.level, metrics.find((m) => m.key === "bmi")!.level]);
  const fatHigh = fat.level === "warning" || fat.level === "danger";
  const fatLow = fat.level === "caution";
  const musLow = mus.level === "warning" || mus.level === "danger";
  const visHigh = vis.level != null && RANK[vis.level] >= RANK.caution;
  let headline: string;
  if (fat.value == null && mus.value == null) headline = "ยังมีข้อมูลไม่พอสรุป — ชั่งอีกครั้งให้ครบทุกค่า";
  else if (fatHigh && musLow) headline = "ไขมันสูงกว่าเกณฑ์และกล้ามเนื้อยังน้อย — เป้าคือลดไขมันพร้อมสร้างกล้ามเนื้อ ไม่ใช่ลดน้ำหนักอย่างเดียว";
  else if (fatHigh && visHigh) headline = "ไขมันสูงกว่าเกณฑ์ โดยเฉพาะไขมันรอบอวัยวะในช่องท้อง — เป้าคือลดไขมันโดยรักษากล้ามเนื้อไว้";
  else if (fatHigh) headline = "ไขมันสูงกว่าเกณฑ์ แต่กล้ามเนื้ออยู่ในเกณฑ์ดี — เป้าคือลดไขมันโดยรักษากล้ามเนื้อไว้";
  else if (musLow) headline = "ไขมันอยู่ในเกณฑ์ แต่กล้ามเนื้อยังน้อย — เป้าคือเพิ่มกล้ามเนื้อด้วยโปรตีนและแรงต้าน";
  else if (visHigh) headline = "ภาพรวมอยู่ในเกณฑ์ แต่ไขมันช่องท้องเริ่มสูง — จุดที่ควรจับตาก่อน";
  else if (fatLow) headline = "ไขมันต่ำกว่าเกณฑ์ — ดูให้แน่ใจว่ากินพอและกล้ามเนื้อไม่ลด";
  else headline = "องค์ประกอบร่างกายอยู่ในเกณฑ์ดี — เป้าคือรักษาไว้และสร้างกล้ามเนื้อสะสมสำหรับวัยที่มากขึ้น";

  return { metrics, overall, headline, fat_mass_kg, lean_mass_kg, healthy_weight_kg, healthy_fat_target_pct: fat.value != null ? target : null, gender_used: g, gender_assumed: i.gender == null };
}

/* ── things to play with ─────────────────────────────────────────────────────── */

export const ACTIVITY = [
  { key: "sedentary", label: "นั่งเป็นหลัก", factor: 1.2 },
  { key: "light", label: "เดินบ้าง 1–3 วัน/สัปดาห์", factor: 1.375 },
  { key: "moderate", label: "ออกกำลัง 3–5 วัน/สัปดาห์", factor: 1.55 },
  { key: "active", label: "หนัก 6–7 วัน/สัปดาห์", factor: 1.725 },
] as const;
export type ActivityKey = (typeof ACTIVITY)[number]["key"];

/** Mifflin–St Jeor when the scale gave no BMR. */
export function estimateBmr(i: RevealInput): number | null {
  if (i.bmr != null) return Math.round(i.bmr);
  if (i.weight == null || i.height_cm == null || i.age == null) return null;
  const g = i.gender ?? "female";
  return Math.round(10 * i.weight + 6.25 * i.height_cm - 5 * i.age + (g === "male" ? 5 : -161));
}
export const tdee = (bmr: number, activity: ActivityKey) => Math.round(bmr * (ACTIVITY.find((a) => a.key === activity)?.factor ?? 1.2));

/** What changes if fat% moves to `targetPct` and lean mass stays: kg of fat to lose and the weight then. */
export function fatScenario(i: RevealInput, targetPct: number): { fat_to_lose_kg: number; weight_then_kg: number; weeks_at_half_kg: number } | null {
  if (i.weight == null || i.fat_pct == null) return null;
  const lean = i.weight * (1 - i.fat_pct / 100);
  const weightThen = lean / (1 - targetPct / 100);
  const lose = Math.max(0, i.weight - weightThen);
  return { fat_to_lose_kg: r1(lose), weight_then_kg: r1(weightThen), weeks_at_half_kg: Math.ceil(lose / 0.5) };
}

/** PROT-AGE / ESPEN 1.2–1.6 g/kg for adults doing resistance work; shown as a range, never a prescription. */
export const proteinRange = (weight: number | null) => (weight == null ? null : { low: Math.round(weight * 1.2), high: Math.round(weight * 1.6) });

/** ACSM walking ≈ 3.5 MET → kcal ≈ MET × 3.5 × kg / 200 per minute. */
export const walkingKcal = (weight: number | null, minutes: number) => (weight == null ? null : Math.round(((3.5 * 3.5 * weight) / 200) * minutes));

/* ── quick self-check (5 questions) ──────────────────────────────────────────── */

export interface Quiz { sleep_h: number | null; steps: "lt5k" | "5to7k" | "gt7k" | null; veg_first: boolean | null; sugary_drinks: "none" | "some" | "daily" | null; stress: "low" | "mid" | "high" | null }
export const QUIZ_EMPTY: Quiz = { sleep_h: null, steps: null, veg_first: null, sugary_drinks: null, stress: null };

/* ── personalised guidance ───────────────────────────────────────────────────── */

export interface Tip { id: string; title: string; why: string; source?: string; priority: number }
export interface Guidance {
  l1: Tip[];                        // ranked, top 5
  l2: { nutrient: string; why: string; note: string }[];
  l3: { what: string; why: string }[];
  disclaimer: string;
}

export const GUIDANCE_DISCLAIMER = "คำแนะนำนี้เป็นแนวทางเชิงป้องกันจากค่าที่วัดได้ ไม่ใช่การวินิจฉัย · วิตามินและอาหารเสริมทุกชนิดให้เภสัชกรหรือโค้ชกำหนดชนิดและปริมาณหลังดูผลเลือดและยาที่ใช้อยู่ · ค่าที่ผิดปกติมากควรให้แพทย์ตรวจเพิ่ม";

export function guidance(i: RevealInput, a: RevealAssessment, q: Quiz): Guidance {
  const lv = (k: MetricKey) => a.metrics.find((m) => m.key === k)?.level ?? null;
  const bad = (l: StatusLevel | null) => l != null && RANK[l] >= RANK.warning;
  const meh = (l: StatusLevel | null) => l != null && RANK[l] >= RANK.caution;
  const fatHigh = bad(lv("fat_pct")), visHigh = meh(lv("visceral")), musLow = bad(lv("muscle_pct")), bmiHigh = meh(lv("bmi"));
  const tips: Tip[] = [];
  const push = (t: Omit<Tip, "priority">, p: number) => tips.push({ ...t, priority: p });

  // L1 — the Top-10 lifestyle biohacks, weighted by this person's numbers and answers
  push({ id: "fiber_first", title: "กินผักก่อนแป้ง (Fiber First)", why: fatHigh || visHigh ? "ไขมัน/ไขมันช่องท้องของคุณสูงกว่าเกณฑ์ — ลำดับการกินช่วยให้น้ำตาลหลังมื้อขึ้นน้อยลง" : "ช่วยคุมน้ำตาลหลังมื้อโดยไม่ต้องเปลี่ยนเมนู", source: "Frontiers in Endocrinology 2020" }, (fatHigh ? 3 : 1) + (visHigh ? 2 : 0) + (q.veg_first === false ? 2 : 0));
  push({ id: "walk_after", title: "เดิน 2–10 นาทีหลังมื้อ", why: visHigh ? "ไขมันช่องท้องตอบสนองต่อการขยับหลังกินดีที่สุด" : "ลดน้ำตาลหลังมื้อและช่วยเผาผลาญ", source: "Sports Medicine 2022" }, (visHigh ? 3 : 1) + (q.steps === "lt5k" ? 2 : 0));
  push({ id: "water_before", title: "น้ำเปล่า 500 ml ก่อนมื้อ", why: "กินน้อยลงโดยไม่ต้องอด — มีผลชัดกับคนที่ไขมันสูงกว่าเกณฑ์", source: "Mayo Clinic" }, fatHigh ? 3 : 1);
  push({ id: "no_sugar_drink", title: "เปลี่ยนเครื่องดื่มหวานเป็นน้ำ/ชาไม่หวาน", why: "น้ำตาลจากเครื่องดื่มไปเป็นไขมันช่องท้องได้ง่ายที่สุด" }, q.sugary_drinks === "daily" ? 6 : q.sugary_drinks === "some" ? 3 : visHigh ? 2 : 0);
  push({ id: "resistance", title: "ฝึกแรงต้าน 2 ครั้ง/สัปดาห์ (บอดี้เวทก็ได้)", why: musLow ? "กล้ามเนื้อของคุณต่ำกว่าเกณฑ์ — นี่คือสิ่งเดียวที่สร้างกล้ามเนื้อกลับมาได้" : "รักษากล้ามเนื้อไว้ตอนลดไขมัน ไม่งั้นน้ำหนักที่ลดคือกล้ามเนื้อ", source: "WHO 2020" }, musLow ? 5 : fatHigh ? 3 : 2);
  push({ id: "protein_each_meal", title: "โปรตีนทุกมื้อ ประมาณฝ่ามือ", why: musLow ? "กล้ามเนื้อสร้างไม่ได้ถ้าโปรตีนไม่พอ" : "อิ่มนาน รักษากล้ามเนื้อ", source: "PROT-AGE" }, musLow ? 4 : 2);
  push({ id: "rule_321", title: "กฎ 3-2-1 ก่อนนอน (3 ชม. ไม่กิน · 2 ไม่ดื่ม · 1 ไม่จอ)", why: "มื้อดึกเก็บเป็นไขมันช่องท้องง่าย และการนอนดีขึ้นทำให้หิวน้อยลงวันถัดไป" }, (q.sleep_h != null && q.sleep_h < 7 ? 3 : 1) + (visHigh ? 1 : 0));
  push({ id: "morning_sun", title: "แดดเช้า 10 นาที + ตื่นเวลาเดิม", why: "นาฬิการ่างกายนิ่ง → นอนหลับลึกขึ้น → ฮอร์โมนความหิวคุมง่ายขึ้น", source: "Huberman Lab" }, q.sleep_h != null && q.sleep_h < 7 ? 3 : 1);
  push({ id: "stairs", title: "บันไดแทนลิฟต์", why: "ขยับสะสมทั้งวันสำคัญกว่าออกกำลังหนักครั้งเดียว", source: "Atherosclerosis 2024" }, q.steps === "lt5k" ? 3 : bmiHigh ? 2 : 1);
  push({ id: "sigh", title: "หายใจแบบ Physiological Sigh ตอนเครียด", why: "ความเครียดสะสมสัมพันธ์กับไขมันช่องท้องและการกินตอนดึก", source: "Huberman Lab" }, q.stress === "high" ? 4 : q.stress === "mid" ? 2 : 0);
  push({ id: "phone_out", title: "มือถือออกจากห้องนอน", why: "การนอนคือฮอร์โมนคุมความหิวและซ่อมกล้ามเนื้อ" }, q.sleep_h != null && q.sleep_h < 6.5 ? 3 : 1);
  const l1 = tips.filter((t) => t.priority > 0).sort((x, y) => y.priority - x.priority).slice(0, 5);

  // L2 — foundation nutrients only (no product, no dose)
  const l2: Guidance["l2"] = [
    { nutrient: "วิตามินดี", why: "คนไทยในเมืองขาดบ่อยจากการเลี่ยงแดด เกี่ยวกับกล้ามเนื้อ กระดูก และภูมิคุ้มกัน", note: "ควรตรวจระดับในเลือดก่อน แล้วให้เภสัชกร/โค้ชกำหนดปริมาณ" },
  ];
  if (fatHigh || visHigh) l2.push({ nutrient: "โอเมก้า-3", why: "สัมพันธ์กับการอักเสบต่ำ ๆ ที่มากับไขมันช่องท้อง", note: "ปริมาณและความเหมาะกับยาที่ใช้อยู่ให้เภสัชกรดู" });
  if (musLow || fatHigh) l2.push({ nutrient: "โปรตีนเสริม (เมื่อกินจากอาหารไม่ถึง)", why: `เป้าโปรตีนของคุณอยู่ราว ${proteinRange(i.weight)?.low ?? "—"}–${proteinRange(i.weight)?.high ?? "—"} g/วัน — ถ้าจากอาหารไม่ถึง ค่อยเติม`, note: "เป็นอาหาร ไม่ใช่ยา แต่ให้โค้ชช่วยดูปริมาณให้พอดี" });
  l2.push({ nutrient: "แมกนีเซียม", why: "เกี่ยวกับการนอนและการทำงานของกล้ามเนื้อ", note: q.sleep_h != null && q.sleep_h < 7 ? "คุณตอบว่านอนน้อยกว่า 7 ชม. — ถามเภสัชกรว่าเหมาะไหม" : "พิจารณาเมื่อมีปัญหานอนหรือตะคริว — ถามเภสัชกรก่อน" });

  // L3 — what to measure next, from these numbers
  const l3: Guidance["l3"] = [{ what: "ชั่ง BCA ซ้ำทุก 4 สัปดาห์ เวลาเดิม", why: "ดูว่าน้ำหนักที่เปลี่ยนคือไขมันหรือกล้ามเนื้อ" }];
  if (fatHigh || visHigh || bmiHigh) l3.push({ what: "HbA1c + น้ำตาลอดอาหาร", why: "ไขมันช่องท้องสูงมักมาพร้อมน้ำตาลที่เริ่มคุมยาก — รู้ก่อนดีกว่า" }, { what: "ไขมันในเลือด (LDL · HDL · ไตรกลีเซอไรด์)", why: "ไตรกลีเซอไรด์ตอบสนองต่อไขมันช่องท้องและน้ำตาลโดยตรง" });
  if (visHigh && (lv("visceral") === "warning" || lv("visceral") === "danger")) l3.push({ what: "ALT (ค่าตับ)", why: "ไขมันช่องท้องระดับสูงมักมาพร้อมไขมันพอกตับ" });
  l3.push({ what: "วิตามินดีในเลือด", why: "ก่อนเสริมต้องรู้ว่าขาดจริงไหม" });
  if (fatHigh || visHigh) l3.push({ what: "hs-CRP (การอักเสบ)", why: "ตัวเลขที่ลดตามไขมันช่องท้อง — ใช้ดูว่าแนวทางได้ผล" });

  return { l1, l2, l3, disclaimer: GUIDANCE_DISCLAIMER };
}
