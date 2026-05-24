/**
 * Status Classifier · Derive 1 of 6 status badges from customer data
 * ─────────────────────────────────────────────────────────────────
 * Precedence: Critical > AtRisk > InProgram > Lapsed > New > Healthy
 */

export type CustomerStatus = "critical" | "at_risk" | "in_program" | "lapsed" | "new" | "healthy";

export interface StatusInput {
  hasCriticalAlert?: boolean;       // from insight-rules
  inActiveProgram?:  boolean;       // UP Labs / Full Course running
  orderLapseDays?:   number | null; // days since last order
  bcaLapseDays?:     number | null; // days since last BCA
  daysSinceCreated?: number | null; // customer record age
  recordCount?:      number | null; // # of records / measurements / events
  healthScoreTotal?: number | null; // 0-100
}

export interface StatusResult {
  status:  CustomerStatus;
  label:   string;
  icon:    string;
  color:   string;       // hex
  bg:      string;       // bg hex
  reason:  string;       // 1-line explanation
}

const STATUS_META: Record<CustomerStatus, Omit<StatusResult, "reason" | "status">> = {
  critical:   { label: "ต้องดูแลด่วน", icon: "🔴", color: "#B91C1C", bg: "#FEE2E2" },
  at_risk:    { label: "ต้องติดตาม",   icon: "🟠", color: "#C2410C", bg: "#FFEDD5" },
  in_program: { label: "กำลังดูแล",    icon: "🟡", color: "#A16207", bg: "#FEF3C7" },
  lapsed:     { label: "ห่างหายไป",    icon: "🌙", color: "#475569", bg: "#E2E8F0" },
  new:        { label: "คนไข้ใหม่",    icon: "⚪", color: "#1F1E1B", bg: "#F5F0EB" },
  healthy:    { label: "แข็งแรงดี",    icon: "🟢", color: "#15803D", bg: "#DCFCE7" },
};

export function classifyStatus(input: StatusInput): StatusResult {
  const meta = (status: CustomerStatus, reason: string): StatusResult =>
    ({ status, reason, ...STATUS_META[status] });

  // 1. Critical · medical alerts override everything
  if (input.hasCriticalAlert) {
    return meta("critical", "มีสัญญาณที่ต้องดูแลทันที · ควรนัดคุยเร็วๆ นี้");
  }

  // 2. At Risk · lapsed orders but not in program
  if ((input.orderLapseDays ?? 0) > 90 && !input.inActiveProgram) {
    return meta("at_risk", `ห่างจากการสั่งซื้อครั้งล่าสุด ${input.orderLapseDays} วัน · ลองทักไปทักทาย`);
  }

  // 3. In Program · active UP Labs / Full Course
  if (input.inActiveProgram) {
    return meta("in_program", "อยู่ในโปรแกรม UP Labs / Full Course · ดูแลใกล้ชิดอยู่");
  }

  // 4. Lapsed · no activity 180+ days (even BCA)
  const allLapsed =
    (input.orderLapseDays ?? 0) > 180 &&
    (input.bcaLapseDays   ?? 999) > 180;
  if (allLapsed) {
    return meta("lapsed", "ไม่มีความเคลื่อนไหวเกิน 180 วัน · ลองชวนกลับมาดูแลใหม่");
  }

  // 5. New · created recently + few records
  if ((input.daysSinceCreated ?? 999) < 30 && (input.recordCount ?? 0) < 3) {
    return meta("new", `เพิ่งเข้ามา ${input.daysSinceCreated} วัน · ค่อยๆ ทำความรู้จักกัน`);
  }

  // 6. Healthy · default if score >= 75
  if ((input.healthScoreTotal ?? 0) >= 75) {
    return meta("healthy", `Health Score ${input.healthScoreTotal} · อยู่ในเกณฑ์ดี รักษาแบบนี้ไว้`);
  }

  // Default fallback · neither healthy nor critical · just "monitoring"
  return meta("at_risk", "คะแนนยังไม่อยู่ในเกณฑ์ดี · ลองดูแลใกล้ชิดอีกนิด");
}
