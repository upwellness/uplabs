/**
 * Natural-language command → intent + parameters, WITHOUT an LLM.
 *
 * Why rules and not a model (docs/SPEC-External-API.md §5): the caller already has
 * an LLM. Ours would only add cost, a second thing to keep alive when Google retires
 * a model, and — the part that actually matters for health data — a component that
 * can invent a number. Everything this file returns is a lookup key; the values come
 * out of Postgres untouched.
 *
 * Pure by design: no imports from the DB layer, no I/O. That is what makes the whole
 * "did it understand the question" surface testable without a database.
 *
 * ── Risk split, deliberate ──────────────────────────────────────────────────
 * Guessing the INTENT wrong is cheap: the response echoes `understood_as` and the
 * caller can re-ask with an explicit intent. So we pick the best match and report
 * confidence.
 * Guessing the CUSTOMER wrong means sending one person's health data to a question
 * about someone else. So this file only ever *extracts a name to search for* — it
 * never decides who that is. The route resolves it and refuses on ambiguity.
 */
import type { Scope } from "./scopes";

export interface IntentDef {
  intent: string;
  scope: Scope;
  needsCustomer: boolean;
  /** Thai is written without spaces, so these are substring probes, not word tokens. */
  keywords: { k: string; w: number }[];
  describe: (p: Record<string, any>, name?: string) => string;
}

const who = (name?: string) => (name ? `ของ ${name}` : "");

export const INTENTS: IntentDef[] = [
  {
    intent: "labs.compare",
    scope: "labs:read",
    needsCustomer: true,
    keywords: [
      { k: "เทียบ", w: 3 }, { k: "เปรียบเทียบ", w: 3 }, { k: "compare", w: 3 },
      { k: "ย้อนหลัง", w: 2 }, { k: "แนวโน้ม", w: 2 }, { k: "trend", w: 2 },
      { k: "รอบ", w: 1.5 }, { k: "ครั้ง", w: 1 }, { k: "history", w: 2 },
      { k: "แล็บ", w: 1.5 }, { k: "แลป", w: 1.5 }, { k: "lab", w: 1.5 },
      { k: "ผลเลือด", w: 1.5 }, { k: "ผลตรวจ", w: 1.5 },
    ],
    describe: (p, n) => `เทียบผลแล็บ ${p.rounds} รอบล่าสุด ${who(n)}`.trim(),
  },
  {
    intent: "labs.abnormal",
    scope: "labs:read",
    needsCustomer: true,
    keywords: [
      { k: "ผิดปกติ", w: 4 }, { k: "abnormal", w: 4 }, { k: "ค่าที่ผิด", w: 3 },
      { k: "ธงแดง", w: 3 }, { k: "out of range", w: 3 }, { k: "flag", w: 2 },
      { k: "น่าห่วง", w: 2 }, { k: "ต้องระวัง", w: 2 },
    ],
    describe: (_p, n) => `ค่าแล็บที่ผิดปกติ ${who(n)}`.trim(),
  },
  {
    intent: "overview.longevity",
    scope: "labs:read",
    needsCustomer: true,
    keywords: [
      { k: "ภาพรวม", w: 4 }, { k: "overview", w: 4 }, { k: "longevity", w: 3 },
      { k: "ทุก factor", w: 3 }, { k: "ทุกแฟกเตอร์", w: 3 }, { k: "ทุกด้าน", w: 3 },
      { k: "สรุปสุขภาพ", w: 3 }, { k: "วิเคราะห์", w: 1.5 }, { k: "summary", w: 2 },
      { k: "สถานะเป็นยังไง", w: 3 },
      // NOTE: a bare "เป็นยังไงบ้าง" was here and matched "วันนี้อากาศเป็นยังไงบ้าง".
      // Generic question openers must not route on their own — see tests/api-resolver.

    ],
    describe: (_p, n) => `ภาพรวมสุขภาพทุกด้าน ${who(n)}`.trim(),
  },
  {
    intent: "labs.metric",
    scope: "labs:read",
    needsCustomer: true,
    keywords: [
      { k: "ค่า", w: 1 }, { k: "value", w: 1 }, { k: "metric", w: 2 },
    ],
    describe: (p, n) => `ค่า ${p.metric} ทุกครั้ง ${who(n)}`.trim(),
  },
  {
    intent: "labs.latest",
    scope: "labs:read",
    needsCustomer: true,
    keywords: [
      { k: "ผลแล็บ", w: 3 }, { k: "ผลเลือด", w: 3 }, { k: "ผลตรวจ", w: 3 },
      { k: "lab result", w: 3 }, { k: "labs", w: 2 }, { k: "ล่าสุด", w: 2 },
      { k: "latest", w: 2 }, { k: "เลือด", w: 1 },
    ],
    describe: (_p, n) => `ผลแล็บครั้งล่าสุด ${who(n)}`.trim(),
  },
  {
    intent: "measurements.list",
    scope: "measurements:read",
    needsCustomer: true,
    keywords: [
      { k: "bca", w: 4 }, { k: "องค์ประกอบร่างกาย", w: 4 }, { k: "น้ำหนัก", w: 3 },
      { k: "มวลกล้าม", w: 3 }, { k: "ไขมันช่องท้อง", w: 3 }, { k: "body composition", w: 4 },
      { k: "weight", w: 2 }, { k: "เปอร์เซ็นต์ไขมัน", w: 3 }, { k: "body fat", w: 3 },
    ],
    describe: (_p, n) => `ค่าองค์ประกอบร่างกาย (BCA) ${who(n)}`.trim(),
  },
  {
    intent: "assessment.get",
    scope: "assessment:read",
    needsCustomer: true,
    keywords: [
      { k: "ประเมินสุขภาพ", w: 5 }, { k: "ผลประเมิน", w: 4 }, { k: "สุขภาพรวม", w: 4 }, { k: "สุขภาพโดยรวม", w: 4 },
      { k: "ควรทำอะไรก่อน", w: 4 }, { k: "health design", w: 5 }, { k: "assessment", w: 4 }, { k: "ทุกด้าน", w: 2 },
      { k: "จุดที่ต้องดูแล", w: 3 }, { k: "สรุปสุขภาพ", w: 3 },
    ],
    describe: (_p, n) => `ผลประเมินสุขภาพรวม 7 ด้าน (UP Health Design) ${who(n)}`.trim(),
  },
  {
    intent: "cgm.metrics",
    scope: "cgm:read",
    needsCustomer: true,
    keywords: [
      { k: "cgm", w: 4 }, { k: "น้ำตาลต่อเนื่อง", w: 4 }, { k: "tir", w: 4 }, { k: "time in range", w: 4 },
      { k: "ในเป้า", w: 3 }, { k: "กราฟน้ำตาล", w: 3 }, { k: "น้ำตาลแกว่ง", w: 3 }, { k: "cv", w: 2 },
      { k: "gmi", w: 3 }, { k: "น้ำตาลตก", w: 3 }, { k: "น้ำตาลต่ำ", w: 3 }, { k: "ottai", w: 4 },
      { k: "เซ็นเซอร์", w: 3 }, { k: "ติดเครื่อง", w: 3 }, { k: "glucose", w: 2 },
    ],
    describe: (_p, n) => `ตัวเลขสรุป CGM (TIR · TBR · CV · GMI) 14 วันล่าสุด ${who(n)}`.trim(),
  },
  {
    intent: "cgm.import",
    scope: "cgm:write",
    needsCustomer: true,
    keywords: [
      { k: "นำเข้า cgm", w: 6 }, { k: "ลงไฟล์ cgm", w: 6 }, { k: "ใส่ไฟล์ cgm", w: 6 }, { k: "อัปโหลด cgm", w: 6 },
      { k: "import cgm", w: 6 }, { k: "ไฟล์ ottai", w: 6 }, { k: "ลงข้อมูล cgm", w: 6 }, { k: "บันทึก cgm", w: 5 },
      { k: "เอาไฟล์", w: 3 }, { k: "ลงไฟล์", w: 3 }, { k: "นำเข้า", w: 2 },
    ],
    describe: (_p, n) => `นำเข้าไฟล์ CGM ${who(n)}`.trim(),
  },
  {
    intent: "supplements.list",
    scope: "supplements:read",
    needsCustomer: true,
    keywords: [
      { k: "อาหารเสริม", w: 4 }, { k: "supplement", w: 4 }, { k: "วิตามิน", w: 3 },
      { k: "nutrilite", w: 3 }, { k: "กินอะไรอยู่", w: 2 }, { k: "ทานอะไรอยู่", w: 2 },
    ],
    describe: (_p, n) => `รายการอาหารเสริมและความปลอดภัยคู่ยา ${who(n)}`.trim(),
  },
  {
    intent: "notes.add",
    scope: "notes:write",
    needsCustomer: true,
    keywords: [
      { k: "จดโน้ต", w: 5 }, { k: "เพิ่มโน้ต", w: 5 }, { k: "บันทึกว่า", w: 4 },
      { k: "add note", w: 5 }, { k: "จดไว้ว่า", w: 4 }, { k: "เขียนโน้ต", w: 4 },
    ],
    describe: (_p, n) => `เพิ่มโน้ตโค้ช ${who(n)}`.trim(),
  },
  {
    intent: "notes.list",
    scope: "notes:read",
    needsCustomer: true,
    keywords: [
      { k: "โน้ต", w: 4 }, { k: "note", w: 3 }, { k: "บันทึกโค้ช", w: 3 },
      { k: "coach note", w: 4 },
    ],
    describe: (_p, n) => `โน้ตโค้ช ${who(n)}`.trim(),
  },
  {
    intent: "customer.profile",
    scope: "customers:read",
    needsCustomer: true,
    keywords: [
      { k: "โปรไฟล์", w: 4 }, { k: "profile", w: 4 }, { k: "ข้อมูลทั่วไป", w: 3 },
      { k: "ข้อมูลของ", w: 2 }, { k: "รายละเอียดของ", w: 2 },
    ],
    describe: (_p, n) => `โปรไฟล์ ${who(n)}`.trim(),
  },
  {
    intent: "customer.find",
    scope: "customers:read",
    needsCustomer: false,
    keywords: [
      { k: "หาลูกค้า", w: 5 }, { k: "ค้นหา", w: 4 }, { k: "find customer", w: 5 },
      { k: "search", w: 3 }, { k: "ลูกค้าชื่อ", w: 4 }, { k: "มีลูกค้าชื่อ", w: 4 },
      { k: "รายชื่อลูกค้า", w: 4 }, { k: "list customer", w: 4 },
    ],
    describe: (p) => `ค้นหาลูกค้า "${p.q ?? ""}"`,
  },
  {
    intent: "links.invite",
    scope: "links:write",
    needsCustomer: false,
    keywords: [
      { k: "ลิงก์สมัคร", w: 5 }, { k: "ลิงค์สมัคร", w: 5 }, { k: "invite", w: 4 },
      { k: "ชวนสมาชิก", w: 4 }, { k: "signup link", w: 5 }, { k: "ขอลิงก์", w: 3 },
      { k: "ขอลิงค์", w: 3 }, { k: "สมัคร", w: 2 },
    ],
    describe: () => "ลิงก์สมัครสมาชิกใหม่",
  },
];

export const INTENT_NAMES = INTENTS.map((i) => i.intent);
export const findIntent = (name: string) => INTENTS.find((i) => i.intent === name) ?? null;

/** Lab metric synonyms → the `metric_key` actually stored in customer_lab_values. */
const METRICS: Record<string, string[]> = {
  hba1c: ["hba1c", "a1c", "น้ำตาลสะสม", "ฮีโมโกลบินเอวันซี"],
  fbs: ["fbs", "น้ำตาลอดอาหาร", "น้ำตาลในเลือด", "fasting glucose", "blood sugar"],
  eag: ["eag", "น้ำตาลเฉลี่ย", "average glucose"],
  cholesterol: ["cholesterol", "คอเลสเตอรอล", "โคเลสเตอรอล", "ไขมันรวม"],
  triglyceride: ["triglyceride", "ไตรกลีเซอไรด์", "ไตรกลีเซอร์ไรด์", " tg "],
  hdl: ["hdl", "ไขมันดี"],
  ldl: ["ldl", "ไขมันเลว", "ไขมันไม่ดี"],
  creatinine: ["creatinine", "ครีเอตินิน", "ครีอะตินิน"],
  egfr: ["egfr", "อีจีเอฟอาร์", "การทำงานของไต"],
  uric_acid: ["uric", "กรดยูริก", "ยูริก"],
  alt_sgpt: ["alt", "sgpt", "เอนไซม์ตับ"],
  ast_sgot: ["ast", "sgot"],
  hemoglobin: ["hemoglobin", "ฮีโมโกลบิน", " hb "],
  mcv: ["mcv", "ขนาดเม็ดเลือดแดง"],
  rdw: ["rdw"],
  wbc: ["wbc", "เม็ดเลือดขาว"],
  platelet: ["platelet", "เกล็ดเลือด"],
  albumin: ["albumin", "อัลบูมิน"],
  alp: ["alp", "อัลคาไลน์"],
  hs_crp: ["crp", "ค่าอักเสบ", "การอักเสบ"],
  tsh: ["tsh", "ไทรอยด์", "thyroid"],
};

const THAI_NUM: Record<string, number> = {
  หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** Words that are never part of a person's name. */
const STOPWORDS = [
  "ช่วย", "หน่อย", "ที", "ให้", "ขอ", "ดู", "ของ", "คนนี้", "คนนึง", "นี้", "นั้น",
  "ผล", "แล็บ", "แลป", "lab", "labs", "เลือด", "ตรวจ", "ย้อนหลัง", "รอบ", "ครั้ง",
  "เทียบ", "เปรียบเทียบ", "วิเคราะห์", "ภาพรวม", "สรุป", "ล่าสุด", "ทั้งหมด",
  "please", "show", "me", "the", "for", "of", "last", "compare", "get", "list",
  "ครับ", "ค่ะ", "คะ", "นะ", "จ้า", "ๆ", "และ", "กับ", "หรือ",
];

const norm = (s: string) =>
  s.toLowerCase().replace(/[“”"']/g, '"').replace(/\s+/g, " ").trim();

/** How many past rounds the caller asked for. Defaults to 3 — the common ask. */
export function extractRounds(q: string, fallback = 3): number {
  const s = norm(q);
  const digit = s.match(/(\d+)\s*(รอบ|ครั้ง|round|time|ใบ)/);
  if (digit) return clampRounds(+digit[1]);
  const back = s.match(/(?:ย้อนหลัง|last|past|recent)\s*(\d+)/);
  if (back) return clampRounds(+back[1]);
  for (const [word, n] of Object.entries(THAI_NUM)) {
    if (new RegExp(`${word}\\s*(รอบ|ครั้ง|round|ใบ)`).test(s)) return clampRounds(n);
  }
  return fallback;
}
const clampRounds = (n: number) => (Number.isFinite(n) ? Math.min(20, Math.max(1, Math.trunc(n))) : 3);

export function extractMetric(q: string): string | null {
  const s = ` ${norm(q)} `;
  let best: { key: string; len: number } | null = null;
  for (const [key, syns] of Object.entries(METRICS)) {
    for (const syn of syns) {
      if (s.includes(syn.trim().length <= 3 ? ` ${syn.trim()} ` : syn.trim())) {
        // longest synonym wins so "ไขมันดี" beats a bare "ไขมัน"
        if (!best || syn.length > best.len) best = { key, len: syn.length };
      }
    }
  }
  return best?.key ?? null;
}

/**
 * A name to search for — NOT a decision about who the person is.
 * Priority: quoted → after ของ/for/of → whatever survives keyword+stopword removal.
 */
export function extractNameQuery(q: string): string | null {
  const quoted = q.match(/"([^"]{2,40})"/);
  if (quoted) return quoted[1].trim();

  const possessive = q.match(/(?:ของ|ให้กับ|for |of )\s*([^\s,.?!]+(?:\s+[^\s,.?!]+){0,2})/);
  if (possessive) {
    const cleaned = stripStopwords(possessive[1]);
    if (cleaned) return cleaned;
  }

  const named = q.match(/(?:ลูกค้าชื่อ|ชื่อ|customer\s+named?)\s*([^\s,.?!]+(?:\s+[^\s,.?!]+){0,2})/);
  if (named) {
    const cleaned = stripStopwords(named[1]);
    if (cleaned) return cleaned;
  }

  return stripStopwords(q) || null;
}

function stripStopwords(s: string): string {
  let out = norm(s);
  for (const def of INTENTS) for (const { k } of def.keywords) out = out.split(k).join(" ");
  for (const w of STOPWORDS) out = out.split(w).join(" ");
  out = out.replace(/\d+/g, " ").replace(/[?!.,·:;()]/g, " ").replace(/\s+/g, " ").trim();
  return out.length >= 2 && out.length <= 60 ? out : "";
}

export interface ResolveResult {
  intent: string | null;
  confidence: number;
  params: Record<string, any>;
  nameQuery: string | null;
  alternatives: { intent: string; confidence: number }[];
  understoodAs: string;
}

const MIN_SCORE = 2;

/**
 * @param q     the caller's raw command
 * @param forced explicit intent from the request body — skips scoring entirely
 */
export function resolveIntent(q: string, forced?: string | null): ResolveResult {
  const text = norm(q ?? "");
  const nameQuery = extractNameQuery(q ?? "");
  const metric = extractMetric(q ?? "");
  const rounds = extractRounds(q ?? "");

  const paramsFor = (intent: string): Record<string, any> => {
    switch (intent) {
      case "labs.compare": return { rounds };
      case "labs.metric": return { metric };
      case "customer.find": return { q: nameQuery ?? "" };
      case "notes.add": return { body: extractNoteBody(q ?? "") };
      default: return {};
    }
  };

  if (forced) {
    const def = findIntent(forced);
    if (def) {
      const params = paramsFor(forced);
      return {
        intent: forced, confidence: 1, params, nameQuery,
        alternatives: [], understoodAs: def.describe(params, nameQuery ?? undefined),
      };
    }
  }

  const scored = INTENTS.map((def) => {
    let score = 0;
    for (const { k, w } of def.keywords) if (text.includes(k)) score += w;
    // "ค่า X" only counts as labs.metric when a real metric name is present
    if (def.intent === "labs.metric") score = metric ? score + 3 : 0;
    return { intent: def.intent, score, def };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < MIN_SCORE) {
    return {
      intent: null, confidence: 0, params: {}, nameQuery,
      alternatives: scored.filter((s) => s.score > 0).slice(0, 3)
        .map((s) => ({ intent: s.intent, confidence: round2(s.score / 10) })),
      understoodAs: "",
    };
  }

  const margin = top.score - (scored[1]?.score ?? 0);
  const confidence = round2(Math.min(0.99, 0.45 + top.score * 0.06 + margin * 0.08));
  const params = paramsFor(top.intent);

  return {
    intent: top.intent,
    confidence,
    params,
    nameQuery,
    alternatives: scored.slice(1, 4).filter((s) => s.score >= MIN_SCORE)
      .map((s) => ({ intent: s.intent, confidence: round2(Math.min(0.9, s.score * 0.09)) })),
    understoodAs: top.def.describe(params, nameQuery ?? undefined),
  };
}

/** Text after "ว่า" / "that" is the note body. */
function extractNoteBody(q: string): string {
  const m = q.match(/(?:ว่า|that|:)\s*(.+)$/s);
  return (m ? m[1] : "").trim().slice(0, 4000);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Shown by GET /meta and when a command matches nothing. */
export function intentCatalogue() {
  return INTENTS.map((i) => ({
    intent: i.intent,
    scope: i.scope,
    needs_customer: i.needsCustomer,
    examples: exampleFor(i.intent),
  }));
}

function exampleFor(intent: string): string[] {
  const ex: Record<string, string[]> = {
    "labs.compare": ["ช่วยเทียบผลแล็บย้อนหลัง 3 รอบของ คุณสมหญิง หน่อย", "compare last 5 lab rounds"],
    "labs.latest": ["ผลแล็บล่าสุดของ ต้น"],
    "labs.metric": ["ค่า HbA1c ของ คุณสมหญิง ย้อนหลัง"],
    "labs.abnormal": ["ค่าผิดปกติของ ต้น มีอะไรบ้าง"],
    "overview.longevity": ["ช่วยวิเคราะห์ภาพรวมทุก factor ของ ต้น หน่อย"],
    "measurements.list": ["ค่า BCA ของ คุณสมหญิง"],
    "supplements.list": ["ต้น ทานอาหารเสริมอะไรอยู่"],
    "notes.list": ["โน้ตของ ต้น"],
    "notes.add": ["จดโน้ตให้ ต้น ว่า นัดตรวจตับรอบหน้า"],
    "customer.profile": ["โปรไฟล์ของ คุณมาลี ก."],
    "customer.find": ["หาลูกค้าชื่อ สมหญิง"],
    "links.invite": ["ขอลิงก์สมัครให้ที"],
  };
  return ex[intent] ?? [];
}
