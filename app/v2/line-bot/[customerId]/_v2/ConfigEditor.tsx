"use client";

/**
 * UP Labs v2 · LINE Bot ConfigEditor (clinical-warm)
 * ───────────────────────────────────────────────────
 * Redesign of v1 app/line-bot/[customerId]/ConfigEditor.tsx. Same API contract:
 *   GET/PUT /api/line-bot/config/[customerId]        (goal · config · seed · even3 · plan_len)
 *   GET/PUT /api/line-bot/supplements/[customerId]   (rows: meal_slot · items[])
 * Two save buttons (plate config / supplements), each with explicit save state.
 */

import { useEffect, useState } from "react";
import { Loader2, Check, AlertTriangle, Salad, Pill, Beaker } from "lucide-react";
import type { Goal, Diet, Allergy, PlanConfig } from "@/lib/plate-planner/engine";
import { Card } from "@/lib/v2/ui";

/* ── option metadata (labels mirror the Plate Planner UI / v1 ConfigEditor) ── */
const GOAL_OPTS: { v: Goal; label: string; hint: string }[] = [
  { v: "loss", label: "ลดน้ำหนัก", hint: "27 kcal × น้ำหนักเหมาะสม" },
  { v: "longevity", label: "Longevity", hint: "34 kcal · โปรตีนสูง คาร์บ ≤130" },
  { v: "muscle", label: "เพิ่มกล้าม", hint: "40 kcal · โปรตีน 2.2 ก./กก." },
];
const DIET_OPTS: { v: Diet; label: string }[] = [
  { v: "none", label: "ไม่จำกัด" },
  { v: "halal", label: "ฮาลาล (ไม่หมู)" },
  { v: "nopork", label: "ไม่กินหมู" },
  { v: "nobeef", label: "ไม่กินเนื้อวัว" },
  { v: "noredmeat", label: "ไม่กินเนื้อแดง" },
  { v: "vegetarian", label: "มังสวิรัติ (มีไข่/นม)" },
  { v: "vegan", label: "วีแกน (พืชล้วน)" },
];
const ALLERGY_OPTS: { v: Allergy; label: string }[] = [
  { v: "seafood", label: "อาหารทะเล (กุ้ง/หอย/ปู)" },
  { v: "fish", label: "ปลา" },
  { v: "nuts", label: "ถั่วเปลือกแข็ง" },
  { v: "soy", label: "ถั่วเหลือง" },
  { v: "dairy", label: "นม" },
  { v: "egg", label: "ไข่" },
  { v: "sesame", label: "งา" },
  { v: "gluten", label: "กลูเตน" },
];
const PLAN_LEN_OPTS = [7, 30, 49];
const SUPP_SLOTS = ["เช้า", "กลางวัน", "เย็น", "ของว่าง"] as const;

export function ConfigEditor({ customerId }: { customerId: string }) {
  /* config state */
  const [goal, setGoal] = useState<Goal>("longevity");
  const [diet, setDiet] = useState<Diet>("none");
  const [noVeg, setNoVeg] = useState(false);
  const [allergy, setAllergy] = useState<Allergy[]>([]);
  const [shakeOn, setShakeOn] = useState(false);
  const [shakeBk, setShakeBk] = useState(false);
  const [shakeDn, setShakeDn] = useState(false);
  const [lockW, setLockW] = useState(false);
  const [seed, setSeed] = useState("1");
  const [even3, setEven3] = useState(false);
  const [planLen, setPlanLen] = useState(30);

  /* supplements state: slot → multiline text (one item per line) */
  const [supp, setSupp] = useState<Record<string, string>>({ เช้า: "", กลางวัน: "", เย็น: "", ของว่าง: "" });

  const [loading, setLoading] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [savingSup, setSavingSup] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);
  const [supMsg, setSupMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [cfgRes, supRes] = await Promise.all([
          fetch(`/api/line-bot/config/${customerId}`),
          fetch(`/api/line-bot/supplements/${customerId}`),
        ]);
        const cfgJson = await cfgRes.json();
        const supJson = await supRes.json();
        if (!cfgRes.ok) throw new Error(cfgJson.error ?? "โหลด config ไม่สำเร็จ");
        if (!supRes.ok) throw new Error(supJson.error ?? "โหลดวิตามินไม่สำเร็จ");
        if (cancelled) return;

        const c = cfgJson.config;
        if (c) {
          if (c.goal) setGoal(c.goal);
          setSeed(String(c.seed ?? 1));
          setEven3(!!c.even3);
          setPlanLen(PLAN_LEN_OPTS.includes(c.plan_len) ? c.plan_len : 30);
          const cfg: PlanConfig = (c.config && typeof c.config === "object" ? c.config : {}) as PlanConfig;
          setDiet((cfg.diet as Diet) ?? "none");
          setNoVeg(!!cfg.noVeg);
          setAllergy(Array.isArray(cfg.allergy) ? cfg.allergy : []);
          setLockW(!!cfg.lockW);
          setShakeOn(!!cfg.shake?.on);
          setShakeBk(!!cfg.shake?.breakfast);
          setShakeDn(!!cfg.shake?.dinner);
        }

        const rows: { meal_slot: string; items: string[] }[] = supJson.rows ?? [];
        const next: Record<string, string> = { เช้า: "", กลางวัน: "", เย็น: "", ของว่าง: "" };
        for (const r of rows) next[r.meal_slot] = (r.items ?? []).join("\n");
        setSupp(next);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "เกิดข้อผิดพลาด");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  const toggleAllergy = (a: Allergy) =>
    setAllergy((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const saveConfig = async () => {
    setSavingCfg(true);
    setCfgMsg(null);
    setError(null);
    try {
      const config: PlanConfig = {};
      if (diet !== "none") config.diet = diet;
      if (noVeg) config.noVeg = true;
      if (allergy.length) config.allergy = allergy;
      if (lockW) config.lockW = true;
      if (shakeOn) config.shake = { on: true, breakfast: shakeBk, dinner: shakeDn };

      const res = await fetch(`/api/line-bot/config/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, config, seed: seed === "" ? 1 : Number(seed), even3, plan_len: planLen }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      setCfgMsg("บันทึกแผนแล้ว");
    } catch (e: any) {
      setError(e.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSavingCfg(false);
    }
  };

  const saveSupplements = async () => {
    setSavingSup(true);
    setSupMsg(null);
    setError(null);
    try {
      const rows = SUPP_SLOTS.map((slot, i) => ({
        meal_slot: slot,
        items: (supp[slot] ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
        sort: i,
      })).filter((r) => r.items.length > 0);

      const res = await fetch(`/api/line-bot/supplements/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      setSupMsg(`บันทึกวิตามินแล้ว · ${json.count} มื้อ`);
    } catch (e: any) {
      setError(e.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSavingSup(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-44 animate-pulse rounded-2xl border border-ink-10 bg-white" />
        <div className="h-56 animate-pulse rounded-2xl border border-ink-10 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-status-danger/20 bg-status-bg-danger px-4 py-3 text-[13px] text-status-danger">
          <AlertTriangle size={15} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </div>
      )}

      {/* ── Section 1 · Plate config ───────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={Salad} title="แผนอาหาร (Plate config)" sub="ค่าที่ป้อนให้ engine · ตรงกับ Plate Planner" />
        <div className="space-y-5 p-4 lg:p-5">
          {/* goal */}
          <div>
            <Label>เป้าหมาย</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {GOAL_OPTS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={goal === o.v}
                  onClick={() => setGoal(o.v)}
                  className={`min-h-[44px] rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2 ${
                    goal === o.v ? "border-wellness bg-wellness-ultra" : "border-ink-10 bg-white hover:border-ink-20"
                  }`}
                >
                  <div className={`text-[14px] font-bold ${goal === o.v ? "text-wellness" : "text-ink"}`}>{o.label}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-ink-60">{o.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* diet */}
          <div>
            <Label>ข้อจำกัดอาหาร (diet)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DIET_OPTS.map((o) => (
                <Chip key={o.v} active={diet === o.v} onClick={() => setDiet(o.v)}>{o.label}</Chip>
              ))}
            </div>
          </div>

          {/* allergy */}
          <div>
            <Label>แพ้อาหาร (เลือกได้หลายอย่าง)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALLERGY_OPTS.map((o) => (
                <Chip key={o.v} active={allergy.includes(o.v)} onClick={() => toggleAllergy(o.v)} checkable>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* toggles */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Toggle checked={noVeg} onChange={setNoVeg} label="ไม่กินผัก (noVeg)" />
            <Toggle checked={lockW} onChange={setLockW} label="ล็อกน้ำหนักคำนวณ (lockW)" />
            <Toggle checked={even3} onChange={setEven3} label="3 มื้อเท่ากัน (even3)" />
          </div>

          {/* shake */}
          <div className="rounded-xl border border-ink-10 bg-surface p-4">
            <Toggle checked={shakeOn} onChange={setShakeOn} label="ใส่โปรตีนเชค Nutrilite (shake)" />
            {shakeOn && (
              <div className="mt-3 flex flex-wrap gap-2 pl-1">
                <Chip active={shakeBk} onClick={() => setShakeBk((v) => !v)} checkable>เชคมื้อเช้า</Chip>
                <Chip active={shakeDn} onClick={() => setShakeDn((v) => !v)} checkable>เชคมื้อเย็น</Chip>
              </div>
            )}
          </div>

          {/* seed + plan_len */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <Label>Seed (ล็อกเมนูคงที่)</Label>
              <input
                type="number"
                value={seed}
                min={0}
                onChange={(e) => setSeed(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-wellness focus:ring-2 focus:ring-wellness/15"
              />
            </label>
            <div>
              <Label>ความยาวแผน (วันก่อนวนซ้ำ)</Label>
              <div className="mt-1.5 flex gap-2">
                {PLAN_LEN_OPTS.map((n) => (
                  <Chip key={n} active={planLen === n} onClick={() => setPlanLen(n)}>{n} วัน</Chip>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <SaveBtn onClick={saveConfig} busy={savingCfg}>บันทึกแผน</SaveBtn>
            {cfgMsg && <SavedNote>{cfgMsg}</SavedNote>}
          </div>
        </div>
      </Card>

      {/* ── Section 2 · Supplements ────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={Pill} title="วิตามิน/อาหารเสริมต่อมื้อ" sub="หนึ่งบรรทัด = หนึ่งรายการ · เช่น Double X 1 ชุด" />
        <div className="space-y-4 p-4 lg:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SUPP_SLOTS.map((slot) => (
              <label key={slot} className="block">
                <Label>มื้อ{slot}</Label>
                <textarea
                  value={supp[slot] ?? ""}
                  onChange={(e) => setSupp((prev) => ({ ...prev, [slot]: e.target.value }))}
                  rows={4}
                  placeholder={"Double X 1 ชุด\nOmega 1 เม็ด"}
                  className="mt-1.5 w-full resize-y rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 font-thai text-[14px] outline-none transition-colors placeholder:text-ink-30 focus:border-wellness focus:ring-2 focus:ring-wellness/15"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <SaveBtn onClick={saveSupplements} busy={savingSup}>บันทึกวิตามิน</SaveBtn>
            {supMsg && <SavedNote>{supMsg}</SavedNote>}
          </div>
          <p className="flex items-start gap-2 font-thai text-[11.5px] leading-[1.6] text-ink-60">
            <Beaker size={13} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-40" aria-hidden />
            ชื่อมื้อจะถูกจับคู่กับเมนูแบบยืดหยุ่น (เช้า/กลางวัน/เย็น/ของว่าง) — ตรงกับชื่อมื้อที่ engine สร้างตามเป้าหมาย
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ── small UI pieces ──────────────────────────────────── */

function SectionHead({ icon: Icon, title, sub }: { icon: typeof Salad; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-ink-5 bg-surface/50 px-4 py-3.5 lg:px-5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wellness-ultra text-wellness">
        <Icon size={17} strokeWidth={2} aria-hidden />
      </span>
      <div>
        <div className="font-head text-[15px] font-extrabold text-ink">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-ink-60">{sub}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold text-ink-60">{children}</div>;
}

function Chip({
  active, onClick, children, checkable,
}: { active: boolean; onClick: () => void; children: React.ReactNode; checkable?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2 ${
        active ? "border-wellness bg-wellness-ultra text-wellness" : "border-ink-10 bg-white text-ink hover:border-ink-20"
      }`}
    >
      {checkable && active && <Check size={13} strokeWidth={2.75} aria-hidden />}
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-ink-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2"
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-wellness" : "bg-ink-10"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
      <span className="font-thai text-[14px] text-ink">{label}</span>
    </button>
  );
}

function SaveBtn({ onClick, busy, children }: { onClick: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-wellness px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-wellness/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2 disabled:opacity-50"
    >
      {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

function SavedNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-thai text-[13px] font-semibold text-wellness">
      <Check size={14} strokeWidth={2.5} aria-hidden /> {children}
    </span>
  );
}
