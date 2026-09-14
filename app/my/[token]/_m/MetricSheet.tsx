"use client";

/** D1 · รายละเอียดค่า (L2) — glossary line, range bar with the engine's cut-points, percentile, history, AI button. */
import { useEffect, useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { PortalData } from "@/lib/health-design/portal-data";
import type { DomainKey } from "@/lib/health-design/assess";
import { fmtDateTh, fmtNum, levelShort } from "@/lib/health-design/portal-nav";
import { Sub, Big, LevelChip, PrimaryBtn, Tag, Chip } from "./ui";
import { RangeBar, Sparkline } from "./charts";
import { resolveMetric, domainLabel } from "./resolve";
import { Sheet, type Nav } from "./Portal";

export function MetricSheet({ data, nav, metric, domain }: { data: PortalData; nav: Nav; metric: string; domain: DomainKey | null }) {
  const v = useMemo(() => resolveMetric(data, metric, domain), [data, metric, domain]);
  const close = () => nav.back();
  const aiHash = nav.state.page.startsWith("src-") ? `#src/${nav.state.page.slice(4)}/${metric}/ai` : `#health/${v?.domain ?? domain ?? "metabolic"}/${metric}/ai`;

  // R7: one event per opened sheet
  useEffect(() => { void fetch(`/api/my/${nav.token}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "metric", metric }) }).catch(() => {}); }, [metric, nav.token]);

  if (!v) return <Sheet onClose={close} label="รายละเอียดค่า"><Sub className="py-6 text-center">ไม่พบค่านี้ในผลประเมินล่าสุด</Sub></Sheet>;
  const numeric = typeof v.value === "number" ? v.value : null;
  const dom = v.domain;
  const canAi = !!data.assessment && dom != null && data.assessment.a.domains[dom as Exclude<DomainKey, "health_age">]?.drivers?.some((d) => d.metric === metric);

  return (
    <Sheet onClose={close} label={`รายละเอียด ${v.label_th}`}>
      <div className="flex items-start justify-between gap-3">
        <div>{dom && <Tag>{domainLabel(dom)}</Tag>}<h2 className="font-head text-[20px] font-extrabold tracking-tight text-ink">{v.label_th}</h2></div>
        <button type="button" onClick={close} className="rounded-full border border-ink-10 px-3 py-1 font-thai text-[13px] text-ink">ปิด</button>
      </div>
      {v.glossary ? (
        <p className="mt-2 font-thai text-[14.5px] leading-relaxed text-ink-80">{v.glossary.what_th}{!v.glossary.reviewed && <span className="ml-1.5 inline-block rounded-full bg-[rgba(201,146,43,.16)] px-2 py-px font-head text-[10.5px] font-bold text-[#7A5410]">รอเภสัชกรตรวจทาน</span>}</p>
      ) : <Sub className="mt-2">ยังไม่มีคำอธิบายสำหรับค่านี้ — ถามโค้ชได้</Sub>}

      <div className="mt-3 flex items-end justify-between">
        <Big value={numeric != null ? fmtNum(numeric, 2) : v.value ?? "—"} unit={v.unit ?? undefined} />
        <LevelChip domain={dom} level={v.level} text={v.level == null ? "ใช้ดูแนวโน้ม" : levelShort(dom, v.level)} />
      </div>
      {v.recorded_at && <Sub className="mt-1 text-[12px]">วัดเมื่อ {fmtDateTh(v.recorded_at, data.today)}</Sub>}

      {v.bands && numeric != null && (
        <div className="mt-3">
          <RangeBar value={numeric} bands={v.bands} />
          <Sub className="mt-1.5 text-[12px]">เกณฑ์: {v.glossary?.source ?? "ระบบ UP Labs"}</Sub>
        </div>
      )}
      {!v.bands && v.glossary?.trend_only && <Sub className="mt-2 text-[12px]">ค่านี้ไม่มีเกณฑ์กลางสำหรับตัดสิน — ดูว่าเปลี่ยนจากของตัวเองไหม</Sub>}
      {v.reference && <Sub className="mt-1.5 text-[12px]">เทียบประชากร: สูงกว่า {v.reference.percentile}% ของ{v.reference.band} ({v.reference.source}) — เป็นตำแหน่ง ไม่ใช่คำตัดสิน</Sub>}
      {v.note && <Sub className="mt-1.5 text-[12px]">หมายเหตุ: {v.note}</Sub>}

      {v.history.length > 1 && (
        <div className="mt-3 rounded-2xl bg-wellness/[0.07] px-3 pb-1 pt-2.5">
          <div className="flex items-center justify-between"><Sub>ประวัติ · {v.history.length} ครั้ง</Sub>{(() => { const d = v.history[v.history.length - 1].value - v.history[0].value; return <Chip tone="muted">{d > 0 ? "↑" : d < 0 ? "↓" : "→"} {fmtNum(Math.abs(Math.round(d * 10) / 10))} ตั้งแต่ {fmtDateTh(v.history[0].at, data.today)}</Chip>; })()}</div>
          <Sparkline values={v.history.map((h) => h.value)} labels={v.history.map((h) => fmtDateTh(h.at, data.today))} target={v.bands?.find((b) => b.level === "good")?.to ?? null} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {canAi && <PrimaryBtn tone="rose" onClick={() => nav.go(aiHash)}><Sparkles className="h-4 w-4" />ให้ AI อธิบายค่านี้</PrimaryBtn>}
        {v.source_page && v.source_page !== "food" && !nav.state.page.startsWith("src-") && <PrimaryBtn tone="ghost" onClick={() => nav.go(`#src/${v.source_page!.slice(4)}`)}>ดูทั้งหมดในหน้าแหล่งข้อมูล</PrimaryBtn>}
      </div>
    </Sheet>
  );
}
