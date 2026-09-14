"use client";

/** S4 · แผน 90 วัน — one solid header, then five collapsed sections opened one at a time. */
import { useState } from "react";
import { Target, Utensils, Footprints, Pill, CalendarClock, Stethoscope } from "lucide-react";
import type { PortalData } from "@/lib/health-design/portal-data";
import { GOAL_STATUS_TH } from "@/lib/health-design/progress";
import { fmtDateTh, fmtNum } from "@/lib/health-design/portal-nav";
import { Card, Sub, Big, Chip, LevelChip, Row, Empty } from "./ui";
import { TopBar, type Nav } from "./Portal";
import { domainLabel } from "./resolve";

type Sec = "goals" | "nutrition" | "lifestyle" | "supplements" | "retest" | "doctor";

export function PlanScreen({ data, nav }: { data: PortalData; nav: Nav }) {
  const [open, setOpen] = useState<Sec | null>("goals");
  const p = data.plan;
  if (!p) return (
    <div className="flex flex-col gap-2.5"><TopBar title="แผน 90 วัน" />
      <Card className="p-4"><Empty>{data.assessment ? "โค้ชกำลังร่างแผนจากผลประเมินของคุณ — จะขึ้นที่นี่เมื่อโค้ชยืนยันแล้ว" : "ยังไม่มีผลประเมิน จึงยังไม่มีแผน — เริ่มจากส่งผลเลือดหรือชั่ง BCA กับโค้ช"}</Empty></Card>
    </div>
  );
  const plan = p.plan; const pr = p.progress;
  const counts = pr ? pr.goals.reduce<Record<string, number>>((m, g) => ((m[g.status] = (m[g.status] ?? 0) + 1), m), {}) : {};
  const toggle = (s: Sec) => setOpen((o) => (o === s ? null : s));
  const goalChip = (s: string) => <Chip tone={s === "achieved" || s === "improving" ? "green" : s === "worsening" ? "rose" : s === "no_change" ? "gold" : "muted"}>{GOAL_STATUS_TH[s as keyof typeof GOAL_STATUS_TH] ?? s}</Chip>;

  return (
    <div className="flex flex-col gap-2.5">
      <TopBar title="แผน 90 วัน" right={<Chip>{data.customer.coach_name ? `โค้ช${data.customer.coach_name}ยืนยัน` : "โค้ชยืนยันแล้ว"}</Chip>} />
      <Card solid className="p-4">
        <div className="flex items-end justify-between">
          <div><Sub light>วันที่</Sub><Big light value={pr?.day ?? 0} unit="/ 90" /></div>
          <div className="text-right font-thai text-[12.5px] leading-relaxed text-white/90">
            {(["achieved", "improving", "no_change", "worsening", "no_new_data"] as const).filter((k) => counts[k]).map((k) => `${GOAL_STATUS_TH[k]} ${counts[k]}`).join(" · ") || "เริ่มติดตาม"}
            {p.confirmed_at && <div className="text-white/70">เริ่ม {fmtDateTh(p.confirmed_at, data.today)}</div>}
          </div>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, ((pr?.day ?? 0) / 90) * 100)}%` }} /></div>
        {plan.goal_reason && <Sub light className="mt-2 text-[12.5px]">{plan.goal_reason}</Sub>}
      </Card>

      <Card className="px-4 py-1">
        {/* เป้าหมาย */}
        <Row first expanded={open === "goals"} onClick={() => toggle("goals")} left={<><Ic><Target className="h-3.5 w-3.5" /></Ic>เป้าหมาย {plan.goals_90d.length} ข้อ</>} />
        {open === "goals" && (
          <div className="pb-2 pl-1">
            {plan.goals_90d.map((g, i) => {
              const gp = pr?.goals.find((x) => x.domain === g.domain && x.target === g.target) ?? pr?.goals[i] ?? null;
              return (
                <div key={i} className={`py-2 ${i ? "border-t border-ink-10" : ""}`}>
                  <div className="flex items-start justify-between gap-2"><div className="font-thai text-[14.5px] font-medium text-ink">{g.target}</div>{gp && goalChip(gp.status)}</div>
                  <Sub className="mt-0.5 text-[12.5px]">{domainLabel(g.domain)} · {g.why}{gp && gp.note ? ` · ${gp.note}` : ""}</Sub>
                </div>
              );
            })}
          </div>
        )}
        {/* โภชนาการ */}
        <Row expanded={open === "nutrition"} onClick={() => toggle("nutrition")} left={<><Ic><Utensils className="h-3.5 w-3.5" /></Ic>โภชนาการ · เป้าต่อวัน</>} />
        {open === "nutrition" && (
          <div className="pb-2 pl-1">
            {plan.nutrition.targets ? (
              <div className="grid grid-cols-4 gap-2 py-1 text-center">
                {[["kcal", plan.nutrition.targets.kcal, "kcal"], ["โปรตีน", plan.nutrition.targets.p, "g"], ["คาร์บ", plan.nutrition.targets.c, "g"], ["ไขมัน", plan.nutrition.targets.f, "g"]].map(([l, v, u]) => <div key={String(l)}><div className="font-head text-[17px] font-extrabold tabular-nums text-ink">{fmtNum(Math.round(Number(v)), 0)}</div><Sub className="text-[11.5px]">{l} {u}</Sub></div>)}
              </div>
            ) : <Sub>ยังไม่มีเป้าตัวเลข — ต้องมีน้ำหนักและส่วนสูงก่อน</Sub>}
            {plan.nutrition.targets?.protein_g_per_kg != null && <Sub className="text-[12.5px]">โปรตีน {plan.nutrition.targets.protein_g_per_kg} g ต่อน้ำหนักตัว 1 กก. · {plan.nutrition.targets.note}</Sub>}
            {plan.nutrition.notes.map((n, i) => <Sub key={i} className="mt-1 text-[12.5px]">· {n}</Sub>)}
            <button type="button" onClick={() => nav.go("#food")} className="mt-2 font-thai text-[13.5px] font-semibold text-wellness">ดูวันนี้เทียบเป้าที่แท็บอาหาร ›</button>
          </div>
        )}
        {/* ไลฟ์สไตล์ */}
        <Row expanded={open === "lifestyle"} onClick={() => toggle("lifestyle")} left={<><Ic><Footprints className="h-3.5 w-3.5" /></Ic>ไลฟ์สไตล์ · {plan.lifestyle.length} ข้อ</>} />
        {open === "lifestyle" && (
          <div className="pb-2 pl-1">
            {plan.lifestyle.map((l, i) => <div key={i} className={`py-2 ${i ? "border-t border-ink-10" : ""}`}><div className="font-thai text-[14.5px] font-medium text-ink">{l.target}</div><Sub className="mt-0.5 text-[12.5px]">{l.current ? `ตอนนี้ ${l.current} · ` : ""}{l.why}</Sub></div>)}
            {plan.lifestyle.length === 0 && <Sub>ไม่มีรายการ</Sub>}
          </div>
        )}
        {/* อาหารเสริม */}
        <Row expanded={open === "supplements"} onClick={() => toggle("supplements")} left={<><Ic><Pill className="h-3.5 w-3.5" /></Ic>อาหารเสริม <Chip className="ml-1">จากเภสัชกร</Chip></>} />
        {open === "supplements" && (
          <div className="pb-2 pl-1">
            {plan.supplements.schedule && plan.supplements.schedule.length ? plan.supplements.schedule.map((s, i) => <div key={i} className={`flex justify-between gap-3 py-1.5 font-thai text-[14px] ${i ? "border-t border-ink-10" : ""}`}><span className="text-ink-60">{s.meal_slot}</span><span className="text-right font-medium text-ink">{s.items.join(", ")}</span></div>) : <Sub>ยังไม่มีตารางจากเภสัชกร</Sub>}
            <Sub className="mt-1.5 text-[12px]">{plan.supplements.note}</Sub>
          </div>
        )}
        {/* ตรวจซ้ำ */}
        <Row expanded={open === "retest"} onClick={() => toggle("retest")} left={<><Ic tone={pr?.due_now.length ? "gold" : "green"}><CalendarClock className="h-3.5 w-3.5" /></Ic>ถึงกำหนดตรวจ{pr?.due_now.length ? <b className="ml-1 text-[#7A5410]">· {pr.due_now.length} รายการ</b> : null}</>} />
        {open === "retest" && (
          <div className="pb-2 pl-1">
            {plan.retest.map((r, i) => { const due = pr?.due_now.find((d) => d.what === r.what); return <div key={i} className={`flex items-start justify-between gap-2 py-2 ${i ? "border-t border-ink-10" : ""}`}><div><div className="font-thai text-[14.5px] font-medium text-ink">{r.what}</div><Sub className="text-[12.5px]">ภายใน {r.when_days} วัน · {r.why}</Sub></div>{due ? <Chip tone="gold">{due.overdue_days > 0 ? `เกิน ${due.overdue_days} วัน` : "ถึงกำหนด"}</Chip> : <Chip tone="muted">อีก {Math.max(0, r.when_days - (pr?.day ?? 0))} วัน</Chip>}</div>; })}
            {plan.retest.length === 0 && <Sub>ไม่มีรายการ</Sub>}
          </div>
        )}
        {/* แพทย์ */}
        {plan.doctor_flags.length > 0 && (
          <>
            <Row expanded={open === "doctor"} onClick={() => toggle("doctor")} left={<><Ic tone="rose"><Stethoscope className="h-3.5 w-3.5" /></Ic>เรื่องที่ควรให้แพทย์ดู · {plan.doctor_flags.length}</>} />
            {open === "doctor" && <div className="pb-2 pl-1">{plan.doctor_flags.map((f, i) => <div key={i} className={`py-2 ${i ? "border-t border-ink-10" : ""}`}><div className="flex items-center justify-between gap-2"><span className="font-thai text-[14.5px] font-medium text-ink">{f.label_th} {f.value}</span><LevelChip domain={f.domain} level="attention" /></div><Sub className="mt-0.5 text-[12.5px]">{f.message}</Sub></div>)}</div>}
          </>
        )}
      </Card>
      {p.coach_note && <Card className="p-4"><Sub>ข้อความจากโค้ช</Sub><p className="mt-1 font-thai text-[14.5px] leading-relaxed text-ink">{p.coach_note}</p></Card>}
      <Sub className="px-2 text-center text-[11.5px] leading-relaxed">{plan.disclaimer}</Sub>
    </div>
  );
}

const Ic = ({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "gold" | "rose" }) => (
  <span className={`mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full ${tone === "gold" ? "bg-[rgba(201,146,43,.18)] text-[#7A5410]" : tone === "rose" ? "bg-rose/10 text-rose" : "bg-wellness/10 text-wellness"}`}>{children}</span>
);
