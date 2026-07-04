/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const fmt = (n, d = 0) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const STATUS = {
  good: { label: "เกณฑ์ดี", fg: "var(--good)", bg: "var(--good-bg)" },
  warn: { label: "เฝ้าระวัง", fg: "var(--warn)", bg: "var(--warn-bg)" },
  risk: { label: "ควรใส่ใจ", fg: "var(--risk)", bg: "var(--risk-bg)" },
};

/* ------------------------------------------------------------------ */
/* tool #1 — general screening (BMI / BMR / TDEE …)                    */
/* ------------------------------------------------------------------ */
export const ACTIVITIES = [
  { f: 1.2, name: "แทบไม่ออกกำลังกาย", desc: "นั่งทำงานเป็นหลัก แทบไม่ได้ขยับ" },
  { f: 1.375, name: "ขยับบ้างเล็กน้อย", desc: "ออกกำลังเบา ๆ 1–3 วัน/สัปดาห์" },
  { f: 1.55, name: "ออกกำลังสม่ำเสมอ", desc: "3–5 วัน/สัปดาห์" },
  { f: 1.725, name: "ออกกำลังหนัก", desc: "เกือบทุกวัน 6–7 วัน/สัปดาห์" },
  { f: 1.9, name: "หนักมาก / นักกีฬา", desc: "ซ้อมวันละ 2 รอบ หรืองานใช้แรงกาย" },
];
export const GOALS = [
  { id: "lose", name: "ลดไขมัน", desc: "ลดน้ำหนักแบบรักษากล้ามเนื้อ" },
  { id: "fit", name: "สุขภาพดี คงน้ำหนัก", desc: "กินให้พอดีกับที่ใช้" },
  { id: "gain", name: "เพิ่มกล้ามเนื้อ", desc: "สร้างกล้ามแบบไขมันไม่พุ่ง" },
];

export function bmiInfo(bmi) {
  if (bmi < 18.5)
    return { cat: "น้ำหนักน้อยกว่าเกณฑ์", status: "warn", advice: "เพิ่มพลังงานและโปรตีนให้พอ ร่วมกับเวทเทรนนิ่งเบา ๆ เพื่อสร้างมวลกล้ามเนื้อ" };
  if (bmi < 23)
    return { cat: "สมส่วน", status: "good", advice: "รักษาน้ำหนักช่วงนี้ไว้ — กินพอดี ขยับสม่ำเสมอ" };
  if (bmi < 25)
    return { cat: "น้ำหนักเกิน (ท้วม)", status: "warn", advice: "ลดเบา ๆ 0.25–0.5 กก./สัปดาห์ ก็เห็นผลชัดใน 2–3 เดือน" };
  if (bmi < 30)
    return { cat: "อ้วนระดับ 1", status: "risk", advice: "ลด 5–10% ของน้ำหนักตัว ช่วยลดความเสี่ยงเบาหวาน–ความดันได้มาก" };
  return { cat: "อ้วนระดับ 2", status: "risk", advice: "แนะนำปรึกษาแพทย์หรือนักกำหนดอาหาร เพื่อวางแผนลดน้ำหนักอย่างปลอดภัย" };
}

export function whtrInfo(r, sex, waist) {
  const cut = sex === "m" ? 90 : 80;
  const over = waist >= cut;
  if (r < 0.5)
    return {
      cat: "สัดส่วนดี", status: over ? "warn" : "good",
      advice: over
        ? `รอบเอวเกิน ${cut} ซม. ซึ่งเป็นเกณฑ์อ้วนลงพุงของคนไทย ควรเริ่มคุมอาหาร`
        : "รอบเอวน้อยกว่าครึ่งหนึ่งของส่วนสูง — เกณฑ์ที่ดีของไขมันช่องท้อง",
    };
  if (r < 0.6)
    return { cat: "เริ่มเสี่ยงอ้วนลงพุง", status: "warn", advice: "ไขมันช่องท้องเริ่มสะสม — ลดของหวาน/แอลกอฮอล์ เพิ่มเดินเร็ววันละ 30 นาที" };
  return { cat: "เสี่ยงอ้วนลงพุงสูง", status: "risk", advice: "สัมพันธ์กับเบาหวาน ไขมันพอกตับ ความดัน — ควรตรวจสุขภาพประจำปีและปรับพฤติกรรมจริงจัง" };
}

export function bodyFatInfo(bf, sex) {
  const [lo, hi] = sex === "m" ? [10, 20] : [18, 28];
  if (bf < lo) return { status: "warn", note: `ต่ำกว่าช่วงอ้างอิงทั่วไป (${lo}–${hi}%)` };
  if (bf <= hi) return { status: "good", note: `อยู่ในช่วงอ้างอิงทั่วไป (${lo}–${hi}%)` };
  return { status: bf > hi + 7 ? "risk" : "warn", note: `สูงกว่าช่วงอ้างอิงทั่วไป (${lo}–${hi}%)` };
}

export function screening({ sex, age, height, weight, waist, act, goal }) {
  const h2 = (height / 100) ** 2;
  const bmi = weight / h2;
  const bmr = sex === "m"
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
  const tdee = bmr * ACTIVITIES[act].f;
  const floor = sex === "m" ? 1500 : 1200;
  const kcalLose = Math.max(tdee - 500, floor);
  const kcalGain = tdee + 300;
  let protein;
  if (goal === "lose") protein = [1.6, 2.0];
  else if (goal === "gain") protein = [1.6, 2.2];
  else protein = act <= 1 ? [1.0, 1.2] : [1.2, 1.6];
  const water = weight * 33;
  const bodyFat = 1.2 * bmi + 0.23 * age - 10.8 * (sex === "m" ? 1 : 0) - 5.4;
  const idealLo = 18.5 * h2, idealHi = 22.9 * h2;
  const hrMax = 208 - 0.7 * age;
  return {
    bmi, bmr, tdee, kcalLose, kcalGain, protein,
    pLo: protein[0] * weight, pHi: protein[1] * weight,
    water, bodyFat, idealLo, idealHi, hrMax,
    zone2: [hrMax * 0.6, hrMax * 0.7],
    whtr: waist ? waist / height : null,
  };
}

/* ------------------------------------------------------------------ */
/* tool #5 — Framingham 2008 heart age (office / BMI model)           */
/* D'Agostino RB Sr, et al. Circulation 2008;117:743-753 (Table 6).   */
/* ------------------------------------------------------------------ */
const FRAM = {
  m: { lnAge: 3.11296, lnBMI: 0.79277, lnSBPu: 1.85508, lnSBPt: 1.92672, smoke: 0.70953, dm: 0.5316, S0: 0.88431, mean: 23.9388 },
  f: { lnAge: 2.72107, lnBMI: 0.51125, lnSBPu: 2.81291, lnSBPt: 2.88267, smoke: 0.61868, dm: 0.77763, S0: 0.94833, mean: 26.0145 },
};
/* representative SBP for people who don't have a cuff reading */
export const SBP_BANDS = [
  { id: "normal", name: "ปกติ", desc: "ตัวบน ~120 หรือหมอไม่เคยบอกว่าสูง", sbp: 120 },
  { id: "elevated", name: "เริ่มสูง", desc: "ตัวบน ~130–139", sbp: 132 },
  { id: "high1", name: "สูง", desc: "ตัวบน ~140–159 / กินยาความดันอยู่", sbp: 148 },
  { id: "high2", name: "สูงมาก", desc: "ตัวบน 160 ขึ้นไป", sbp: 165 },
  { id: "unknown", name: "ไม่ทราบ", desc: "ไม่เคยวัด — ระบบจะสมมติว่าปกติ", sbp: 120 },
];

function framRisk(sex, age, bmi, sbp, treated, smoke, dm) {
  const c = FRAM[sex];
  const L =
    c.lnAge * Math.log(age) +
    c.lnBMI * Math.log(bmi) +
    (treated ? c.lnSBPt : c.lnSBPu) * Math.log(sbp) +
    c.smoke * (smoke ? 1 : 0) +
    c.dm * (dm ? 1 : 0);
  return { risk: 1 - Math.pow(c.S0, Math.exp(L - c.mean)), L };
}

/* reference "healthy" profile → heart age is the age at which a person with
   this profile carries the same 10-yr risk. Non-smoker, non-diabetic,
   untreated SBP 125, BMI 22.5. */
const REF = { sbp: 125, bmi: 22.5 };

export function heartAge({ sex, age, bmi, sbpBand, treated, smoke, dm }) {
  const band = SBP_BANDS.find((b) => b.id === sbpBand) || SBP_BANDS[0];
  const a = clamp(age, 30, 74); /* Framingham validated range */
  const { risk } = framRisk(sex, a, bmi, band.sbp, treated, smoke, dm);
  const c = FRAM[sex];

  /* invert on age with the reference profile */
  const K = c.lnBMI * Math.log(REF.bmi) + c.lnSBPu * Math.log(REF.sbp); /* smoke=dm=0 */
  const clampedRisk = clamp(risk, 0.0001, 0.9);
  const lnAgeHeart = (c.mean + Math.log(Math.log(1 - clampedRisk) / Math.log(c.S0)) - K) / c.lnAge;
  const hAge = clamp(Math.round(Math.exp(lnAgeHeart)), 20, 90);

  const pct = risk * 100;
  let status, cat;
  if (pct < 10) { status = "good"; cat = "ความเสี่ยงต่ำ"; }
  else if (pct < 20) { status = "warn"; cat = "ความเสี่ยงปานกลาง"; }
  else if (pct < 30) { status = "risk"; cat = "ความเสี่ยงสูง"; }
  else { status = "risk"; cat = "ความเสี่ยงสูงมาก"; }

  const gap = hAge - Math.round(age);
  return { risk: pct, heartAge: hAge, realAge: Math.round(age), gap, status, cat, sbp: band.sbp };
}

/* ------------------------------------------------------------------ */
/* tool #6 — Thai Diabetes Risk Score (Aekplakorn, Diabetes Care 2006) */
/* simple non-lab model, 0–17 points, 12-year incidence.              */
/* ------------------------------------------------------------------ */
export function diabetesScore({ sex, age, bmi, waist, hypertension, family }) {
  let s = 0;
  const parts = [];
  /* age */
  let ap = age >= 50 ? 2 : age >= 45 ? 1 : 0;
  s += ap; parts.push({ k: "อายุ", v: ap, of: 2, txt: age >= 50 ? "50 ปีขึ้นไป" : age >= 45 ? "45–49 ปี" : "ต่ำกว่า 45 ปี" });
  /* sex */
  const sp = sex === "m" ? 2 : 0;
  s += sp; parts.push({ k: "เพศ", v: sp, of: 2, txt: sex === "m" ? "ชาย" : "หญิง" });
  /* BMI */
  let bp = bmi >= 27.5 ? 5 : bmi >= 23 ? 3 : 0;
  s += bp; parts.push({ k: "ดัชนีมวลกาย", v: bp, of: 5, txt: bmi >= 27.5 ? "27.5 ขึ้นไป" : bmi >= 23 ? "23–27.4" : "ต่ำกว่า 23" });
  /* waist */
  const cut = sex === "m" ? 90 : 80;
  const wp = waist >= cut ? 2 : 0;
  s += wp; parts.push({ k: "รอบเอว", v: wp, of: 2, txt: waist >= cut ? `เกิน ${cut} ซม.` : `ไม่เกิน ${cut} ซม.` });
  /* hypertension */
  const hp = hypertension ? 2 : 0;
  s += hp; parts.push({ k: "ความดันโลหิตสูง", v: hp, of: 2, txt: hypertension ? "มี" : "ไม่มี" });
  /* family history */
  const fp = family ? 4 : 0;
  s += fp; parts.push({ k: "ญาติสายตรงเป็นเบาหวาน", v: fp, of: 4, txt: family ? "มี" : "ไม่มี" });

  let cat, status, risk, advice;
  if (s <= 2) {
    cat = "เสี่ยงน้อย"; status = "good"; risk = "ประมาณ 1 ใน 20 (~5%)";
    advice = "เยี่ยมมาก — รักษาน้ำหนักและการกินแบบนี้ไว้ ตรวจน้ำตาลปีละครั้งก็พอ";
  } else if (s <= 5) {
    cat = "เสี่ยงปานกลาง"; status = "warn"; risk = "ประมาณ 1 ใน 12 (~8%)";
    advice = "เริ่มคุมของหวานและแป้งขัดสี ออกกำลังกาย 150 นาที/สัปดาห์ ตรวจน้ำตาลปีละครั้ง";
  } else if (s <= 8) {
    cat = "เสี่ยงสูง"; status = "risk"; risk = "ประมาณ 1 ใน 7 (11–20%)";
    advice = "ควรตรวจระดับน้ำตาลในเลือด (FBS) และลดน้ำหนัก 5–7% จะลดความเสี่ยงได้มาก";
  } else if (s <= 10) {
    cat = "เสี่ยงสูงมาก"; status = "risk"; risk = "ประมาณ 1 ใน 4 (~25%)";
    advice = "แนะนำพบแพทย์เพื่อตรวจคัดกรองเบาหวาน และวางแผนปรับพฤติกรรมอย่างจริงจัง";
  } else {
    cat = "เสี่ยงสูงมากที่สุด"; status = "risk"; risk = "ประมาณ 1 ใน 3 (>30%)";
    advice = "ควรพบแพทย์เพื่อตรวจเบาหวานโดยเร็ว ยิ่งเริ่มดูแลเร็วยิ่งป้องกันได้";
  }
  return { score: s, max: 17, cat, status, risk, advice, parts };
}

/* ------------------------------------------------------------------ */
/* tool #2 — hearing-age mapping (for-fun, informal)                  */
/* ------------------------------------------------------------------ */
export const HEARING_FREQS = [8000, 10000, 12000, 14000, 15000, 16000, 17000, 18000, 19000, 20000];

export function hearingAge(maxHeardHz) {
  /* informal chart: highest frequency you can hear ≈ younger ears */
  const table = [
    { hz: 20000, age: "ต่ำกว่า 20 ปี", note: "หูคมมาก! ได้ยินความถี่ที่ผู้ใหญ่ส่วนมากไม่ได้ยินแล้ว" },
    { hz: 19000, age: "ประมาณ 20–24 ปี", note: "การได้ยินความถี่สูงยังดีเยี่ยม" },
    { hz: 18000, age: "ประมาณ 25–29 ปี", note: "อยู่ในเกณฑ์ดีของวัยหนุ่มสาว" },
    { hz: 17000, age: "ประมาณ 30–39 ปี", note: "ปกติสำหรับวัยทำงาน" },
    { hz: 16000, age: "ประมาณ 40–49 ปี", note: "ความถี่สูงเริ่มลดตามวัยตามธรรมชาติ" },
    { hz: 15000, age: "ประมาณ 50–59 ปี", note: "เป็นเรื่องปกติเมื่ออายุมากขึ้น" },
    { hz: 14000, age: "ประมาณ 60 ปีขึ้นไป", note: "ลองทำในที่เงียบและใช้หูฟังอีกครั้ง" },
    { hz: 12000, age: "60 ปีขึ้นไป", note: "หากยังต่ำกว่านี้ ลองปรึกษาผู้เชี่ยวชาญด้านการได้ยิน" },
  ];
  if (!maxHeardHz) return { age: "ยังไม่ได้ทดสอบ", note: "", status: "warn" };
  const hit = table.find((t) => maxHeardHz >= t.hz) || table[table.length - 1];
  const status = maxHeardHz >= 16000 ? "good" : maxHeardHz >= 14000 ? "warn" : "risk";
  return { ...hit, status, hz: maxHeardHz };
}
