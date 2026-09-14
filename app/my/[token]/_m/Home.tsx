"use client";

/** S1 · หน้าแรก (L0) — three blocks and one button; everything deeper is a tap away. */
import { Sparkles, ChevronRight } from "lucide-react";
import type { PortalData } from "@/lib/health-design/portal-data";
import type { DomainKey, Level } from "@/lib/health-design/assess";
import { fmtDateTh, fmtNum, fmtTimeTh, levelColor } from "@/lib/health-design/portal-nav";
import { Card, Sub, Big, Chip, PrimaryBtn, Empty } from "./ui";
import { DOMAIN_ORDER, domainLabel } from "./resolve";
import type { Nav } from "./Portal";

const levelOf = (data: PortalData, k: DomainKey): Level | null => {
  const a = data.assessment?.a; if (!a) return null;
  return k === "health_age" ? a.domains.health_age.level : a.domains[k].level;
};

export function HomeScreen({ data, nav }: { data: PortalData; nav: Nav }) {
  const a = data.assessment?.a ?? null;
  const levels = DOMAIN_ORDER.map((k) => ({ k, level: levelOf(data, k) }));
  const n = (l: Level | null) => levels.filter((x) => x.level === l).length;
  const lastWear = [...data.wearable.days].reverse();
  const stepsDay = lastWear.find((d) => d.steps != null) ?? null;
  const sleepDay = lastWear.find((d) => d.sleep_min != null) ?? null;
  const glucose = data.cgm?.metrics.mean ?? null;
  const todayFood = data.food.summary.days.find((d) => d.date === data.today) ?? null;
  const plan = data.plan;
  const lifestyle = plan?.plan.lifestyle[0] ?? null;
  const dayStr = new Date(`${data.today}T12:00:00+07:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1 pt-1">
        <div>
          <Sub>{dayStr}</Sub>
          <h1 className="font-head text-[22px] font-extrabold tracking-tight text-ink">สวัสดีคุณ{data.customer.first_name}</h1>
        </div>
        <button type="button" onClick={() => nav.go("#me")} aria-label="หน้าของฉัน" className="grid h-10 w-10 place-items-center rounded-full bg-wellness/10 font-head text-[16px] font-extrabold text-wellness">{data.customer.initial}</button>
      </div>

      {/* ① 7 domains as one strip */}
      <Card as="button" onClick={() => nav.go("#health")} className="p-4">
        <div className="flex items-center justify-between"><h2 className="font-head text-[15px] font-bold text-ink">สุขภาพ 7 ด้าน</h2>{data.assessment && <Sub>อัปเดต {fmtDateTh(data.assessment.computed_at, data.today)} {fmtTimeTh(data.assessment.computed_at)}</Sub>}</div>
        {!a ? <Empty>ยังไม่มีข้อมูลพอจะประเมิน — เริ่มจากส่งผลเลือดหรือชั่ง BCA กับโค้ช หรือบันทึกอาหารที่แท็บอาหาร</Empty> : (
          <>
            <div className="mt-2.5 flex gap-1.5" aria-label="ระดับแต่ละด้าน">
              {levels.map(({ k, level }) => <span key={k} title={domainLabel(k)} className="h-[22px] flex-1 rounded-[8px]" style={{ background: levelColor(level) }} />)}
            </div>
            <div className="mt-2 flex items-center justify-between font-thai text-[14px] text-ink">
              <span>{n("attention") ? <b>ต้องใส่ใจ {n("attention")} · </b> : null}{n("watch") ? <b>ควรติดตาม {n("watch")}</b> : null}{n("watch") || n("attention") ? " · " : ""}ดี {n("good")}{n(null) ? ` · ยังไม่มีข้อมูล ${n(null)}` : ""}</span>
              <ChevronRight className="h-4 w-4 text-ink-40" />
            </div>
          </>
        )}
      </Card>

      {/* ② today's three numbers */}
      <Card className="px-3 py-3">
        <div className="grid grid-cols-3 text-center">
          <button type="button" onClick={() => nav.go("#src/wearable")} className="px-1">
            <Big value={stepsDay ? fmtNum(stepsDay.steps, 0) : "—"} className="!text-[21px]" />
            <Sub className="mt-1">ก้าว{stepsDay ? ` · ${fmtDateTh(stepsDay.date, data.today)}` : ""}</Sub>
          </button>
          <button type="button" onClick={() => nav.go("#src/wearable")} className="border-x border-ink-10 px-1">
            <Big value={sleepDay ? fmtNum(Math.round((sleepDay.sleep_min! / 60) * 10) / 10) : "—"} unit={sleepDay ? "ชม." : undefined} className="!text-[21px]" />
            <Sub className="mt-1">นอน{sleepDay ? ` · ${fmtDateTh(sleepDay.date, data.today)}` : ""}</Sub>
          </button>
          <button type="button" onClick={() => nav.go("#src/cgm")} className="px-1">
            <Big value={glucose != null ? fmtNum(Math.round(glucose), 0) : "—"} className="!text-[21px]" />
            <Sub className="mt-1">น้ำตาลเฉลี่ย{data.cgm ? ` · ${fmtDateTh(data.cgm.window.to, data.today)}` : ""}</Sub>
          </button>
        </div>
      </Card>

      {/* ③ do next, from the confirmed plan */}
      {plan ? (
        <Card solid as="button" onClick={() => nav.go("#plan")} className="p-4">
          <Sub light>ทำต่อวันนี้ · แผนวันที่ {plan.progress?.day ?? 0}/90</Sub>
          <div className="mt-0.5 font-thai text-[16px] font-semibold leading-snug">{lifestyle?.target ?? plan.plan.goals_90d[0]?.target ?? "ดูแผนของคุณ"}</div>
          <div className="mt-2.5 flex items-center justify-between">
            <Chip tone="white">{todayFood && data.food.targets ? `โปรตีนวันนี้ ${fmtNum(Math.round(todayFood.protein_g), 0)} / ${fmtNum(Math.round(data.food.targets.protein_g), 0)} g` : todayFood ? `วันนี้บันทึก ${todayFood.entries} มื้อ` : "วันนี้ยังไม่ได้บันทึกอาหาร"}</Chip>
            <ChevronRight className="h-4 w-4 text-white/80" />
          </div>
        </Card>
      ) : (
        <Card as="button" onClick={() => nav.go("#food")} className="p-4">
          <Sub>ยังไม่มีแผน 90 วัน — โค้ชจะร่างให้หลังมีผลประเมิน</Sub>
          <div className="mt-0.5 font-thai text-[15px] font-semibold text-ink">ระหว่างนี้ บันทึกอาหารได้เลย{todayFood ? ` · วันนี้ ${todayFood.entries} มื้อ` : ""}</div>
        </Card>
      )}

      {a && <PrimaryBtn tone="rose" onClick={() => nav.go("#home/ai")}><Sparkles className="h-4 w-4" />ให้ AI สรุปภาพรวมของฉัน</PrimaryBtn>}
      {a && a.data_gaps.length > 0 && <Sub className="px-2 text-center">ยังขาด: {a.data_gaps.map((g) => g.reason).slice(0, 2).join(" · ")}</Sub>}
    </div>
  );
}
