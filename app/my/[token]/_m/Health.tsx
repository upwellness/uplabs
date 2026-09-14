"use client";

/** S2 · สุขภาพ (L1) — one row per assessed domain, expanding in place to its drivers. */
import { Sparkles } from "lucide-react";
import type { PortalData } from "@/lib/health-design/portal-data";
import type { DomainKey } from "@/lib/health-design/assess";
import { fmtDateTh, fmtNum, levelShort } from "@/lib/health-design/portal-nav";
import { Card, Sub, Dot, LevelChip, Row, Val, Empty } from "./ui";
import { DOMAIN_ORDER, DOMAIN_SOURCE_PAGE, domainLabel, domainSummary } from "./resolve";
import { TopBar, type Nav } from "./Portal";

const SRC_LABEL: Record<string, string> = { "src-labs": "ผลเลือดทั้งหมด", "src-bca": "ประวัติ BCA", "src-cgm": "กราฟน้ำตาล", "src-wearable": "นาฬิกา 14 วัน", food: "บันทึกอาหาร" };
const srcHash = (p: string) => (p === "food" ? "#food" : `#src/${p.slice(4)}`);

export function HealthScreen({ data, nav }: { data: PortalData; nav: Nav }) {
  const a = data.assessment?.a ?? null;
  const open = nav.state.domain;
  const toggle = (k: DomainKey) => nav.go(open === k ? "#health" : `#health/${k}`);

  return (
    <div className="flex flex-col gap-2.5">
      <TopBar title="สุขภาพ" />
      {!a ? <Card className="p-4"><Empty>ยังไม่มีผลประเมิน — เริ่มจากส่งผลเลือดหรือชั่ง BCA กับโค้ช</Empty></Card> : (
        <Card className="px-4 py-1">
          {DOMAIN_ORDER.map((k, i) => {
            const isAge = k === "health_age";
            const level = isAge ? a.domains.health_age.level : a.domains[k].level;
            const expanded = open === k;
            const right = isAge && a.domains.health_age.phenoage != null
              ? <span className="font-thai text-[13px] text-ink-60"><b className="font-head text-[15px] text-ink">{a.domains.health_age.phenoage}</b> ปี <span className="text-ink-40">(จริง {a.domains.health_age.chrono_age})</span></span>
              : !isAge && a.domains[k].drivers.length === 0 ? <Sub>ยังไม่มีข้อมูล</Sub> : undefined;
            return (
              <div key={k} className={expanded ? "-mx-4 rounded-2xl bg-wellness/[0.06] px-4" : ""}>
                <Row first={i === 0 && !expanded} expanded={expanded} onClick={() => toggle(k)}
                  left={<><Dot level={level} /><span className={expanded ? "font-semibold" : ""}>{domainLabel(k)}</span></>} right={right} />
                {expanded && (
                  <div className="pb-3 pl-4">
                    {isAge ? <HealthAge data={data} nav={nav} /> : <DomainBody data={data} nav={nav} k={k} />}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <Card as="button" onClick={() => nav.go("#src/labs")} className="px-4 py-3">
        <Row first left={<span className="font-thai text-[13px] text-ink-60">แหล่งข้อมูล: ผลเลือด {fmtDateTh(data.labs.latest_at, data.today)} · BCA {fmtDateTh(data.bca[0]?.at, data.today)} · CGM {fmtDateTh(data.cgm?.window.to, data.today)} · นาฬิกา {fmtDateTh(data.wearable.connection?.last_sync_at ?? data.wearable.days.at(-1)?.date, data.today)}</span>} onClick={() => nav.go("#src/labs")} />
      </Card>
    </div>
  );
}

function DomainBody({ data, nav, k }: { data: PortalData; nav: Nav; k: Exclude<DomainKey, "health_age"> }) {
  const d = data.assessment!.a.domains[k];
  const pages = DOMAIN_SOURCE_PAGE[k].filter((p): p is NonNullable<typeof p> => !!p).filter((p) => (p === "src-cgm" ? !!data.cgm : p === "src-bca" ? data.bca.length > 0 : p === "src-wearable" ? data.wearable.days.length > 0 : p === "src-labs" ? data.labs.panels.length > 0 : true));
  return (
    <>
      <Sub className="leading-relaxed">{domainSummary(data, k)}</Sub>
      {d.drivers.length > 0 && (
        <div className="mt-1">
          {d.drivers.map((drv, i) => (
            <Row key={drv.metric} first={i === 0} onClick={() => nav.go(`#health/${k}/${drv.metric}`)}
              left={<span className="font-thai text-[14px]">{drv.label_th}</span>}
              right={<><Val value={typeof drv.value === "number" ? fmtNum(drv.value) : drv.value} unit={drv.unit ?? undefined} /><LevelChip domain={k} level={drv.level} text={drv.level == null ? "แนวโน้ม" : levelShort(k, drv.level)} /></>} />
          ))}
        </div>
      )}
      {d.caveats.length > 0 && <Sub className="mt-1 text-[12px]">{d.caveats.join(" · ")}</Sub>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {pages.map((p) => <button key={p} type="button" onClick={() => nav.go(srcHash(p))} className="font-thai text-[13.5px] font-semibold text-wellness">{SRC_LABEL[p]} ›</button>)}
        {d.drivers.length > 0 && <button type="button" onClick={() => nav.go(`#health/${k}/ai`)} className="inline-flex items-center gap-1 font-thai text-[13.5px] font-semibold text-rose"><Sparkles className="h-3.5 w-3.5" />ให้ AI อธิบายด้านนี้</button>}
      </div>
    </>
  );
}

function HealthAge({ data, nav }: { data: PortalData; nav: Nav }) {
  const h = data.assessment!.a.domains.health_age;
  if (h.phenoage == null) return <Sub className="leading-relaxed">ยังคำนวณไม่ได้ — {h.caveats[0] ?? "ต้องมีผลเลือดชุดที่ใช้คำนวณ (PhenoAge 9 ค่า)"}</Sub>;
  return (
    <>
      <Sub className="leading-relaxed">อายุสุขภาพ (PhenoAge) {h.phenoage} ปี เทียบอายุจริง {h.chrono_age} ปี — {h.delta != null && h.delta < 0 ? `อ่อนกว่า ${Math.abs(h.delta)} ปี` : h.delta != null && h.delta > 0 ? `แก่กว่า ${h.delta} ปี` : "เท่ากับอายุจริง"}{h.mode === "hybrid" ? ` · ประมาณบางค่า (${h.imputed.join(", ")})` : ""}</Sub>
      {h.caveats.length > 0 && <Sub className="mt-1 text-[12px]">{h.caveats.join(" · ")}</Sub>}
      <div className="mt-2 flex gap-4"><button type="button" onClick={() => nav.go("#src/labs")} className="font-thai text-[13.5px] font-semibold text-wellness">ผลเลือดที่ใช้ ›</button><button type="button" onClick={() => nav.go("#health/health_age/ai")} className="inline-flex items-center gap-1 font-thai text-[13.5px] font-semibold text-rose"><Sparkles className="h-3.5 w-3.5" />ให้ AI อธิบาย</button></div>
    </>
  );
}
