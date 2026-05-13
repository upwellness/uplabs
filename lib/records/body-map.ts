/**
 * Mapping: metric_key → body region/system.
 * Used by BodyView to position lab values anatomically on a human silhouette.
 */

export type RegionKey =
  | "brain" | "thyroid" | "lungs" | "heart" | "carotid"
  | "breasts" | "liver" | "pancreas" | "stomach"
  | "kidneys" | "reproductive" | "blood" | "joints";

export interface BodyRegion {
  key:     RegionKey;
  label:   string;   // Thai display
  short:   string;   // short label for SVG callout
  metrics: string[]; // metric_keys belonging to this region
  // SVG coordinate (within 400x640 viewBox of body)
  x: number;
  y: number;
  // Callout text position (where the bubble appears)
  callout: { x: number; y: number; anchor: "left" | "right" };
}

export const BODY_REGIONS: BodyRegion[] = [
  { key: "brain", label: "สมอง · ระบบประสาท", short: "Brain",
    metrics: [],
    x: 200, y: 70,  callout: { x: 80,  y: 70,  anchor: "right" } },

  { key: "thyroid", label: "ไทรอยด์", short: "Thyroid",
    metrics: ["tsh", "ft3", "ft4"],
    x: 200, y: 145, callout: { x: 320, y: 130, anchor: "left" } },

  { key: "carotid", label: "หลอดเลือดคอ", short: "Carotid",
    metrics: ["carotid_duplex"],
    x: 175, y: 130, callout: { x: 80,  y: 130, anchor: "right" } },

  { key: "lungs", label: "ปอด · ทรวงอก", short: "Lungs",
    metrics: ["chest_xray"],
    x: 165, y: 200, callout: { x: 70,  y: 200, anchor: "right" } },

  { key: "heart", label: "หัวใจ · ระบบไหลเวียน", short: "Heart",
    metrics: ["ekg", "cholesterol", "triglyceride", "hdl", "ldl"],
    x: 215, y: 215, callout: { x: 325, y: 210, anchor: "left" } },

  { key: "breasts", label: "เต้านม", short: "Breasts",
    metrics: ["mammogram"],
    x: 200, y: 235, callout: { x: 325, y: 270, anchor: "left" } },

  { key: "liver", label: "ตับ · ทางเดินน้ำดี", short: "Liver",
    metrics: [
      "alt", "ast", "alp", "bilirubin_total",
      "fibroscan_cap", "fibroscan_e", "upper_abdomen_us",
      "hbs_ag", "hbs_ab", "afp",
    ],
    x: 170, y: 295, callout: { x: 70,  y: 290, anchor: "right" } },

  { key: "pancreas", label: "ตับอ่อน · น้ำตาล", short: "Pancreas",
    metrics: ["fbs", "hba1c"],
    x: 220, y: 305, callout: { x: 325, y: 320, anchor: "left" } },

  { key: "stomach", label: "กระเพาะ · ระบบย่อย", short: "Stomach",
    metrics: [],
    x: 200, y: 330, callout: { x: 70,  y: 350, anchor: "right" } },

  { key: "kidneys", label: "ไต · ทางเดินปัสสาวะ", short: "Kidneys",
    metrics: ["bun", "cr", "egfr", "uric_acid"],
    x: 200, y: 370, callout: { x: 325, y: 380, anchor: "left" } },

  { key: "reproductive", label: "อวัยวะสืบพันธุ์", short: "Reproductive",
    metrics: ["ca125", "psa"],
    x: 200, y: 420, callout: { x: 70,  y: 430, anchor: "right" } },

  { key: "blood", label: "เลือด · ภูมิคุ้มกัน", short: "Blood",
    metrics: [
      "wbc", "rbc", "hb", "hct", "mcv", "mch", "mchc", "rdw",
      "platelet", "neutrophils", "lymphocytes", "monocytes",
      "eosinophils", "basophils", "rbc_morphology", "cea",
    ],
    x: 135, y: 350, callout: { x: 60,  y: 470, anchor: "right" } },

  { key: "joints", label: "กระดูก · ข้อต่อ", short: "Joints",
    metrics: [],
    x: 200, y: 560, callout: { x: 325, y: 560, anchor: "left" } },
];

/** Sort statuses worst-first */
const STATUS_RANK: Record<string, number> = {
  critical: 5, high: 4, low: 3, borderline: 2, normal: 1, unknown: 0,
};
export function worstStatus(statuses: (string | null | undefined)[]): string {
  let worst = "unknown";
  for (const s of statuses) {
    if (!s) continue;
    if ((STATUS_RANK[s] ?? 0) > (STATUS_RANK[worst] ?? 0)) worst = s;
  }
  return worst;
}

export const STATUS_COLOR: Record<string, { fill: string; stroke: string; text: string; bg: string }> = {
  normal:     { fill: "#16A34A", stroke: "#16A34A", text: "#15803D", bg: "#DCFCE7" },
  low:        { fill: "#F97316", stroke: "#EA580C", text: "#9A3412", bg: "#FED7AA" },
  high:       { fill: "#DC2626", stroke: "#B91C1C", text: "#991B1B", bg: "#FEE2E2" },
  borderline: { fill: "#EAB308", stroke: "#CA8A04", text: "#854D0E", bg: "#FEF9C3" },
  critical:   { fill: "#7F1D1D", stroke: "#7F1D1D", text: "#7F1D1D", bg: "#FECACA" },
  unknown:    { fill: "#94A3B8", stroke: "#64748B", text: "#475569", bg: "#F1F5F9" },
};

export const STATUS_LABEL: Record<string, string> = {
  normal: "ปกติ", low: "ต่ำ", high: "สูง", borderline: "ก้ำกึ่ง", critical: "วิกฤต", unknown: "ไม่มีข้อมูล",
};
