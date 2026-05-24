/**
 * Insight Rules · Generate alerts + trends + next-best-actions
 * ────────────────────────────────────────────────────────────
 * Conservative thresholds (locked 24/5/26):
 *   HbA1c > 6.5 = critical · 5.7-6.4 = watch
 *   FBS > 126 = critical
 *   LDL > 160 = critical · 130-160 = watch
 *   Visceral > 15 = critical · 10-15 = watch
 *   ALT/AST > 2× ULN = critical
 *   BCA gap > 60 days = watch
 *   Order gap > 90 days = at-risk signal
 */

export type Severity = "critical" | "watch" | "info";

export interface Insight {
  id:       string;
  type:     "alert" | "trend" | "action";
  severity: Severity;
  title:    string;
  detail?:  string;
  metric?:  string;
  action?:  string;          // CTA label
  href?:    string;          // CTA link
}

export interface InsightInput {
  // latest values
  hba1c?:         number | null;
  fbs?:           number | null;
  ldl?:           number | null;
  hdl?:           number | null;
  triglyceride?:  number | null;
  alt?:           number | null;
  ast?:           number | null;
  visceral?:      number | null;

  // BCA/measurement gap
  bcaLapseDays?:  number | null;
  labLapseDays?:  number | null;
  orderLapseDays?: number | null;

  // history trends (last 3 values · oldest → newest)
  hba1cHistory?:  number[];
  ldlHistory?:    number[];
  visceralHistory?:number[];
  weightHistory?: number[];

  // allergy
  hasAllergyConflict?: boolean;
  allergyConflictCount?: number;

  // program status
  inActiveProgram?: boolean;
  customerId:     string;
}

export interface InsightResult {
  alerts:  Insight[];   // 🚨 critical/watch — needs attention
  trends:  Insight[];   // 📈 trend detections
  actions: Insight[];   // 🎯 next best action recommendations
  hasCriticalAlert: boolean;
}

export function generateInsights(input: InsightInput): InsightResult {
  const alerts:  Insight[] = [];
  const trends:  Insight[] = [];
  const actions: Insight[] = [];

  /* ─── ALERTS ────────────────────────────────────────── */

  if (input.hba1c != null) {
    if (input.hba1c > 6.5) {
      alerts.push({
        id: "hba1c-critical",
        type: "alert",
        severity: "critical",
        title: `HbA1c ${input.hba1c}% สูง · ควรปรึกษาแพทย์ยืนยัน`,
        metric: "HbA1c > 6.5%",
        action: "ไปดู Lab",
        href: `/customers/${input.customerId}/records`,
      });
    } else if (input.hba1c >= 5.7) {
      alerts.push({
        id: "hba1c-watch",
        type: "alert",
        severity: "watch",
        title: `HbA1c ${input.hba1c}% เริ่มสูง · ควรติดตามใกล้ชิด`,
        metric: "HbA1c 5.7-6.4%",
      });
    }
  }

  if (input.fbs != null && input.fbs > 126) {
    alerts.push({
      id: "fbs-critical",
      type: "alert",
      severity: "critical",
      title: `FBS ${input.fbs} mg/dL สูงผิดปกติ · ควรปรึกษาแพทย์`,
      metric: "FBS > 126",
    });
  }

  if (input.ldl != null) {
    if (input.ldl > 160) {
      alerts.push({
        id: "ldl-critical",
        type: "alert",
        severity: "critical",
        title: `LDL ${input.ldl} mg/dL สูงมาก · ควรปรึกษาแพทย์`,
        metric: "LDL > 160",
      });
    } else if (input.ldl > 130) {
      alerts.push({
        id: "ldl-watch",
        type: "alert",
        severity: "watch",
        title: `LDL ${input.ldl} mg/dL เริ่มสูง · ดูแลเรื่องอาหารและออกกำลังกาย`,
        metric: "LDL 130-160",
      });
    }
  }

  if (input.visceral != null) {
    if (input.visceral > 15) {
      alerts.push({
        id: "visceral-critical",
        type: "alert",
        severity: "critical",
        title: `Visceral Fat ระดับ ${input.visceral} สูงมาก · ต้องดูแลใกล้ชิด`,
        metric: "Visceral > 15",
      });
    } else if (input.visceral > 9) {
      alerts.push({
        id: "visceral-watch",
        type: "alert",
        severity: "watch",
        title: `Visceral Fat ระดับ ${input.visceral} เริ่มสูง · ควรลดให้ลง`,
        metric: "Visceral 10-15",
      });
    }
  }

  if (input.alt != null && input.alt > 80) {
    alerts.push({
      id: "alt-critical",
      type: "alert",
      severity: "critical",
      title: `ALT ${input.alt} U/L สูงกว่าปกติ 2 เท่า · ควรปรึกษาแพทย์`,
      metric: "ALT > 2× ULN (40)",
    });
  }
  if (input.ast != null && input.ast > 80) {
    alerts.push({
      id: "ast-critical",
      type: "alert",
      severity: "critical",
      title: `AST ${input.ast} U/L สูงกว่าปกติ 2 เท่า · ควรปรึกษาแพทย์`,
      metric: "AST > 2× ULN (40)",
    });
  }

  if (input.hasAllergyConflict) {
    alerts.push({
      id: "allergy-conflict",
      type: "alert",
      severity: "watch",
      title: `พบสารที่อาจขัดกัน · ${input.allergyConflictCount ?? "?"} ตัว`,
      detail: "มี supplement บางตัวที่อาจขัดกับผล allergy",
      action: "ดูรายการ Allergy",
      href: `/customers/${input.customerId}#allergy`,
    });
  }

  /* ─── TRENDS ────────────────────────────────────────── */

  if (input.hba1cHistory && input.hba1cHistory.length >= 2) {
    const h = input.hba1cHistory;
    const last = h[h.length - 1];
    const first = h[0];
    const delta = +(last - first).toFixed(2);
    if (Math.abs(delta) >= 0.2) {
      const dir = delta < 0 ? "ลดลง" : "เพิ่มขึ้น";
      const sev: Severity = delta < 0 ? "info" : "watch";
      const suffix = delta < 0 ? " · แนวโน้มดีขึ้น" : " · ควรติดตาม";
      trends.push({
        id: "hba1c-trend",
        type: "trend",
        severity: sev,
        title: `HbA1c ${dir} ${Math.abs(delta)}% จาก ${h.length} รอบล่าสุด${suffix}`,
      });
    }
  }

  if (input.weightHistory && input.weightHistory.length >= 2) {
    const w = input.weightHistory;
    const delta = +(w[w.length - 1] - w[0]).toFixed(1);
    if (Math.abs(delta) >= 1) {
      const dir = delta < 0 ? "ลดลง" : "เพิ่มขึ้น";
      const sev: Severity = delta < 0 ? "info" : "watch";
      const suffix = delta < 0 ? " · ไปได้ดี" : " · ควรปรับ";
      trends.push({
        id: "weight-trend",
        type: "trend",
        severity: sev,
        title: `น้ำหนัก ${dir} ${Math.abs(delta)} kg${suffix}`,
      });
    }
  }

  if (input.visceralHistory && input.visceralHistory.length >= 2) {
    const v = input.visceralHistory;
    const delta = v[v.length - 1] - v[0];
    if (delta >= 2) {
      trends.push({
        id: "visceral-rising",
        type: "trend",
        severity: "watch",
        title: `Visceral Fat เพิ่มขึ้น ${delta} ระดับ · ควรดูแลเพิ่ม`,
      });
    } else if (delta <= -2) {
      trends.push({
        id: "visceral-falling",
        type: "trend",
        severity: "info",
        title: `Visceral Fat ลดลง ${Math.abs(delta)} ระดับ · ดีขึ้นชัดเจน`,
      });
    }
  }

  /* ─── ACTIONS ────────────────────────────────────────── */

  if ((input.bcaLapseDays ?? 0) > 60) {
    actions.push({
      id: "action-bca",
      type: "action",
      severity: "watch",
      title: `ถึงเวลานัด BCA · ห่างมา ${input.bcaLapseDays} วัน`,
      detail: "ในช่วงดูแลควรชั่งทุก 30 วัน เพื่อเห็นการเปลี่ยนแปลง",
      action: "นัด BCA ให้",
      href: `/bca`,
    });
  }

  if ((input.labLapseDays ?? 0) > 180) {
    actions.push({
      id: "action-lab",
      type: "action",
      severity: "watch",
      title: `ถึงเวลาตรวจ Lab · ห่างมา ${input.labLapseDays} วัน`,
      detail: "ค่าเลือดประจำปีควรอัพเดท เพื่อดูแนวโน้มได้แม่นยำ",
      action: "เพิ่มผล Lab",
      href: `/customers/${input.customerId}/records/new`,
    });
  }

  if ((input.orderLapseDays ?? 0) > 60 && !input.inActiveProgram) {
    actions.push({
      id: "action-reorder",
      type: "action",
      severity: "watch",
      title: `ทักไปทักทาย · ห่างจากการสั่งซื้อ ${input.orderLapseDays} วัน`,
      detail: "ยังอยู่ในช่วงที่ติดต่อได้ดี · ก่อนจะห่างหายไป",
      action: "ทักทาง LINE",
    });
  }

  const hasCriticalAlert = alerts.some(a => a.severity === "critical");

  return { alerts, trends, actions, hasCriticalAlert };
}
