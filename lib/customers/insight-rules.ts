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
        title: `HbA1c ${input.hba1c}% · เข้าเกณฑ์เบาหวาน`,
        metric: "HbA1c > 6.5%",
        action: "ดู Lab",
        href: `/customers/${input.customerId}/records`,
      });
    } else if (input.hba1c >= 5.7) {
      alerts.push({
        id: "hba1c-watch",
        type: "alert",
        severity: "watch",
        title: `HbA1c ${input.hba1c}% · pre-diabetes`,
        metric: "HbA1c 5.7-6.4%",
      });
    }
  }

  if (input.fbs != null && input.fbs > 126) {
    alerts.push({
      id: "fbs-critical",
      type: "alert",
      severity: "critical",
      title: `FBS ${input.fbs} mg/dL · เกณฑ์เบาหวาน`,
      metric: "FBS > 126",
    });
  }

  if (input.ldl != null) {
    if (input.ldl > 160) {
      alerts.push({
        id: "ldl-critical",
        type: "alert",
        severity: "critical",
        title: `LDL ${input.ldl} mg/dL · สูงมาก`,
        metric: "LDL > 160",
      });
    } else if (input.ldl > 130) {
      alerts.push({
        id: "ldl-watch",
        type: "alert",
        severity: "watch",
        title: `LDL ${input.ldl} mg/dL · เริ่มสูง`,
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
        title: `Visceral Fat ระดับ ${input.visceral} · อันตราย`,
        metric: "Visceral > 15",
      });
    } else if (input.visceral > 9) {
      alerts.push({
        id: "visceral-watch",
        type: "alert",
        severity: "watch",
        title: `Visceral Fat ระดับ ${input.visceral} · สูงมาก`,
        metric: "Visceral 10-15",
      });
    }
  }

  if (input.alt != null && input.alt > 80) {
    alerts.push({
      id: "alt-critical",
      type: "alert",
      severity: "critical",
      title: `ALT ${input.alt} U/L · สูงกว่า 2× ปกติ`,
      metric: "ALT > 2× ULN (40)",
    });
  }
  if (input.ast != null && input.ast > 80) {
    alerts.push({
      id: "ast-critical",
      type: "alert",
      severity: "critical",
      title: `AST ${input.ast} U/L · สูงกว่า 2× ปกติ`,
      metric: "AST > 2× ULN (40)",
    });
  }

  if (input.hasAllergyConflict) {
    alerts.push({
      id: "allergy-conflict",
      type: "alert",
      severity: "watch",
      title: `Allergy conflict · ${input.allergyConflictCount ?? "?"} supplements`,
      detail: "มี supplement ที่ขัดกับ allergy list",
      action: "ดู Allergy",
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
      const dir = delta < 0 ? "ลด" : "เพิ่ม";
      const sev: Severity = delta < 0 ? "info" : "watch";
      trends.push({
        id: "hba1c-trend",
        type: "trend",
        severity: sev,
        title: `HbA1c ${dir} ${Math.abs(delta)}% (${h.length} รอบล่าสุด)`,
      });
    }
  }

  if (input.weightHistory && input.weightHistory.length >= 2) {
    const w = input.weightHistory;
    const delta = +(w[w.length - 1] - w[0]).toFixed(1);
    if (Math.abs(delta) >= 1) {
      const dir = delta < 0 ? "ลด" : "เพิ่ม";
      const sev: Severity = delta < 0 ? "info" : "watch";
      trends.push({
        id: "weight-trend",
        type: "trend",
        severity: sev,
        title: `น้ำหนัก ${dir} ${Math.abs(delta)} kg`,
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
        title: `Visceral Fat ขึ้น ${delta} จุด · ต้องระวัง`,
      });
    } else if (delta <= -2) {
      trends.push({
        id: "visceral-falling",
        type: "trend",
        severity: "info",
        title: `Visceral Fat ลด ${Math.abs(delta)} จุด · ดีขึ้น`,
      });
    }
  }

  /* ─── ACTIONS ────────────────────────────────────────── */

  if ((input.bcaLapseDays ?? 0) > 60) {
    actions.push({
      id: "action-bca",
      type: "action",
      severity: "watch",
      title: `นัด BCA · ห่างมา ${input.bcaLapseDays} วัน`,
      detail: "ควรชั่งทุก 30 วันในช่วง active",
      action: "Schedule BCA",
      href: `/bca`,
    });
  }

  if ((input.labLapseDays ?? 0) > 180) {
    actions.push({
      id: "action-lab",
      type: "action",
      severity: "watch",
      title: `แนะนำตรวจ Lab · ห่างมา ${input.labLapseDays} วัน`,
      detail: "ค่าเลือดประจำปีควรอัพเดท",
      action: "เพิ่มผล Lab",
      href: `/customers/${input.customerId}/records/new`,
    });
  }

  if ((input.orderLapseDays ?? 0) > 60 && !input.inActiveProgram) {
    actions.push({
      id: "action-reorder",
      type: "action",
      severity: "watch",
      title: `ส่ง message reconnect · ออเดอร์ห่าง ${input.orderLapseDays} วัน`,
      detail: "ยังอยู่ใน warm window · ก่อนกลายเป็น lapsed",
      action: "LINE Reach Out",
    });
  }

  const hasCriticalAlert = alerts.some(a => a.severity === "critical");

  return { alerts, trends, actions, hasCriticalAlert };
}
