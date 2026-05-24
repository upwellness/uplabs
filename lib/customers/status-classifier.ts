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
  critical:   { label: "Critical",   icon: "🔴", color: "#B91C1C", bg: "#FEE2E2" },
  at_risk:    { label: "At Risk",    icon: "🟠", color: "#C2410C", bg: "#FFEDD5" },
  in_program: { label: "In Program", icon: "🟡", color: "#A16207", bg: "#FEF3C7" },
  lapsed:     { label: "Lapsed",     icon: "🌙", color: "#475569", bg: "#E2E8F0" },
  new:        { label: "New",        icon: "⚪", color: "#1F1E1B", bg: "#F5F0EB" },
  healthy:    { label: "Healthy",    icon: "🟢", color: "#15803D", bg: "#DCFCE7" },
};

export function classifyStatus(input: StatusInput): StatusResult {
  const meta = (status: CustomerStatus, reason: string): StatusResult =>
    ({ status, reason, ...STATUS_META[status] });

  // 1. Critical · medical alerts override everything
  if (input.hasCriticalAlert) {
    return meta("critical", "มี alert ระดับ Critical ที่ต้องดูแลทันที");
  }

  // 2. At Risk · lapsed orders but not in program
  if ((input.orderLapseDays ?? 0) > 90 && !input.inActiveProgram) {
    return meta("at_risk", `ห่างจาก order ครั้งล่าสุด ${input.orderLapseDays} วัน`);
  }

  // 3. In Program · active UP Labs / Full Course
  if (input.inActiveProgram) {
    return meta("in_program", "กำลังอยู่ในโปรแกรม UP Labs / Full Course");
  }

  // 4. Lapsed · no activity 180+ days (even BCA)
  const allLapsed =
    (input.orderLapseDays ?? 0) > 180 &&
    (input.bcaLapseDays   ?? 999) > 180;
  if (allLapsed) {
    return meta("lapsed", "ไม่มี activity ใดๆ ในช่วง 180 วัน");
  }

  // 5. New · created recently + few records
  if ((input.daysSinceCreated ?? 999) < 30 && (input.recordCount ?? 0) < 3) {
    return meta("new", `เพิ่งสร้าง ${input.daysSinceCreated} วัน · ยังไม่มีข้อมูลเพียงพอ`);
  }

  // 6. Healthy · default if score >= 75
  if ((input.healthScoreTotal ?? 0) >= 75) {
    return meta("healthy", `Health Score ${input.healthScoreTotal} · อยู่ในเกณฑ์ดี`);
  }

  // Default fallback · neither healthy nor critical · just "monitoring"
  return meta("at_risk", "Score ต่ำกว่าเกณฑ์ดี · ติดตามใกล้ชิด");
}
