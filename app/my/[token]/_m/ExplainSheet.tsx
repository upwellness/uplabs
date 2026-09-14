"use client";

/** D2 · AI อธิบาย (L3) — three fixed answers rephrased from engine facts; falls back to the engine's words. */
import { useEffect, useState } from "react";
import { Sparkles, MessageCircle } from "lucide-react";
import type { PortalData } from "@/lib/health-design/portal-data";
import type { DomainKey } from "@/lib/health-design/assess";
import { Sub, Tag, PrimaryBtn } from "./ui";
import { Sheet, type Nav } from "./Portal";
import { domainLabel } from "./resolve";

type Target = { kind: "overview" } | { kind: "domain"; domain: DomainKey } | { kind: "metric"; domain: DomainKey | null; metric: string };
interface Res { answer: { what: string; where: string; action: string }; ai: boolean; note: string | null; facts: string[]; actions: string[]; disclaimer: string; quota: { used: number; cap: number } }

export function ExplainSheet({ data, nav, target }: { data: PortalData; nav: Nav; target: Target }) {
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showFacts, setShowFacts] = useState(false);
  const close = () => nav.back();

  useEffect(() => {
    let alive = true;
    const body = target.kind === "metric" ? { kind: "metric", domain: target.domain ?? domainGuess(data, target.metric), metric: target.metric } : target;
    fetch(`/api/my/${nav.token}/explain`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(async (r) => { const j = await r.json(); if (!alive) return; if (!r.ok) setErr(j.error ?? "ไม่สำเร็จ"); else setRes(j); })
      .catch(() => alive && setErr("ต่อระบบไม่ได้ — ลองใหม่อีกครั้ง"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(target)]);

  const title = target.kind === "overview" ? "ภาพรวมสุขภาพ 7 ด้าน" : target.kind === "domain" ? domainLabel(target.domain) : (labelOf(data, target.metric) ?? target.metric);

  return (
    <Sheet onClose={close} label={`AI อธิบาย ${title}`} z={50}>
      <div className="flex items-start justify-between gap-3">
        <div><Tag tone="rose">AI อธิบาย · {title}</Tag><h2 className="font-head text-[16px] font-extrabold tracking-tight text-ink">เรียบเรียงจากค่าที่ระบบตัดสินแล้ว</h2></div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose/10 text-rose"><Sparkles className="h-4 w-4" /></span>
      </div>

      {err && <Sub className="mt-4">{err}</Sub>}
      {!res && !err && (
        <div className="mt-4 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i}><div className="h-3 w-24 rounded bg-rose/10" /><div className="mt-2 h-3 w-full rounded bg-ink-5" /><div className="mt-1.5 h-3 w-3/4 rounded bg-ink-5" /></div>)}
          <Sub className="text-[12px]">กำลังเรียบเรียง…</Sub>
        </div>
      )}
      {res && (
        <div className="mt-2">
          {res.note && <div className="mb-2 rounded-xl bg-[rgba(201,146,43,.14)] px-3 py-2 font-thai text-[12.5px] text-[#7A5410]">{res.note}</div>}
          <Q title="ค่านี้คืออะไร">{res.answer.what}</Q>
          <Q title="ของคุณอยู่ตรงไหน">{res.answer.where}</Q>
          <Q title="ทำอะไรได้ (จากแผนที่โค้ชยืนยัน)">{res.answer.action}</Q>
          <button type="button" onClick={() => setShowFacts((s) => !s)} className="mt-3 font-thai text-[12.5px] font-semibold text-wellness">{showFacts ? "ซ่อน" : "ดู"}ข้อมูลที่ AI ได้รับ ›</button>
          {showFacts && <ul className="mt-1 list-disc space-y-0.5 pl-5 font-thai text-[12px] text-ink-60">{[...res.facts, ...res.actions].map((f, i) => <li key={i}>{f}</li>)}</ul>}
          <div className="mt-3 border-t border-dashed border-ink-10 pt-2.5 font-thai text-[11.5px] leading-relaxed text-ink-60">{res.disclaimer} · {res.ai ? `เหลือถาม AI ได้อีก ${Math.max(0, res.quota.cap - res.quota.used)} ครั้งวันนี้` : "ข้อความนี้มาจากระบบ ไม่ได้ผ่าน AI"}</div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <PrimaryBtn tone="ghost" onClick={() => nav.go("#me")}><MessageCircle className="h-4 w-4" />ถามโค้ชต่อ</PrimaryBtn>
        <PrimaryBtn onClick={close}>เข้าใจแล้ว</PrimaryBtn>
      </div>
    </Sheet>
  );
}

const Q = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-3"><div className="font-head text-[13px] font-bold text-rose">{title}</div><p className="mt-1 font-thai text-[15px] leading-relaxed text-ink">{children}</p></div>
);

function labelOf(data: PortalData, metric: string): string | null {
  const a = data.assessment?.a; if (!a) return null;
  for (const k of Object.keys(a.domains) as DomainKey[]) { if (k === "health_age") continue; const d = a.domains[k].drivers.find((x) => x.metric === metric); if (d) return d.label_th; }
  return data.labs.panels.flatMap((p) => p.items).find((i) => i.metric === metric)?.label_th ?? null;
}
function domainGuess(data: PortalData, metric: string): DomainKey {
  const a = data.assessment?.a;
  if (a) for (const k of Object.keys(a.domains) as DomainKey[]) { if (k === "health_age") continue; if (a.domains[k].drivers.some((x) => x.metric === metric)) return k; }
  return "metabolic";
}
