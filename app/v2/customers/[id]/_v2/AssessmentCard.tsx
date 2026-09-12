"use client";

/**
 * UP Health Design — 7-domain assessment card on Customer 360.
 * Reads /api/customers/[id]/assessment (computed on demand the first time) and
 * renders each domain as its own status, never a combined number (SPEC-Health-Design §3.1).
 */
import { useCallback, useEffect, useState } from "react";
import { Compass, RefreshCw, AlertTriangle, Link2 } from "lucide-react";
import { Card, LoadingState } from "@/lib/v2/ui";
import { statusClasses, statusHex } from "@/lib/medical-status";
import type { HealthAssessment, Level, DomainKey } from "@/lib/health-design/assess";

const LABEL: Record<DomainKey, string> = {
  metabolic: "น้ำตาล/เมตาบอลิซึม", body_comp: "องค์ประกอบร่างกาย", cardio_lipid: "ไขมัน/หัวใจ",
  liver_kidney: "ตับ/ไต", recovery: "นอน/ฟื้นตัว", nutrition: "โภชนาการ", health_age: "อายุสุขภาพ",
};
const LEVEL_TH: Record<Level, string> = { good: "ดี", watch: "ควรติดตาม", attention: "ควรปรึกษาแพทย์" };
const LEVEL_STATUS: Record<Level, keyof typeof statusHex> = { good: "good", watch: "caution", attention: "danger" };
const SOURCE_TH: Record<string, string> = { labs: "แล็บ", bca: "BCA", cgm: "CGM", wearable: "นาฬิกา", food: "อาหาร", labs_panel: "แล็บ", health_age: "อายุสุขภาพ" };
const CONF_TH = { high: "เชื่อถือได้สูง", medium: "ปานกลาง", low: "ต่ำ" } as const;

interface Stored { computed_at: string; trigger: string; assessment: HealthAssessment }

export function AssessmentCard({ customerId }: { customerId: string }) {
  const [data, setData] = useState<Stored | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [portal, setPortal] = useState<string | null>(null);
  const portalLink = async (rotate = false) => {
    try {
      const r = await fetch(`/api/customers/${customerId}/portal-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rotate }) });
      const j = await r.json(); if (r.ok) { setPortal(j.url); try { await navigator.clipboard.writeText(j.url); } catch { /* clipboard may be unavailable */ } }
    } catch { /* ignore */ }
  };

  const load = useCallback(async (recompute = false) => {
    try {
      if (recompute) setBusy(true); else setState("loading");
      const res = await fetch(`/api/customers/${customerId}/assessment`, { method: recompute ? "POST" : "GET", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      setData(j.latest ?? null);
      setState("ready");
    } catch { setState("error"); }
    finally { setBusy(false); }
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  const a = data?.assessment;
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Compass size={15} strokeWidth={2.25} className="text-wellness" aria-hidden />
          <h2 className="font-head text-[15px] font-bold tracking-tight text-ink">ผลประเมินสุขภาพรวม</h2>
        </div>
        <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => portalLink(false)} title="สร้าง/คัดลอกลิงก์หน้าลูกค้า (/my/…) — ลูกค้าดูผลประเมิน แผน บันทึกอาหาร อัปโหลด CGM เองได้"
          className="inline-flex items-center gap-1 rounded-lg border border-ink-10 px-2 py-1 text-[11px] text-ink-60 hover:border-ink hover:text-ink">
          <Link2 size={12} aria-hidden /> ลิงก์ลูกค้า
        </button>
        <button type="button" onClick={() => load(true)} disabled={busy || state === "loading"}
          className="inline-flex items-center gap-1 rounded-lg border border-ink-10 px-2 py-1 text-[11px] text-ink-60 hover:border-ink hover:text-ink disabled:opacity-50"
          title="ประเมินใหม่จากข้อมูลล่าสุด">
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} aria-hidden /> ประเมินใหม่
        </button>
        </div>
      </div>
      {portal && (
        <p className="mb-2 break-all text-[11px] text-ink-60">คัดลอกแล้ว: <a href={portal} target="_blank" rel="noreferrer" className="underline">{portal}</a>
          <button type="button" onClick={() => portalLink(true)} className="ml-2 text-status-danger underline">เปลี่ยนลิงก์ใหม่ (ลิงก์เดิมใช้ไม่ได้)</button></p>
      )}

      {state === "loading" && <LoadingState label="กำลังประเมิน…" />}
      {state === "error" && <p className="text-[12px] text-status-danger">โหลดผลประเมินไม่ได้ — ลองใหม่อีกครั้ง</p>}

      {state === "ready" && a && (
        <>
          <p className="mb-3 text-[12px] text-ink-60">
            จาก {a.sources_used.length ? a.sources_used.map((s) => SOURCE_TH[s]).join(" · ") : "— ยังไม่มีข้อมูล —"}
            {" · "}ความเชื่อมั่น <b className="text-ink">{CONF_TH[a.confidence]}</b>
            {" · "}{new Date(data!.computed_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
          </p>

          {/* 7 domains — each its own light; deliberately no total */}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {(Object.keys(LABEL) as DomainKey[]).map((k) => {
              const d = a.domains[k];
              const level: Level | null = k === "health_age" ? a.domains.health_age.level : (d as any).level;
              const s = level ? LEVEL_STATUS[level] : null;
              const sub = k === "health_age"
                ? (a.domains.health_age.phenoage != null ? `${a.domains.health_age.phenoage} ปี (${a.domains.health_age.delta! > 0 ? "+" : ""}${a.domains.health_age.delta})${a.domains.health_age.mode === "hybrid" ? " ≈" : ""}` : "ยังคำนวณไม่ได้")
                : (d as any).drivers.length ? `${(d as any).drivers.length} ค่า` : "ไม่มีข้อมูล";
              return (
                <li key={k} className={`rounded-xl border p-2.5 ${s ? `${statusClasses.bg[s]} ${statusClasses.text[s]} ${statusClasses.ring[s]} ring-1 border-transparent` : "border-ink-10 bg-ink-5 text-ink-40"}`}
                  title={level ? LEVEL_TH[level] : "ยังไม่มีข้อมูล — ไม่ได้แปลว่าปกติ"}>
                  <div className="text-[11px] font-semibold leading-tight">{LABEL[k]}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: s ? statusHex[s] : "#c4c0b8" }} aria-hidden />
                    {level ? LEVEL_TH[level] : "ไม่มีข้อมูล"}
                  </div>
                  <div className="mt-0.5 text-[10px] opacity-80">{sub}</div>
                </li>
              );
            })}
          </ul>

          {a.priorities.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[12px] font-semibold text-ink-60">ควรทำก่อน</div>
              {a.priorities.map((p) => (
                <div key={p.rank} className="flex gap-2 text-[12px] leading-snug text-ink">
                  <span className="shrink-0 font-mono text-ink-40">{p.rank}.</span>
                  <span>{p.why}</span>
                </div>
              ))}
            </div>
          )}

          <details className="mt-3 text-[11px] text-ink-60">
            <summary className="cursor-pointer select-none">ค่าที่ใช้ประเมิน + ตำแหน่งเทียบคนวัยเดียวกัน</summary>
            <ul className="mt-1.5 space-y-0.5">
              {(["metabolic", "body_comp", "cardio_lipid", "liver_kidney", "recovery", "nutrition"] as const).flatMap((k) =>
                (a.domains[k] as any).drivers.map((d: any, i: number) => (
                  <li key={`${k}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: d.level ? statusHex[LEVEL_STATUS[d.level as Level]] : "#c4c0b8" }} aria-hidden />
                    <span className="text-ink">{d.label_th}</span>
                    <span className="font-mono">{d.value}{d.unit ? ` ${d.unit}` : ""}</span>
                    {d.reference && <span className="rounded bg-ink-5 px-1 font-mono text-[10px]" title={d.reference.note}>P{d.reference.percentile} · {d.reference.band}</span>}
                    <span className="text-ink-40">{SOURCE_TH[d.source]}{d.recorded_at ? ` ${String(d.recorded_at).slice(0, 10)}` : ""}</span>
                  </li>
                )))}
            </ul>
            <p className="mt-1 text-[10px] text-ink-40">P = เปอร์เซ็นไทล์เทียบเพศ/ช่วงอายุเดียวกันในฐานอ้างอิง (NHANES สหรัฐ) — บอกตำแหน่ง ไม่ใช่เกณฑ์สุขภาพ</p>
          </details>

          {a.data_gaps.length > 0 && (
            <details className="mt-3 text-[11px] text-ink-60">
              <summary className="cursor-pointer select-none">
                <AlertTriangle size={11} className="mr-1 inline text-status-caution" aria-hidden />
                ข้อมูลที่ยังขาด {a.data_gaps.length} รายการ — ไม่มีข้อมูล ≠ ปกติ
              </summary>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {a.data_gaps.map((g, i) => <li key={i}><b>{SOURCE_TH[g.source] ?? g.source}:</b> {g.reason}</li>)}
              </ul>
            </details>
          )}
          <p className="mt-3 text-[10px] leading-snug text-ink-40">{a.disclaimer}</p>
        </>
      )}
    </Card>
  );
}
