/**
 * Program Designer — product database + calc engine
 * Adapted from v1 Baseline 3.2.1 · SKU names aligned with Pulse whitelist
 *
 * Key change from v1: Calow default dose = 2 tablets pre-meal · note "ก่อนอาหาร 15 นาที"
 */

export const PV_RATE = 3.23;

export type Category = "Calories Restriction" | "Nutrients" | "Hormone Balance" | "NCDs" | "Etc";
export type Color = "rose" | "wellness" | "science" | "amber" | "ink";

export interface Product {
  id:      string;
  name:    string;
  price:   number;
  cat:     Category;
  pack:    number;
  color:   Color;
  canDisc: boolean;
}

export const PRODUCTS: Product[] = [
  // Calories Restriction
  { id: "p1",  name: "BodyKey (BK)",     price: 1700, cat: "Calories Restriction", pack: 14,  color: "rose",     canDisc: true  },
  { id: "p2",  name: "All Plant 900g",   price: 2300, cat: "Calories Restriction", pack: 53,  color: "rose",     canDisc: false },
  { id: "p3",  name: "All Plant 450g",   price: 1209, cat: "Calories Restriction", pack: 26,  color: "rose",     canDisc: true  },
  { id: "p4",  name: "GT/Choc Protein",  price: 1500, cat: "Calories Restriction", pack: 26,  color: "rose",     canDisc: true  },
  { id: "p5",  name: "Green Tea Plus",   price: 1732, cat: "Calories Restriction", pack: 60,  color: "rose",     canDisc: true  },
  // Nutrients
  { id: "p6",  name: "DoubleX Box",      price: 2364, cat: "Nutrients",            pack: 62,  color: "wellness", canDisc: true  },
  { id: "p7",  name: "DoubleX Refill",   price: 4486, cat: "Nutrients",            pack: 124, color: "wellness", canDisc: false },
  { id: "p9",  name: "Triple Omega",     price: 975,  cat: "Nutrients",            pack: 60,  color: "wellness", canDisc: true  },
  { id: "p10", name: "Vitamin B Plus",   price: 527,  cat: "Nutrients",            pack: 60,  color: "wellness", canDisc: false },
  { id: "p11", name: "Bio C",            price: 990,  cat: "Nutrients",            pack: 60,  color: "wellness", canDisc: true  },
  // Hormone Balance
  { id: "p12", name: "Fiber Blend",      price: 1168, cat: "Hormone Balance",      pack: 60,  color: "science",  canDisc: false },
  { id: "p14", name: "Fiber Powder",     price: 1627, cat: "Hormone Balance",      pack: 30,  color: "science",  canDisc: true  },
  { id: "p15", name: "Probiotics",       price: 1650, cat: "Hormone Balance",      pack: 30,  color: "science",  canDisc: true  },
  // NCDs
  { id: "p16", name: "Garlic",           price: 1195, cat: "NCDs",                 pack: 150, color: "amber",    canDisc: true  },
  { id: "p17", name: "CoQ10",            price: 2209, cat: "NCDs",                 pack: 60,  color: "amber",    canDisc: true  },
  { id: "p18", name: "Ginseng",          price: 1300, cat: "NCDs",                 pack: 60,  color: "amber",    canDisc: false },
  { id: "p19", name: "CVF (Immune)",     price: 1468, cat: "NCDs",                 pack: 60,  color: "amber",    canDisc: false },
  { id: "p20", name: "Calow",            price: 1314, cat: "NCDs",                 pack: 90,  color: "amber",    canDisc: false },
  { id: "p22", name: "Lesterol",         price: 1486, cat: "NCDs",                 pack: 60,  color: "amber",    canDisc: false },
  // Etc
  { id: "p21", name: "แก้ว UP Labs",    price: 100,  cat: "Etc",                  pack: 1,   color: "ink",      canDisc: false },
];

export interface DoseSpec {
  q60?: number;       // suggested unit count for 60-day course
  dM?:  string;
  dN?:  string;
  dE?:  string;
  rmk?: string;
}

/** Standard 60-day Full Course preset · base stack */
export const STANDARD_60D: Record<string, DoseSpec> = {
  p1:  { q60: 6, dM: "1", dE: "1", rmk: "ทาน 14 วัน · สลับ 14 วัน" },
  p2:  { q60: 1, dM: "1", dE: "1.5", rmk: "ทาน 14 วัน · สลับ 14 วัน" },
  p4:  { q60: 1, dM: "1" },
  p5:  { q60: 3, dM: "1", dE: "1" },
  p7:  { q60: 1, dM: "1", dE: "1" },
  p9:  { q60: 2, dM: "1", dE: "1" },
  p11: { q60: 2, dM: "1", dE: "1" },
  p10: { q60: 2, dM: "1", dE: "1" },
  p12: { q60: 1, dN: "2", rmk: "ทาน 2 เม็ด + น้ำ 300cc" },
  p14: { q60: 2, dM: "1" },
  p15: { q60: 2, dM: "1" },
  p21: { q60: 1 },
};

export interface ConditionAddon {
  id:    string;
  name:  string;
  icon:  string;
  items: Record<string, DoseSpec>;
}

export const CONDITION_ADDONS: ConditionAddon[] = [
  { id: "hyp", name: "มีความดัน",          icon: "💗",
    items: { p16: { q60: 1, dM: "1", dN: "1", dE: "1", rmk: "ดูแลหลอดเลือด" } } },
  { id: "cho", name: "ไขมันสูง",            icon: "🩸",
    items: { p22: { q60: 1, dN: "2", rmk: "ทานพร้อมมื้ออาหาร" } } },
  { id: "plt", name: "ลดน้ำหนักไม่ลง",       icon: "📉",
    items: { p18: { q60: 1, dM: "1", dN: "1", dE: "1", rmk: "กระตุ้นการเผาผลาญ (โสม)" } } },
  // ⚠️ FIXED: Calow default = 2 tablets pre-meal · 15 minutes
  { id: "hun", name: "หิวบ่อย / คุมหิว",     icon: "🍴",
    items: { p20: { q60: 2, dM: "2", dE: "2", rmk: "ทาน 2 เม็ด · ก่อนอาหาร 15 นาที · block carb/sugar ~300 kcal" } } },
  { id: "can", name: "มะเร็ง / ภูมิคุ้มกัน", icon: "🛡️",
    items: { p19: { q60: 1, dM: "1", dN: "1", dE: "1", rmk: "ดูแลภูมิต้านทาน" } } },
];

export interface WizardStep {
  id:    number;
  title: string;
  desc:  string;
  color: Color;
  cats:  Category[];
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 0, title: "Energy Block",   desc: "โปรตีน · มื้อทดแทน · เผาผลาญ",     color: "rose",     cats: ["Calories Restriction"] },
  { id: 1, title: "Cell Nutrients", desc: "วิตามิน · สารอาหารพื้นฐาน",        color: "wellness", cats: ["Nutrients"] },
  { id: 2, title: "Gut Balance",    desc: "สมดุลลำไส้ · ฮอร์โมน",              color: "science",  cats: ["Hormone Balance"] },
  { id: 3, title: "Targeted Care",  desc: "เสริมพิเศษ · รายโรค / อาการ",       color: "amber",    cats: ["NCDs"] },
  { id: 4, title: "Final Summary",  desc: "สรุปงบ · PV · cashback",            color: "ink",      cats: ["Etc"] },
];

/* ─── Calc engine ─────────────────────────────────────────────────── */

export interface ItemState extends Product {
  dM:       string;
  dN:       string;
  dE:       string;
  rmk:      string;
  qty:      number;
  isManual: boolean;
  disc:     boolean;
  suggested?: number;
}

export interface Summary {
  rawTotal:      number;
  totalItemDisc: number;
  net:           number;
  pv:            number;
  rate:          number;
  cb:            number;
  itemDetails:   Array<ItemState & { discountVal: number; lineTotal: number }>;
}

export function initialItems(): ItemState[] {
  return PRODUCTS.map((p) => ({
    ...p,
    dM: "", dN: "", dE: "", rmk: "", qty: 0, isManual: false, disc: p.canDisc,
  }));
}

/**
 * Process raw items → compute `suggested` packs.
 *
 * SINGLE source of truth = dose math: ceil((dM+dN+dE) × duration / pack).
 * Special cases:
 *  - BodyKey/All Plant 900 under Standard course: alternate 14-on/14-off → multiplier × 42/60
 *  - Standard preset has fixed q60 numbers · use them only if dose matches preset
 *  - Condition addons SET doses (they fill dM/dN/dE) — dose math handles the rest,
 *    NEVER add condition's q60 on top of dose math (was the double-count bug)
 *  - แก้ว (p21) is qty-only, no dose math
 */
export function processItems(
  items: ItemState[], duration: number, isStd: boolean, _activeConds: string[],
): ItemState[] {
  void _activeConds; // kept for API compatibility; doses already set by toggleCond
  return items.map((item) => {
    if (item.id === "p21") return { ...item, suggested: item.qty };

    const dSum = (parseFloat(item.dM) || 0) + (parseFloat(item.dN) || 0) + (parseFloat(item.dE) || 0);

    if (dSum === 0 && !item.rmk && item.qty === 0) {
      return { ...item, qty: 0, suggested: 0 };
    }

    let multiplier = duration;
    if (isStd && (item.id === "p1" || item.id === "p2")) multiplier = (duration / 60) * 42;

    let suggested = dSum > 0 ? Math.ceil((dSum * multiplier) / item.pack) : 0;

    // Standard preset override (only if user hasn't deviated from preset doses)
    if (isStd && STANDARD_60D[item.id]) {
      const s = STANDARD_60D[item.id];
      const sSum = (parseFloat(s.dM ?? "0") || 0) + (parseFloat(s.dN ?? "0") || 0) + (parseFloat(s.dE ?? "0") || 0);
      if (dSum === sSum && s.q60 != null) suggested = duration === 60 ? s.q60 : Math.ceil(s.q60 / 2);
    }

    if (suggested === 0 && (dSum > 0 || item.rmk)) suggested = 1;
    return { ...item, suggested, qty: item.isManual ? item.qty : suggested };
  });
}

export interface Fees {
  reg:    boolean;
  estart: boolean;
  ajoy:   boolean;
}

export function summarize(items: ItemState[], fees: Fees): Summary {
  const active = items.filter((i) => i.qty > 0);
  const rawTotal = active.reduce((s, i) => s + i.price * i.qty, 0);

  const itemDetails = active.map((i) => {
    const limit = i.id === "p1" ? 3 : 1;
    const discQty = i.disc ? Math.min(i.qty, limit) : 0;
    const discountVal = i.price * discQty * 0.15;
    return { ...i, discountVal, lineTotal: i.price * i.qty - discountVal };
  });

  const totalItemDisc = itemDetails.reduce((s, i) => s + i.discountVal, 0);
  const net = rawTotal - totalItemDisc
    + (fees.reg    ? 900 : 0)
    - (fees.estart ? 300 : 0)
    - (fees.ajoy   ? 500 : 0);

  const pv = Math.max(0, net - (fees.reg ? 900 : 0)) / PV_RATE;
  let rate = 0;
  if (pv >= 150000) rate = 21;
  else if (pv >=  30000) rate = 12;
  else if (pv >=  15000) rate =  9;
  else if (pv >=   5000) rate =  6;
  else if (pv >=   2500) rate =  3;

  return {
    rawTotal, totalItemDisc, net, pv, rate,
    cb: pv * (rate / 100) * PV_RATE,
    itemDetails,
  };
}
