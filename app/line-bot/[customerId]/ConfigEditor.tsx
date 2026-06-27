"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Goal, Diet, Allergy, PlanConfig } from "@/lib/plate-planner/engine";

/* ── option metadata (labels mirror the Plate Planner UI / SPEC §5) ── */
const GOAL_OPTS: { v: Goal; label: string; hint: string }[] = [
  { v: "loss",      label: "ลดน้ำหนัก",  hint: "27 kcal × น้ำหนักเหมาะสม" },
  { v: "longevity", label: "Longevity",  hint: "34 kcal · โปรตีนสูง คาร์บ ≤130" },
  { v: "muscle",    label: "เพิ่มกล้าม", hint: "40 kcal · โปรตีน 2.2 ก./กก." },
];
const DIET_OPTS: { v: Diet; label: string }[] = [
  { v: "none",       label: "ไม่จำกัด" },
  { v: "halal",      label: "ฮาลาล (ไม่หมู)" },
  { v: "nopork",     label: "ไม่กินหมู" },
  { v: "nobeef",     label: "ไม่กินเนื้อวัว" },
  { v: "noredmeat",  label: "ไม่กินเนื้อแดง" },
  { v: "vegetarian", label: "มังสวิรัติ (มีไข่/นม)" },
  { v: "vegan",      label: "วีแกน (พืชล้วน)" },
];
const ALLERGY_OPTS: { v: Allergy; label: string }[] = [
  { v: "seafood", label: "อาหารทะเล (กุ้ง/หอย/ปู)" },
  { v: "fish",    label: "ปลา" },
  { v: "nuts",    label: "ถั่วเปลือกแข็ง" },
  { v: "soy",     label: "ถั่วเหลือง" },
  { v: "dairy",   label: "นม" },
  { v: "egg",     label: "ไข่" },
  { v: "sesame",  label: "งา" },
  { v: "gluten",  label: "กลูเตน" },
];
const PLAN_LEN_OPTS = [7, 30, 49];
const SUPP_SLOTS = ["เช้า", "กลางวัน", "เย็น", "ของว่าง"] as const;

export function ConfigEditor({ customerId }: { customerId: string }) {
  /* config state */
  const [goal, setGoal]       = useState<Goal>("longevity");
  const [diet, setDiet]       = useState<Diet>("none");
  const [noVeg, setNoVeg]     = useState(false);
  const [allergy, setAllergy] = useState<Allergy[]>([]);
  const [shakeOn, setShakeOn] = useState(false);
  const [shakeBk, setShakeBk] = useState(false);
  const [shakeDn, setShakeDn] = useState(false);
  const [lockW, setLockW]     = useState(false);
  const [seed, setSeed]       = useState("1");
  const [even3, setEven3]     = useState(false);
  const [planLen, setPlanLen] = useState(30);

  /* supplements state: slot → multiline text (one item per line) */
  const [supp, setSupp] = useState<Record<string, string>>({ เช้า: "", กลางวัน: "", เย็น: "", ของว่าง: "" });

  const [loading, setLoading]   = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [savingSup, setSavingSup] = useState(false);
  const [cfgMsg, setCfgMsg]     = useState<string | null>(null);
  const [supMsg, setSupMsg]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
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
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  const toggleAllergy = (a: Allergy) =>
    setAllergy((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const saveConfig = async () => {
    setSavingCfg(true); setCfgMsg(null); setError(null);
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
        body: JSON.stringify({
          goal,
          config,
          seed: seed === "" ? 1 : Number(seed),
          even3,
          plan_len: planLen,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      setCfgMsg("บันทึกแผนแล้ว ✓");
    } catch (e: any) { setError(e.message); }
    finally { setSavingCfg(false); }
  };

  const saveSupplements = async () => {
    setSavingSup(true); setSupMsg(null); setError(null);
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
      setSupMsg(`บันทึกวิตามินแล้ว ✓ (${json.count} มื้อ)`);
    } catch (e: any) { setError(e.message); }
    finally { setSavingSup(false); }
  };

  if (loading) {
    return (
      <div className="mt-6 space-y-4">
        <div className="h-40 rounded-2xl border border-ink-10 bg-white animate-pulse" />
        <div className="h-56 rounded-2xl border border-ink-10 bg-white animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">{error}</div>
      )}

      {/* ── Section 1 · Plate config ───────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-ink-10 bg-white">
        <SectionHead title="แผนอาหาร (Plate config)" sub="ค่าที่ป้อนให้ engine · ตรงกับ Plate Planner" />
        <div className="space-y-5 p-5">
          {/* goal */}
          <div>
            <Label>เป้าหมาย</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {GOAL_OPTS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setGoal(o.v)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                    goal === o.v ? "border-wellness bg-wellness-ultra" : "border-ink-10 bg-white hover:border-ink-20"
                  }`}
                >
                  <div className={`text-sm font-bold ${goal === o.v ? "text-wellness" : "text-ink"}`}>{o.label}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-ink-40">{o.hint}</div>
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
                <Chip key={o.v} active={allergy.includes(o.v)} onClick={() => toggleAllergy(o.v)}>
                  {allergy.includes(o.v) ? "✓ " : ""}{o.label}
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
                <Chip active={shakeBk} onClick={() => setShakeBk((v) => !v)}>{shakeBk ? "✓ " : ""}เชคมื้อเช้า</Chip>
                <Chip active={shakeDn} onClick={() => setShakeDn((v) => !v)}>{shakeDn ? "✓ " : ""}เชคมื้อเย็น</Chip>
              </div>
            )}
          </div>

          {/* seed + plan_len */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Label>Seed (ล็อกเมนูคงที่)</Label>
              <input
                type="number"
                value={seed}
                min={0}
                onChange={(e) => setSeed(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-wellness focus:outline-none"
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
            <Button variant="wellness" size="sm" onClick={saveConfig} disabled={savingCfg}>
              {savingCfg ? "..." : "บันทึกแผน"}
            </Button>
            {cfgMsg && <span className="font-thai text-[13px] text-wellness">{cfgMsg}</span>}
          </div>
        </div>
      </section>

      {/* ── Section 2 · Supplements ────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-ink-10 bg-white">
        <SectionHead title="วิตามิน/อาหารเสริมต่อมื้อ" sub="หนึ่งบรรทัด = หนึ่งรายการ · เช่น Double X 1 ชุด" />
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SUPP_SLOTS.map((slot) => (
              <label key={slot} className="block">
                <Label>มื้อ{slot}</Label>
                <textarea
                  value={supp[slot] ?? ""}
                  onChange={(e) => setSupp((prev) => ({ ...prev, [slot]: e.target.value }))}
                  rows={4}
                  placeholder={"Double X 1 ชุด\nOmega 1 เม็ด"}
                  className="mt-1.5 w-full resize-y rounded-xl border border-ink-10 bg-white px-4 py-2.5 font-thai text-sm placeholder:text-ink-30 focus:border-wellness focus:outline-none"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="wellness" size="sm" onClick={saveSupplements} disabled={savingSup}>
              {savingSup ? "..." : "บันทึกวิตามิน"}
            </Button>
            {supMsg && <span className="font-thai text-[13px] text-wellness">{supMsg}</span>}
          </div>
          <p className="font-thai text-[11.5px] text-ink-40">
            ชื่อมื้อจะถูกจับคู่กับเมนูแบบยืดหยุ่น (เช้า/กลางวัน/เย็น/ของว่าง) — ตรงกับชื่อมื้อที่ engine สร้างตามเป้าหมาย
          </p>
        </div>
      </section>
    </div>
  );
}

/* ── small UI pieces ──────────────────────────────────── */

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="border-b border-ink-5 bg-surface/50 px-5 py-3.5">
      <div className="font-head text-[15px] font-extrabold text-ink">{title}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-40">{sub}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-all ${
        active ? "border-wellness bg-wellness-ultra text-wellness" : "border-ink-10 bg-white text-ink hover:border-ink-20"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink-10 bg-white px-4 py-2.5">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-wellness" : "bg-ink-10"}`}
        aria-pressed={checked}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      <span className="font-thai text-sm text-ink">{label}</span>
    </label>
  );
}
