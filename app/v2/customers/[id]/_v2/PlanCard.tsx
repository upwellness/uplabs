"use client";

/**
 * UP Health Design — care plan card on Customer 360 (SPEC-Health-Design §3.3).
 * Draft → coach edits goals / lifestyle / retest lines → confirm → send (link or LINE).
 * Nothing reaches the customer before "ยืนยัน".
 */
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, RefreshCw, Send, Check, Link2 } from "lucide-react";
import { Card, LoadingState } from "@/lib/v2/ui";
import { DOMAIN_LABEL_TH } from "@/lib/health-design/assess";
import type { HealthPlan } from "@/lib/health-design/plan";

interface StoredPlan {
  id: string; status: "draft" | "confirmed" | "sent" | "archived"; goal: string; draft: HealthPlan; final: HealthPlan | null;
  coach_note: string | null; share_token: string | null; created_at: string; confirmed_at: string | null; sent_at: string | null; sent_via: string | null;
}
const GOAL_TH: Record<string, string> = { loss: "ลดไขมัน/น้ำหนัก", longevity: "ชะลอวัย", muscle: "สร้างกล้ามเนื้อ" };
const AREA_TH: Record<string, string> = { sleep: "นอน", steps: "เดิน", resistance: "แรงต้าน", food_log: "บันทึกอาหาร", cgm: "CGM" };
const STATUS_TH = { draft: "ร่าง — รอโค้ชยืนยัน", confirmed: "ยืนยันแล้ว — ยังไม่ส่ง", sent: "ส่งลูกค้าแล้ว", archived: "เก่า" } as const;

export function PlanCard({ customerId }: { customerId: string }) {
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [shareBase, setShareBase] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // editable sections (only while draft)
  const [goals, setGoals] = useState<HealthPlan["goals_90d"]>([]);
  const [life, setLife] = useState<HealthPlan["lifestyle"]>([]);
  const [retest, setRetest] = useState<HealthPlan["retest"]>([]);
  const [note, setNote] = useState("");

  const hydrate = (p: StoredPlan | null) => {
    setPlan(p);
    const src = p?.final ?? p?.draft;
    setGoals(src?.goals_90d ?? []); setLife(src?.lifestyle ?? []); setRetest(src?.retest ?? []); setNote(p?.coach_note ?? "");
  };
  const load = useCallback(async () => {
    try {
      setState("loading");
      const r = await fetch(`/api/customers/${customerId}/plan`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json(); hydrate(j.plan); setShareBase(j.share_base ?? ""); setState("ready");
    } catch { setState("error"); }
  }, [customerId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (body: Record<string, unknown>, label: string) => {
    setBusy(label); setMsg(null);
    try {
      const r = await fetch(`/api/customers/${customerId}/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "ไม่สำเร็จ"); if (j.url) setMsg(`${j.error} — ${j.url}`); return; }
      hydrate(j.plan);
      if (j.url) setMsg(`ส่งแล้ว (${j.via === "line" ? "LINE" : "ลิงก์"}): ${j.url}`);
    } catch { setMsg("ไม่สำเร็จ"); }
    finally { setBusy(null); }
  };

  const src = plan?.final ?? plan?.draft ?? null;
  const editable = plan?.status === "draft";
  const url = plan?.share_token ? `${shareBase}${plan.share_token}` : null;

  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ClipboardList size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
          <h2 className="font-head text-[15px] font-bold tracking-tight text-ink">แผนดูแล 90 วัน</h2>
        </div>
        <button type="button" onClick={() => act({ action: "draft" }, "draft")} disabled={!!busy || state === "loading"}
          className="inline-flex items-center gap-1 rounded-lg border border-ink-10 px-2 py-1 text-[11px] text-ink-60 hover:border-ink hover:text-ink disabled:opacity-50"
          title="ร่างใหม่จากผลประเมินล่าสุด (ร่างเก่าที่ยังไม่ยืนยันจะถูกแทนที่)">
          <RefreshCw size={12} className={busy === "draft" ? "animate-spin" : ""} aria-hidden /> {plan ? "ร่างใหม่" : "ร่างแผน"}
        </button>
      </div>

      {state === "loading" && <LoadingState label="กำลังโหลดแผน…" />}
      {state === "error" && <p className="text-[12px] text-status-danger">โหลดแผนไม่ได้</p>}
      {state === "ready" && !plan && <p className="text-[12px] text-ink-60">ยังไม่มีแผน — กด "ร่างแผน" ระบบจะร่างจากผลประเมินล่าสุดให้ตรวจ</p>}

      {state === "ready" && plan && src && (
        <>
          <p className="mb-3 text-[12px] text-ink-60">
            <b className={plan.status === "draft" ? "text-status-caution" : "text-status-good"}>{STATUS_TH[plan.status]}</b>
            {" · "}เป้า {GOAL_TH[plan.goal] ?? plan.goal} <span className="text-ink-40">({src.goal_reason})</span>
            {plan.sent_at && <> · ส่งเมื่อ {new Date(plan.sent_at).toLocaleDateString("th-TH")}</>}
          </p>

          <Block title="เป้า 90 วัน">
            {goals.map((g, i) => (
              <div key={i} className="rounded-lg border border-ink-10 p-2">
                <div className="text-[11px] font-semibold text-ink-60">{DOMAIN_LABEL_TH[g.domain]}</div>
                {editable
                  ? <input value={g.target} onChange={(e) => setGoals(goals.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} className="mt-0.5 w-full rounded border border-ink-10 px-2 py-1 text-[12px] focus:border-rose focus:outline-none" />
                  : <div className="mt-0.5 text-[12px] font-semibold text-ink">{g.target}</div>}
                <div className="mt-0.5 text-[11px] text-ink-40">{g.measure}</div>
              </div>
            ))}
          </Block>

          {src.nutrition.targets ? (
            <Block title="อาหาร (Plate Planner)">
              <div className="text-[12px] text-ink">{src.nutrition.targets.kcal} kcal · โปรตีน {src.nutrition.targets.p} g ({src.nutrition.targets.protein_g_per_kg} g/kg) · คาร์บ {src.nutrition.targets.c} g · ไขมัน {src.nutrition.targets.f} g · เมนูตัวอย่าง {src.nutrition.sample_days.length} วัน</div>
              {src.nutrition.notes.slice(1).map((n, i) => <div key={i} className="text-[11px] text-ink-60">• {n}</div>)}
            </Block>
          ) : <Block title="อาหาร"><div className="text-[12px] text-status-caution">{src.caveats.find((c) => c.includes("ส่วนสูง")) ?? "คำนวณเป้าไม่ได้"}</div></Block>}

          <Block title="กิจวัตร">
            {life.map((l, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <span className="w-16 shrink-0 text-ink-60">{AREA_TH[l.area] ?? l.area}</span>
                {editable
                  ? <input value={l.target} onChange={(e) => setLife(life.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} className="w-full rounded border border-ink-10 px-2 py-1 text-[12px] focus:border-rose focus:outline-none" />
                  : <span className="text-ink">{l.target}{l.current ? <span className="text-ink-40"> (ตอนนี้ {l.current})</span> : null}</span>}
              </div>
            ))}
          </Block>

          <Block title="อาหารเสริม (เภสัชกรจัด)">
            <div className="text-[12px] text-ink-60">{src.supplements.schedule?.length ? src.supplements.schedule.map((s) => `${s.meal_slot}: ${s.items.join(", ")}`).join(" · ") : src.supplements.note}</div>
          </Block>

          <Block title="ตรวจซ้ำ">
            {retest.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <span className="w-16 shrink-0 text-ink-60">{t.when_days} วัน</span>
                {editable
                  ? <input value={t.what} onChange={(e) => setRetest(retest.map((x, j) => (j === i ? { ...x, what: e.target.value } : x)))} className="w-full rounded border border-ink-10 px-2 py-1 text-[12px] focus:border-rose focus:outline-none" />
                  : <span className="text-ink">{t.what}</span>}
              </div>
            ))}
          </Block>

          {src.doctor_flags.length > 0 && (
            <Block title="ควรปรึกษาแพทย์">
              {src.doctor_flags.map((f, i) => <div key={i} className="text-[12px] text-status-danger">{f.label_th} {f.value}</div>)}
            </Block>
          )}

          {editable ? (
            <div className="mt-3 space-y-2">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="โน้ตถึงลูกค้า (แสดงบนหน้าแผน) — ไม่บังคับ" className="w-full rounded-lg border border-ink-10 px-2 py-1.5 text-[12px] focus:border-rose focus:outline-none" />
              <button type="button" disabled={!!busy} onClick={() => act({ action: "confirm", plan_id: plan.id, goals_90d: goals, lifestyle: life, retest, coach_note: note || null }, "confirm")}
                className="inline-flex items-center gap-1 rounded-lg bg-rose px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-mid disabled:opacity-50">
                <Check size={13} aria-hidden /> {busy === "confirm" ? "กำลังยืนยัน…" : "ยืนยันแผน (ตรวจแล้ว)"}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {plan.coach_note && <div className="w-full text-[12px] text-ink-60">💬 {plan.coach_note}</div>}
              <button type="button" disabled={!!busy} onClick={() => act({ action: "send", plan_id: plan.id, via: "link" }, "send")}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-10 px-3 py-1.5 text-[12px] text-ink hover:border-ink disabled:opacity-50">
                <Link2 size={13} aria-hidden /> {plan.status === "sent" ? "ส่งลิงก์อีกครั้ง" : "เปิดลิงก์ให้ลูกค้า"}
              </button>
              <button type="button" disabled={!!busy} onClick={() => act({ action: "send", plan_id: plan.id, via: "line" }, "send")}
                className="inline-flex items-center gap-1 rounded-lg bg-wellness px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-wellness-mid disabled:opacity-50">
                <Send size={13} aria-hidden /> {busy === "send" ? "กำลังส่ง…" : "ส่งทาง LINE"}
              </button>
              {url && plan.status === "sent" && <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-ink-60 underline">{url}</a>}
            </div>
          )}
          {msg && <p className="mt-2 break-all text-[11px] text-ink-60">{msg}</p>}
          <p className="mt-3 text-[10px] leading-snug text-ink-40">{src.disclaimer}</p>
        </>
      )}
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="mt-3"><div className="mb-1 text-[12px] font-semibold text-ink-60">{title}</div><div className="space-y-1.5">{children}</div></div>);
}
