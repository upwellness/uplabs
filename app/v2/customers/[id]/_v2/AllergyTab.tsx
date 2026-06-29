"use client";

/**
 * UP Labs v2 · Allergy & Sensitivity tab (Customer 360, SPEC §7.5)
 * ────────────────────────────────────────────────────────────────
 * Mirrors v1 AllergyPanel field-for-field, reusing the same API:
 *   GET  /api/customers/[id]/allergies            → { tests, allergens, safety }
 *   POST → form at /customers/[id]/allergies/new  ("เพิ่มผลตรวจ")
 *   DELETE /api/customers/[id]/allergies/tests/[testId]  (remove latest test)
 *
 * Three sections in clinical-warm: test history summary · supplement-safety
 * (avoid-first) · food allergens grouped by severity. One status system.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, FlaskConical, PlusCircle, Trash2, Pill, Utensils, AlertTriangle,
  ArrowDownRight, ShieldQuestion, CheckCircle2, Lightbulb,
} from "lucide-react";
import { LoadingState, ErrorState, EmptyState } from "@/lib/v2/ui";
import { statusTextClass, statusTextHex } from "@/lib/v2/status";
import { statusHex, STATUS_LABEL_TH, type StatusLevel } from "@/lib/medical-status";

interface AllergyTest {
  id: string;
  test_type: string;
  test_lab: string | null;
  test_name: string | null;
  panel_size: number | null;
  tested_at: string;
  notes: string | null;
}

interface FoodAllergen {
  food_key: string;
  food_name_th: string | null;
  food_name_en: string | null;
  food_category: string | null;
  score: number | null;
  severity: string; // 'eliminate' | 'reduce' | 'within_limit'
  recommended_action: string | null;
  tested_at: string;
}

interface SupplementSafety {
  product_key: string;
  product_th: string | null;
  product_en: string | null;
  sku_id: string | null;
  status: string; // 'safe' | 'caution' | 'reduce_freq' | 'avoid'
  conflicting_ingredients: string[] | null;
  conflict_severity: string[] | null;
  reason: string | null;
  alternative_product: string | null;
  verified_at: string;
}

type SafetyStatus = "avoid" | "reduce_freq" | "caution" | "safe";
const SAFETY_META: Record<SafetyStatus, { level: StatusLevel; label: string; icon: typeof AlertTriangle }> = {
  avoid:       { level: "danger",  label: "ควรหลีกเลี่ยง", icon: AlertTriangle },
  reduce_freq: { level: "warning", label: "ลดความถี่ลง",   icon: ArrowDownRight },
  caution:     { level: "caution", label: "ใช้อย่างระวัง",  icon: ShieldQuestion },
  safe:        { level: "optimal", label: "ใช้ได้ตามปกติ",  icon: CheckCircle2 },
};
const SAFETY_ORDER: SafetyStatus[] = ["avoid", "reduce_freq", "caution", "safe"];

type FoodSeverity = "eliminate" | "reduce";
const FOOD_META: Record<FoodSeverity, { level: StatusLevel; label: string }> = {
  eliminate: { level: "danger",  label: "หลีกเลี่ยง 3–6 เดือน" },
  reduce:    { level: "warning", label: "ไม่เกิน 1 ครั้ง/สัปดาห์" },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

export function AllergyTab({ customerId }: { customerId: string }) {
  const [tests, setTests] = useState<AllergyTest[] | null>(null);
  const [allergens, setAllergens] = useState<FoodAllergen[]>([]);
  const [safety, setSafety] = useState<SupplementSafety[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<"supplement" | "food">("supplement");
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setError(null);
    setTests(null);
    fetch(`/api/customers/${customerId}/allergies`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setTests(d.tests ?? []);
        setAllergens(d.allergens ?? []);
        setSafety(d.safety ?? []);
      })
      .catch((e) => setError(e.message ?? "load failed"));
  };
  useEffect(load, [customerId]);

  const deleteTest = async (testId: string) => {
    if (!confirm("ลบผลตรวจล่าสุดนี้ และ allergen ทั้งหมดที่ผูกกับมันใช่ไหมคะ?")) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/customers/${customerId}/allergies/tests/${testId}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "ลบไม่สำเร็จ");
      }
      load(); // revalidate
    } catch (e: any) {
      setError(e.message ?? "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!tests) return <LoadingState label="กำลังโหลดผลตรวจภูมิแพ้…" />;

  if (tests.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="ยังไม่มีผลตรวจ allergy / food sensitivity"
        hint="เพิ่มผลตรวจครั้งแรก แล้วระบบจะจับคู่อาหารที่ควรเลี่ยงและอาหารเสริมที่เหมาะกับลูกค้าให้อัตโนมัติ"
        action={
          <Link
            href={`/customers/${customerId}/allergies/new`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <PlusCircle size={13} strokeWidth={2.25} aria-hidden /> เพิ่มผลตรวจ
          </Link>
        }
      />
    );
  }

  const latest = tests[0];
  const eliminate = allergens.filter((a) => a.severity === "eliminate");
  const reduce = allergens.filter((a) => a.severity === "reduce");
  const groupedSafety: Record<SafetyStatus, SupplementSafety[]> = {
    avoid:       safety.filter((s) => s.status === "avoid"),
    reduce_freq: safety.filter((s) => s.status === "reduce_freq"),
    caution:     safety.filter((s) => s.status === "caution"),
    safe:        safety.filter((s) => s.status === "safe"),
  };

  return (
    <div className="space-y-4">
      {/* Latest test summary + actions */}
      <div className="rounded-xl border border-ink-10 bg-surface/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} strokeWidth={2.25} className="text-rose" aria-hidden />
              <span className="font-head text-[14px] font-bold text-ink">{latest.test_type}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-60">
              {latest.test_lab && <span>{latest.test_lab}</span>}
              {latest.test_name && <span>· {latest.test_name}</span>}
              {latest.panel_size != null && <span>· {latest.panel_size} foods</span>}
              <span>· {fmtDate(latest.tested_at)}</span>
              {tests.length > 1 && <span>· ทั้งหมด {tests.length} ครั้ง</span>}
            </div>
            {latest.notes && <p className="mt-1.5 font-thai text-[12px] leading-snug text-ink-60">{latest.notes}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href={`/customers/${customerId}/allergies/new`}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-ink-10 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
              title="เพิ่มผลตรวจใหม่"
            >
              <PlusCircle size={12} strokeWidth={2.25} aria-hidden /> เพิ่มผลตรวจ
            </Link>
            <button
              type="button"
              onClick={() => deleteTest(latest.id)}
              disabled={deleting}
              aria-label="ลบผลตรวจล่าสุด"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink-10 bg-white text-ink-60 transition-colors hover:border-status-danger/40 hover:text-status-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <Trash2 size={13} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div role="tablist" aria-label="ประเภทผลตรวจภูมิแพ้" className="flex gap-1.5 border-b border-ink-5 pb-2">
        <SubTabButton active={sub === "supplement"} onClick={() => setSub("supplement")} icon={Pill}>
          อาหารเสริมที่ควรเลี่ยง ({safety.length})
        </SubTabButton>
        <SubTabButton active={sub === "food"} onClick={() => setSub("food")} icon={Utensils}>
          อาหารที่แพ้ ({allergens.length})
        </SubTabButton>
      </div>

      {/* Supplement safety */}
      {sub === "supplement" && (
        safety.length === 0 ? (
          <EmptyState icon={Pill} title="ยังไม่มีรายการอาหารเสริมที่จับคู่ไว้" hint="เพิ่มผลตรวจที่มีรายการอาหารแพ้ ระบบจะจับคู่อาหารเสริมให้อัตโนมัติ" />
        ) : (
          <div className="space-y-4">
            {SAFETY_ORDER.map((status) => {
              const list = groupedSafety[status];
              if (list.length === 0) return null;
              const m = SAFETY_META[status];
              const Icon = m.icon;
              return (
                <section key={status} aria-label={m.label}>
                  <div
                    className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${statusTextClass[m.level]}`}
                    style={{ backgroundColor: `${statusHex[m.level]}1a` }}
                  >
                    <Icon size={13} strokeWidth={2.25} aria-hidden /> {m.label}
                    <span className="font-mono opacity-70">· {list.length}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((p) => (
                      <div key={p.product_key} className="rounded-xl border border-ink-10 bg-white p-3.5 transition-colors hover:border-ink-20">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusHex[m.level] }} aria-label={STATUS_LABEL_TH[m.level]} />
                          <div className="min-w-0 flex-1">
                            <div className="font-thai text-[13px] font-semibold text-ink">{p.product_th ?? p.product_en ?? p.product_key}</div>
                            {(p.product_en || p.sku_id) && (
                              <div className="truncate font-mono text-[10.5px] text-ink-60">{[p.product_en, p.sku_id].filter(Boolean).join(" · ")}</div>
                            )}
                          </div>
                        </div>
                        {p.conflicting_ingredients && p.conflicting_ingredients.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.conflicting_ingredients.map((ing) => (
                              <span key={ing} className={`inline-flex items-center gap-1 rounded-full bg-status-bg-danger px-2 py-0.5 text-[10.5px] font-medium ${statusTextClass.danger}`}>
                                <AlertTriangle size={10} strokeWidth={2.5} aria-hidden /> {ing}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.reason && <p className="mt-2 text-[12px] leading-snug text-ink-60">{p.reason}</p>}
                        {p.alternative_product && (
                          <div className={`mt-2 flex items-center gap-1.5 rounded-lg bg-status-bg-optimal px-2.5 py-1.5 text-[11px] font-medium ${statusTextClass.optimal}`}>
                            <Lightbulb size={12} strokeWidth={2.25} aria-hidden /> ทางเลือก: {p.alternative_product}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      )}

      {/* Food allergens */}
      {sub === "food" && (
        allergens.length === 0 ? (
          <EmptyState icon={Utensils} title="ไม่มีรายการอาหารที่แพ้" hint="ผลตรวจนี้ไม่พบอาหารที่อยู่ในเกณฑ์ต้องหลีกเลี่ยงหรือลดปริมาณ" />
        ) : (
          <div className="space-y-4">
            {(["eliminate", "reduce"] as FoodSeverity[]).map((sev) => {
              const list = sev === "eliminate" ? eliminate : reduce;
              if (list.length === 0) return null;
              const m = FOOD_META[sev];
              return (
                <section key={sev} aria-label={m.label}>
                  <div
                    className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${statusTextClass[m.level]}`}
                    style={{ backgroundColor: `${statusHex[m.level]}1a` }}
                  >
                    <AlertTriangle size={13} strokeWidth={2.25} aria-hidden /> {m.label}
                    <span className="font-mono opacity-70">· {list.length} รายการ</span>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((a) => (
                      <div key={a.food_key} className="flex items-center justify-between gap-2 rounded-lg border border-ink-10 bg-white px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-thai text-[12.5px] text-ink">{a.food_name_th ?? a.food_name_en ?? a.food_key}</div>
                          {(a.food_name_en || a.food_category) && (
                            <div className="truncate font-mono text-[10px] text-ink-60">{[a.food_name_en, a.food_category].filter(Boolean).join(" · ")}</div>
                          )}
                        </div>
                        {a.score != null && (
                          <span className="shrink-0 font-mono text-[12px] font-bold" style={{ color: statusTextHex[m.level] }}>{a.score}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function SubTabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Pill; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-[12.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 ${
        active ? "border-rose text-rose" : "border-transparent text-ink-60 hover:text-ink"
      }`}
    >
      <Icon size={14} strokeWidth={2.25} aria-hidden /> {children}
    </button>
  );
}
