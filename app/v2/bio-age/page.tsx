"use client";

/**
 * UP Labs v2 · อายุสุขภาพ (Health Age · PhenoAge, Levine 2018)
 * ───────────────────────────────────────────────────────────
 * Second "big score" for a customer: blood-based biological age from 9 markers.
 * Auto-prefills from customer_lab_values (via /api/customers/[id]/bio-age); the
 * coach completes any missing markers, then computes. Calc = lib/bio-age.ts (the
 * SAME code the /360 gauge uses). NOT a diagnosis — ships with a disclaimer.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Hourglass, ChevronRight, Users, Sparkles, X, ArrowRight,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { Card, LoadingState, EmptyState, ErrorState } from "@/lib/v2/ui";
import { initials, genderLabelWithGlyph, resolveAge } from "@/lib/v2/identity";
import { statusHex } from "@/lib/medical-status";
import { statusTextHex } from "@/lib/v2/status";
import {
  estimatePhenoAge, PHENO_DEFAULT_UNITS,
  type PhenoEstimate, type PhenoInput,
} from "@/lib/bio-age";

export default function V2BioAgePage() {
  return (
    <Suspense fallback={<Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "อายุสุขภาพ" }]}><Card><LoadingState /></Card></Shell>}>
      <BioAgeInner />
    </Suspense>
  );
}

function BioAgeInner() {
  const search = useSearchParams();
  const router = useRouter();
  const customerId = search.get("customer");
  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "ลูกค้า", href: "/v2/customers" }, { label: "อายุสุขภาพ" }];

  if (!customerId) {
    return <Shell breadcrumb={breadcrumb}><PickCustomer onPick={(id) => router.push(`/v2/bio-age?customer=${id}`)} /></Shell>;
  }
  return (
    <Shell breadcrumb={breadcrumb}>
      <Workspace customerId={customerId} onClear={() => router.push("/v2/bio-age")} />
    </Shell>
  );
}

/* ─────────── Customer picker (same pattern as /v2/bca) ─────────── */
function PickCustomer({ onPick }: { onPick: (id: string) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const load = () => {
    setError(null); setRows(null);
    fetch("/api/customers/list").then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setRows(j.customers ?? []); })
      .catch((e) => setError(e.message ?? "load failed"));
  };
  useEffect(load, []);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || r.name.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-wellness-ultra text-wellness">
          <Hourglass size={22} strokeWidth={2} aria-hidden />
        </span>
        <h1 className="mt-3 font-head text-[22px] font-extrabold tracking-tight text-ink">อายุสุขภาพ (Health Age)</h1>
        <p className="mt-1 font-thai text-[13px] text-ink-60">เลือกลูกค้าเพื่อคำนวณอายุร่างกายจากค่าเลือด 9 ตัว</p>
      </div>
      <Card className="p-3">
        <div className="relative mb-2">
          <Search size={16} strokeWidth={2.25} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-30" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อลูกค้า…" aria-label="ค้นหาชื่อลูกค้า"
            className="w-full rounded-full border border-ink-10 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-ink-30 focus:border-wellness focus:ring-2 focus:ring-wellness/15" />
        </div>
        {error ? <ErrorState message={error} onRetry={load} />
          : !rows ? <LoadingState label="กำลังโหลดรายชื่อ…" />
          : filtered.length === 0 ? <EmptyState icon={Users} title={q ? "ไม่พบลูกค้า" : "ยังไม่มีลูกค้า"} hint={q ? "ลองเปลี่ยนคำค้น" : undefined} />
          : (
            <ul className="max-h-[60vh] divide-y divide-ink-5 overflow-y-auto">
              {filtered.map((r) => {
                const age = resolveAge(r);
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => onPick(r.id)}
                      className="group flex min-h-[44px] w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-surface focus:outline-none focus-visible:bg-surface">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-5 text-[12px] font-bold text-ink-60">{initials(r.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-head text-[14px] font-bold text-ink">{r.name}</span>
                        <span className="block font-thai text-[11px] text-ink-60">{genderLabelWithGlyph(r.gender)} {age != null ? `· ${age} ปี` : ""}</span>
                      </span>
                      <ChevronRight size={16} strokeWidth={2.25} className="text-ink-20 group-hover:text-wellness" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
      </Card>
    </div>
  );
}

/* ─────────── Marker field config ─────────── */
type FieldKey = "albumin" | "creatinine" | "glucose" | "crp" | "lymphocytePct" | "mcv" | "rdw" | "alp" | "wbc";
const FIELDS: { key: FieldKey; label: string; en: string; step: string; unitKey?: keyof PhenoInput; units?: string[] }[] = [
  { key: "albumin", label: "Albumin", en: "อัลบูมิน", step: "0.1", unitKey: "albuminUnit", units: ["g/dL", "g/L"] },
  { key: "creatinine", label: "Creatinine", en: "ครีอะตินิน", step: "0.01", unitKey: "creatinineUnit", units: ["mg/dL", "umol/L"] },
  { key: "glucose", label: "Glucose (อดอาหาร)", en: "น้ำตาล", step: "1", unitKey: "glucoseUnit", units: ["mg/dL", "mmol/L"] },
  { key: "crp", label: "CRP", en: "ค่าอักเสบ hs-CRP", step: "0.1", unitKey: "crpUnit", units: ["mg/L", "mg/dL"] },
  { key: "lymphocytePct", label: "Lymphocyte %", en: "ลิมโฟไซต์", step: "1" },
  { key: "mcv", label: "MCV", en: "ขนาดเม็ดเลือดแดง · fL", step: "1" },
  { key: "rdw", label: "RDW", en: "การกระจายขนาด · %", step: "0.1" },
  { key: "alp", label: "ALP", en: "เอนไซม์ตับ/กระดูก · U/L", step: "1" },
  { key: "wbc", label: "WBC", en: "เม็ดเลือดขาว · 10³/µL", step: "0.1" },
];

/* ─────────── Workspace ─────────── */
function Workspace({ customerId, onClear }: { customerId: string; onClear: () => void }) {
  const [meta, setMeta] = useState<{ name: string; gender: string | null; age: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, string>>({ ...PHENO_DEFAULT_UNITS });
  const [missingLabels, setMissingLabels] = useState<string[]>([]);
  const [result, setResult] = useState<PhenoEstimate | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const j = await fetch(`/api/customers/${customerId}/bio-age`).then((r) => r.json());
      if (j.error) throw new Error(j.error);
      setMeta(j.customer);
      const inp = j.prefill.input ?? {};
      const f: Record<string, string> = {};
      for (const k of ["albumin", "creatinine", "glucose", "crp", "lymphocytePct", "mcv", "rdw", "alp", "wbc"]) {
        if (inp[k] != null) f[k] = String(inp[k]);
      }
      setForm(f);
      setUnits({ ...PHENO_DEFAULT_UNITS, ...pickUnits(inp) });
      setMissingLabels(j.prefill.missingLabels ?? []);
      // auto-show the server's estimate (imputes missing) if age + glucose are on file
      setResult(j.estimate?.computable ? j.estimate : null);
    } catch (e: any) { setError(e.message ?? "โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [customerId]);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setUnit = (k: string, v: string) => setUnits((p) => ({ ...p, [k]: v }));

  const filled = (k: string) => form[k] != null && form[k] !== "" && !isNaN(Number(form[k]));
  const blankKeys = FIELDS.filter((f) => !filled(f.key)).map((f) => f.key);
  const ageKnown = meta?.age != null;
  const glucoseKnown = filled("glucose");
  const canCompute = ageKnown && glucoseKnown;

  // Mode C: blanks are imputed with healthy reference → result is flagged ≈ ประมาณการ.
  const compute = () => {
    if (!canCompute) return;
    const raw: any = {
      age: meta!.age,
      albuminUnit: units.albuminUnit, creatinineUnit: units.creatinineUnit,
      glucoseUnit: units.glucoseUnit, crpUnit: units.crpUnit,
    };
    for (const f of FIELDS) if (filled(f.key)) raw[f.key] = Number(form[f.key]);
    setResult(estimatePhenoAge(raw, (meta?.gender as any) ?? null));
  };

  if (loading) return <Card><LoadingState label="กำลังโหลดค่าเลือด…" /></Card>;
  if (error) return <Card><ErrorState message={error} onRetry={load} /></Card>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-wellness-ultra text-wellness"><Hourglass size={16} strokeWidth={2} aria-hidden /></span>
          <div>
            <h1 className="font-head text-[20px] font-extrabold tracking-tight text-ink">อายุสุขภาพ · {meta?.name}</h1>
            <p className="font-thai text-[12px] text-ink-60">{genderLabelWithGlyph(meta?.gender)} {ageKnown ? `· อายุจริง ${meta!.age} ปี` : "· ⚠️ ไม่มีวันเกิด — เพิ่มก่อนคำนวณ"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/v2/customers/${customerId}`} className="inline-flex min-h-[44px] items-center gap-1 text-[12px] font-semibold text-ink-60 hover:text-wellness">โปรไฟล์ 360 <ArrowRight size={12} strokeWidth={2.5} aria-hidden /></Link>
          <button type="button" onClick={onClear} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink"><X size={13} strokeWidth={2.25} aria-hidden /> เปลี่ยนลูกค้า</button>
        </div>
      </div>

      {missingLabels.length > 0 && (
        <div className="rounded-xl border border-status-caution/30 bg-status-bg-caution px-4 py-3 text-[13px] text-status-caution">
          🩸 ดึงค่าจากแล็บอัตโนมัติแล้ว — ยังขาด <b>{missingLabels.length}</b> ตัว ({missingLabels.join(" · ")}) · กรอกเพิ่มเพื่อความแม่นยำ หรือ<b>เว้นว่างไว้</b> ระบบจะประมาณการด้วยค่าปกติ (ผลติดป้าย ≈ ประมาณการ)
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        {/* FORM */}
        <Card className="p-4 lg:p-5">
          <h2 className="mb-1 flex items-center gap-1.5 font-head text-[15px] font-bold text-ink">🩸 ค่าเลือด (CBC + เคมีเลือด)</h2>
          <p className="mb-3 font-thai text-[12px] text-ink-60">ค่าที่ดึงจากแล็บถูกเติมให้แล้ว เลือกหน่วยให้ตรงใบผล</p>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => {
              const prefilled = form[f.key] != null && form[f.key] !== "";
              return (
                <label key={f.key} className="block">
                  <span className="mb-1 flex items-baseline gap-1.5 text-[11px] font-semibold text-ink-80">
                    {f.label} <span className="font-normal text-ink-40">{f.en}</span>
                    {prefilled && <span className="ml-auto text-[9px] font-bold text-wellness">● แล็บ</span>}
                  </span>
                  <div className="flex gap-1.5">
                    <input type="text" inputMode="decimal" value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}
                      className="min-h-[42px] w-full rounded-xl border border-ink-10 bg-white px-3 py-2 text-[14px] font-medium text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-wellness focus:ring-2 focus:ring-wellness/15" placeholder="—" />
                    {f.units ? (
                      <select value={units[f.unitKey as string]} onChange={(e) => setUnit(f.unitKey as string, e.target.value)}
                        className="min-h-[42px] shrink-0 rounded-xl border border-ink-10 bg-surface px-2 text-[12px] text-ink-60 outline-none focus:border-wellness">
                        {f.units.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>
          <button type="button" onClick={compute} disabled={!canCompute}
            className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-wellness px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-wellness/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2">
            <Sparkles size={17} strokeWidth={2.25} aria-hidden /> คำนวณอายุสุขภาพ
          </button>
          {!canCompute
            ? <p className="mt-2 text-center font-thai text-[11px] text-status-warning">{!ageKnown ? "⚠️ ต้องมีวันเกิดของลูกค้าก่อน" : "⚠️ ต้องกรอกค่าน้ำตาล (Glucose/FBS) จริงก่อน — เดาไม่ได้"}</p>
            : blankKeys.length > 0 && <p className="mt-2 text-center font-thai text-[11px] text-ink-40">เว้นว่าง {blankKeys.length} ช่อง → จะใช้ค่าอ้างอิงสุขภาพดี (ผลเป็น “ประมาณการ”)</p>}
        </Card>

        {/* RESULT */}
        <Card className="flex flex-col items-center justify-center p-5 lg:p-6">
          {result?.computable && result.result ? (
            <ResultView est={result} age={meta!.age!} form={form} units={units} />
          ) : result && !result.computable ? (
            <div className="py-14 text-center font-thai text-[13px] text-status-warning">
              <Hourglass size={34} strokeWidth={1.5} className="mx-auto mb-3 text-status-caution" aria-hidden />
              {result.reason}<br /><span className="text-ink-40">กรอกค่าจริงเพิ่มอีกนิดแล้วลองใหม่</span>
            </div>
          ) : (
            <div className="py-16 text-center font-thai text-[14px] text-ink-40">
              <Hourglass size={34} strokeWidth={1.5} className="mx-auto mb-3 text-ink-20" aria-hidden />
              กรอกค่าเลือดแล้วกด<br />“คำนวณ” เพื่อดูอายุสุขภาพ 🌿
            </div>
          )}
        </Card>
      </div>

      <p className="mx-auto max-w-3xl border-t border-dashed border-ink-10 pt-4 text-center font-thai text-[11.5px] leading-[1.7] text-ink-40">
        <b className="text-rose">⚠️ ไม่ใช่ผลวินิจฉัยทางการแพทย์</b> — “อายุสุขภาพ” เป็นการประเมินแนวโน้มความเสี่ยงตามสถิติ (PhenoAge, Levine 2018 · โมเดลจากประชากรอเมริกัน NHANES) ใช้เพื่อ<b className="text-ink-60">ติดตามแนวโน้ม</b>ว่าดูแลตัวเองได้ดีแค่ไหน ไม่ใช้แทนการตรวจหรือคำวินิจฉัยของแพทย์ · ค่าอาจสูงชั่วคราวหากมีการติดเชื้อ/อักเสบเฉียบพลัน
      </p>
    </div>
  );
}

/* ─────────── Result view ─────────── */
function ResultView({ est, age, form, units }: { est: PhenoEstimate; age: number; form: Record<string, string>; units: Record<string, string> }) {
  const { phenoAge, delta, mortalityPct, level, acuteFlag } = est.result!;
  const estimate = est.confidence === "estimate";
  const younger = delta <= -1, older = delta >= 1;
  const ringColor = statusHex[level];
  const C = 578, frac = Math.max(0.05, Math.min(1, phenoAge / 100));

  return (
    <div className="w-full text-center">
      <div className="relative mx-auto h-[200px] w-[200px]">
        <svg width="200" height="200" viewBox="0 0 210 210" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="105" cy="105" r="92" fill="none" stroke="#EFE7DF" strokeWidth="16" />
          <circle cx="105" cy="105" r="92" fill="none" stroke={ringColor} strokeWidth="16" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C - C * frac} style={{ transition: "stroke-dashoffset .9s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-head text-[58px] font-extrabold leading-none" style={{ color: ringColor }}>{estimate ? "≈" : ""}{phenoAge}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-ink-40">ปี · Health Age</div>
        </div>
      </div>

      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-bold"
        style={{ background: `${ringColor}1a`, color: statusTextHex[level] }}>
        {younger ? `🌿 อ่อนกว่าอายุจริง ${Math.abs(delta).toFixed(1)} ปี` : older ? `🔸 แก่กว่าอายุจริง ${Math.abs(delta).toFixed(1)} ปี` : "⚖️ ใกล้เคียงอายุจริง"}
      </div>
      <p className="mt-2 font-thai text-[13px] text-ink-60">
        อายุจริง {age} ปี · ความเสี่ยงเชิงสถิติ 10 ปี ≈ {mortalityPct}%
      </p>

      {estimate && (
        <div className="mt-3 rounded-xl border border-ink-10 bg-surface/60 px-3 py-2 text-left font-thai text-[11.5px] text-ink-60">
          <b className="text-ink-80">≈ ประมาณการ</b> — ยังไม่ได้ตรวจ {est.imputed.length} ตัว ({est.imputedLabels.join(" · ")}) ระบบใช้<b>ค่าปกติ</b>แทน
          {est.crpImputed && <span className="text-status-warning"> · ⚠️ ไม่มี CRP — ถ้ามีการอักเสบซ่อนอยู่ อายุจริงอาจสูงกว่านี้</span>}
          <br /><span className="text-ink-40">ตรวจครบจะแม่นขึ้น · ค่าอาจขยับเมื่อเติมผลจริง</span>
        </div>
      )}

      {acuteFlag && (
        <div className="mt-3 rounded-xl border border-status-caution/40 bg-status-bg-caution px-3 py-2 text-left font-thai text-[12px] text-status-caution">
          ⚠️ <b>ค่าอักเสบ/เม็ดเลือดขาวสูง</b> — ถ้ากำลังป่วยหรือเพิ่งออกกำลังหนัก อายุสุขภาพอาจสูงกว่าจริงชั่วคราว ควรตรวจซ้ำตอนปกติ
      </div>
      )}

      <Breakdown form={form} units={units} />
    </div>
  );
}

/* Which markers push the age up/down (educational, matches the prototype REF) */
const REF: Record<string, { lo: number; hi: number; dir: -1 | 0 | 1; label: string; get: (f: Record<string, string>, u: Record<string, string>) => number }> = {
  albumin: { lo: 4.0, hi: 5.0, dir: 1, label: "Albumin", get: (f, u) => u.albuminUnit === "g/L" ? Number(f.albumin) / 10 : Number(f.albumin) },
  glucose: { lo: 70, hi: 99, dir: 0, label: "Glucose", get: (f, u) => u.glucoseUnit === "mmol/L" ? Number(f.glucose) * 18.0182 : Number(f.glucose) },
  crp: { lo: 0, hi: 1, dir: -1, label: "CRP (อักเสบ)", get: (f, u) => u.crpUnit === "mg/dL" ? Number(f.crp) * 10 : Number(f.crp) },
  lymphocytePct: { lo: 20, hi: 40, dir: 0, label: "Lymphocyte %", get: (f) => Number(f.lymphocytePct) },
  rdw: { lo: 11.5, hi: 13.5, dir: -1, label: "RDW", get: (f) => Number(f.rdw) },
  mcv: { lo: 80, hi: 96, dir: 0, label: "MCV", get: (f) => Number(f.mcv) },
  wbc: { lo: 4, hi: 7, dir: 0, label: "WBC", get: (f) => Number(f.wbc) },
  alp: { lo: 44, hi: 100, dir: 0, label: "ALP", get: (f) => Number(f.alp) },
};
function markerStatus(k: string, f: Record<string, string>, u: Record<string, string>): "good" | "mid" | "bad" | "na" {
  if (f[k] == null || f[k] === "" || isNaN(Number(f[k]))) return "na"; // imputed / untested
  const r = REF[k], v = r.get(f, u);
  if (r.dir === -1) return v > r.hi * 2.2 ? "bad" : v > r.hi ? "mid" : "good";
  if (r.dir === 1) return v < r.lo * 0.9 ? "bad" : v < r.lo ? "mid" : "good";
  if (v < r.lo || v > r.hi) return (v < r.lo * 0.85 || v > r.hi * 1.2) ? "bad" : "mid";
  return "good";
}
function Breakdown({ form, units }: { form: Record<string, string>; units: Record<string, string> }) {
  const tone: Record<string, string> = { good: statusHex.good, mid: statusHex.caution, bad: statusHex.danger, na: "#B8B2AA" };
  const txt: Record<string, string> = { good: "ดีเยี่ยม", mid: "เฝ้าระวัง", bad: "ควรปรับ", na: "ยังไม่ตรวจ" };
  const w: Record<string, number> = { good: 92, mid: 58, bad: 30, na: 18 };
  return (
    <div className="mt-5 text-left">
      <h3 className="mb-2.5 font-head text-[13px] font-bold text-ink">🔍 อะไรกำลังเร่ง / ชะลออายุ</h3>
      <div className="space-y-2">
        {Object.keys(REF).map((k) => {
          const s = markerStatus(k, form, units);
          return (
            <div key={k} className="flex items-center gap-2.5 text-[12px]">
              <div className="w-[92px] shrink-0 font-semibold text-ink-80">{REF[k].label}</div>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink-5">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w[s]}%`, background: tone[s] }} />
              </div>
              <div className="w-[58px] shrink-0 text-right font-semibold" style={{ color: tone[s] }}>{txt[s]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Map prefill input's unit fields back to the local units record. */
function pickUnits(inp: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["albuminUnit", "creatinineUnit", "glucoseUnit", "crpUnit"]) {
    if (inp[k]) out[k] = inp[k];
  }
  return out;
}
