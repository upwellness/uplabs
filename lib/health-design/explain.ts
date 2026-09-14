/**
 * "ให้ AI อธิบาย" for the customer portal (SPEC-Mobile-Portal.md §5.1 L3, R4).
 *
 * The model never sees raw data and never grades anything. It receives ONE metric (or
 * one domain, or the 7-domain overview) exactly as the assessment engine already
 * judged it — value, unit, level label, cut-point source, percentile, the confirmed
 * plan's actions — and rephrases that into three fixed answers in plain Thai.
 *
 * Two hard checks run on the answer before it reaches a customer:
 *   1. every number in the answer must appear in the input (no invented figures)
 *   2. no diagnosis / treatment / product / dose vocabulary (same family as UP CGM Analyser)
 * A reply that fails either is discarded and the customer sees the engine's own words.
 *
 * Pure: prompt in, checks out. The route (app/api/my/[token]/explain) does I/O.
 */
import type { HealthAssessment, Driver, DomainKey, Level } from "./assess";
import { DOMAIN_LABEL_TH } from "./assess";
import type { HealthPlan } from "./plan";
import { bandsFor, explain as glossaryOf } from "./glossary";

export type ExplainTarget = { kind: "metric"; domain: DomainKey; metric: string } | { kind: "domain"; domain: DomainKey } | { kind: "overview" };

export interface ExplainFacts {
  title: string;
  /** lines handed to the model verbatim — the only facts it may use */
  facts: string[];
  /** actions from the confirmed plan relevant to this target (may be empty) */
  actions: string[];
  /** numbers that appear in the facts/actions — the allowed set for the answer */
  numbers: string[];
}

const CLINICAL = new Set<DomainKey>(["metabolic", "cardio_lipid", "liver_kidney"]);
export const levelLabelTh = (domain: DomainKey, level: Level | null): string =>
  level == null ? "ยังไม่มีเกณฑ์ตัดสิน (ใช้ดูแนวโน้ม)" : level === "good" ? "อยู่ในเกณฑ์ดี" : level === "watch" ? "ควรติดตาม" : CLINICAL.has(domain) ? "อยู่ในช่วงที่ควรปรึกษาแพทย์" : "อยู่ในช่วงที่ต้องดูแลจริงจัง";

const numsIn = (s: string): string[] => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));

function driverFacts(domain: DomainKey, d: Driver, gender: "male" | "female" | null): string[] {
  const g = glossaryOf(d.metric);
  const out = [
    `ค่า: ${d.label_th} = ${d.value}${d.unit ? ` ${d.unit}` : ""}${d.recorded_at ? ` (วัดเมื่อ ${String(d.recorded_at).slice(0, 10)})` : ""}`,
    `ระบบจัดว่า: ${levelLabelTh(domain, d.level)}`,
  ];
  if (g) out.push(`ค่านี้คือ: ${g.what_th}`, `เกณฑ์จาก: ${g.source}`);
  const bands = bandsFor(d.metric, gender);
  if (bands) out.push(`ช่วงตามเกณฑ์: ${bands.map((b, i) => `${b.label_th}${b.to != null ? ` <${b.to}` : i ? ` ≥${bands[i - 1].to}` : ""}`).join(" · ")}`);
  if (d.reference) out.push(`เทียบประชากร: สูงกว่า ${d.reference.percentile}% ของ${d.reference.band} (${d.reference.source}) — เป็นตำแหน่ง ไม่ใช่คำตัดสิน`);
  if (d.note) out.push(`หมายเหตุจากระบบ: ${d.note}`);
  return out;
}

function planActions(plan: HealthPlan | null, domain?: DomainKey): string[] {
  if (!plan) return [];
  const out: string[] = [];
  for (const g of plan.goals_90d) if (!domain || g.domain === domain) out.push(`เป้า 90 วัน: ${g.target}`);
  for (const l of plan.lifestyle) out.push(`ไลฟ์สไตล์: ${l.target}`);
  for (const r of plan.retest) out.push(`ตรวจซ้ำ: ${r.what} ภายใน ${r.when_days} วัน`);
  return out.slice(0, 6);
}

export function buildFacts(target: ExplainTarget, a: HealthAssessment, plan: HealthPlan | null, gender: "male" | "female" | null): ExplainFacts | { error: string } {
  if (target.kind === "overview") {
    const facts = (Object.keys(DOMAIN_LABEL_TH) as DomainKey[]).map((k) => {
      const level = k === "health_age" ? a.domains.health_age.level : a.domains[k].level;
      const extra = k === "health_age" && a.domains.health_age.phenoage != null ? ` (${a.domains.health_age.phenoage} ปี เทียบอายุจริง ${a.domains.health_age.chrono_age})` : "";
      return `${DOMAIN_LABEL_TH[k]}: ${level == null && !extra ? "ยังไม่มีข้อมูล" : levelLabelTh(k, level)}${extra}`;
    });
    if (a.priorities.length) facts.push(`สิ่งที่ระบบให้ใส่ใจก่อน: ${a.priorities.map((p) => `${p.rank}. ${p.why}`).join(" · ")}`);
    const actions = planActions(plan);
    return { title: "ภาพรวมสุขภาพ 7 ด้าน", facts, actions, numbers: [...new Set([...facts, ...actions].flatMap(numsIn))] };
  }
  if (target.kind === "domain") {
    if (target.domain === "health_age") {
      const h = a.domains.health_age;
      if (h.phenoage == null) return { error: "ยังคำนวณอายุสุขภาพไม่ได้" };
      const facts = [`อายุสุขภาพ (PhenoAge) = ${h.phenoage} ปี · อายุจริง ${h.chrono_age} ปี · ต่างกัน ${h.delta} ปี`, `ระบบจัดว่า: ${levelLabelTh("health_age", h.level)}`, ...h.caveats.map((c) => `หมายเหตุ: ${c}`)];
      const actions = planActions(plan);
      return { title: "อายุสุขภาพ", facts, actions, numbers: [...new Set([...facts, ...actions].flatMap(numsIn))] };
    }
    const dom = a.domains[target.domain];
    if (!dom.drivers.length) return { error: "ด้านนี้ยังไม่มีข้อมูล" };
    const facts = [`ด้าน: ${DOMAIN_LABEL_TH[target.domain]} — ระบบจัดว่า ${levelLabelTh(target.domain, dom.level)}`, ...dom.drivers.flatMap((d) => driverFacts(target.domain, d, gender)), ...dom.caveats.map((c) => `หมายเหตุ: ${c}`)];
    const actions = planActions(plan, target.domain);
    return { title: DOMAIN_LABEL_TH[target.domain], facts, actions, numbers: [...new Set([...facts, ...actions].flatMap(numsIn))] };
  }
  if (target.domain === "health_age") return { error: "ใช้ domain สำหรับอายุสุขภาพ" };
  const d = a.domains[target.domain].drivers.find((x) => x.metric === target.metric);
  if (!d) return { error: "ไม่พบค่านี้ในผลประเมินล่าสุด" };
  const facts = driverFacts(target.domain, d, gender);
  const actions = planActions(plan, target.domain);
  return { title: d.label_th, facts, actions, numbers: [...new Set([...facts, ...actions].flatMap(numsIn))] };
}

export const SYSTEM_PROMPT = `คุณคือผู้ช่วยของโค้ชสุขภาพ UP Wellness หน้าที่คือ "เรียบเรียง" ข้อเท็จจริงที่ระบบตัดสินไว้แล้วให้ลูกค้าอ่านเข้าใจ ไม่ใช่ประเมินเอง
กฎที่ห้ามละเมิด:
1. ใช้เฉพาะตัวเลขและคำตัดสิน (ดี/ควรติดตาม/ควรปรึกษาแพทย์/ต้องดูแลจริงจัง) ที่อยู่ในข้อเท็จจริงเท่านั้น ห้ามคิดตัวเลขใหม่ ห้ามเปลี่ยนระดับ
2. ห้ามวินิจฉัยโรค ห้ามบอกว่า "เป็น" โรคใด ห้ามพูดถึงยา ขนาดยา การรักษา หรือชื่อสินค้า/อาหารเสริมใด ๆ
3. ถ้าระบบจัดว่า "ควรปรึกษาแพทย์" ให้พูดตรง ๆ ว่าควรให้แพทย์ดู ห้ามลดทอน
4. ส่วน "ทำอะไรได้" ใช้เฉพาะรายการจากแผนที่โค้ชยืนยันแล้ว ถ้าไม่มีให้บอกว่า "รอโค้ชวางแผน"
5. ภาษาไทยเป็นกันเอง ประโยคสั้น ไม่ขู่ ไม่โฆษณา ไม่ขึ้นต้นด้วยคำทักทาย
ตอบเป็น JSON เท่านั้น: {"what":"…","where":"…","action":"…"} แต่ละช่องไม่เกิน 2 ประโยค`;

export function buildPrompt(f: ExplainFacts): string {
  return `# หัวข้อ\n${f.title}\n\n# ข้อเท็จจริงที่ระบบตัดสินแล้ว (ใช้ได้เฉพาะนี้)\n${f.facts.map((x) => `- ${x}`).join("\n")}\n\n# แผนที่โค้ชยืนยันแล้ว\n${f.actions.length ? f.actions.map((x) => `- ${x}`).join("\n") : "- (ยังไม่มีแผน)"}\n\n# งาน\nตอบ 3 ช่อง: what = ค่านี้คืออะไร · where = ของลูกค้าอยู่ตรงไหน (ต้องระบุคำตัดสินของระบบให้ตรง) · action = ทำอะไรได้จากแผน`;
}

export interface ExplainAnswer { what: string; where: string; action: string }

const BANNED = /วินิจฉัย|เป็นโรค|เป็นเบาหวาน|เป็นไต|เป็นตับ|เป็นมะเร็ง|รักษา|ยา\s|กินยา|มิลลิกรัม|\bmg\b(?!\/dL)|Nutrilite|นิวทริไลท์|Double\s?X|Amway|แอมเวย์|โปรตีนเชค|ซื้อ|ราคา|โปรโมชั่น|การันตี|หายขาด/i;

/** Both checks; returns the reason when the answer must be discarded. */
export function validateAnswer(ans: unknown, allowedNumbers: string[]): { ok: true; answer: ExplainAnswer } | { ok: false; reason: string } {
  const o = (ans ?? {}) as Partial<ExplainAnswer>;
  if (typeof o.what !== "string" || typeof o.where !== "string" || typeof o.action !== "string") return { ok: false, reason: "รูปแบบคำตอบไม่ครบ 3 ช่อง" };
  const text = `${o.what}\n${o.where}\n${o.action}`;
  if (text.length > 1200) return { ok: false, reason: "คำตอบยาวเกิน" };
  const allowed = new Set(allowedNumbers.map((n) => n.replace(/\.0+$/, "")));
  for (const n of numsIn(text)) {
    const k = n.replace(/\.0+$/, "");
    // "3 ข้อ", "2 ประโยค"-style small counts are fine; any figure ≥10 or with a decimal must come from the facts
    if (!allowed.has(k) && (k.includes(".") || Number(k) >= 10)) return { ok: false, reason: `มีตัวเลขที่ไม่อยู่ในข้อมูลต้นทาง: ${n}` };
  }
  const hit = text.match(BANNED);
  if (hit) return { ok: false, reason: `มีคำที่ห้ามใช้: "${hit[0].trim()}"` };
  return { ok: true, answer: { what: o.what.trim(), where: o.where.trim(), action: o.action.trim() } };
}

/** What the customer sees when the model's answer is discarded — the engine's own words, no AI. */
export function fallbackAnswer(f: ExplainFacts): ExplainAnswer {
  const what = f.facts.find((x) => x.startsWith("ค่านี้คือ: "))?.slice(10) ?? f.facts[0] ?? "";
  const where = f.facts.find((x) => x.startsWith("ระบบจัดว่า: "))?.slice(12) ?? f.facts.find((x) => x.startsWith("ด้าน: "))?.slice(6) ?? "";
  const action = f.actions.length ? f.actions.map((x) => x.replace(/^[^:]+: /, "")).join(" · ") : "รอโค้ชวางแผน";
  return { what, where, action };
}

export const EXPLAIN_DISCLAIMER = "ข้อความนี้เรียบเรียงจากค่าที่ระบบประเมินไว้แล้ว ใช้เพื่อการดูแลเชิงป้องกัน ไม่ใช่การวินิจฉัย · ค่าที่ควรปรึกษาแพทย์ ให้แพทย์เป็นผู้สรุป";
