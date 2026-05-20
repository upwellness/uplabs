"use client";

/**
 * AllergyPanel — แสดงผล food sensitivity/allergy test ของลูกค้า
 * ─────────────────────────────────────────────────────────────
 * 3 sections:
 *   1. Test rounds (history)
 *   2. Food allergens grouped by severity (eliminate / reduce)
 *   3. Supplement safety mapping (avoid / caution / reduce / safe)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AllergyTest {
  id:        string;
  test_type: string;
  test_lab:  string | null;
  test_name: string | null;
  panel_size: number | null;
  tested_at: string;
  notes:     string | null;
}

interface FoodAllergen {
  food_key:           string;
  food_name_th:       string | null;
  food_name_en:       string | null;
  food_category:      string | null;
  score:              number | null;
  severity:           string;            // 'eliminate' / 'reduce' / 'within_limit'
  recommended_action: string | null;
  tested_at:          string;
}

interface SupplementSafety {
  product_key:              string;
  product_th:               string | null;
  product_en:               string | null;
  sku_id:                   string | null;
  status:                   string;       // 'safe' / 'caution' / 'reduce_freq' / 'avoid'
  conflicting_ingredients:  string[] | null;
  conflict_severity:        string[] | null;
  reason:                   string | null;
  alternative_product:      string | null;
  verified_at:              string;
}

const SEVERITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  eliminate:    { bg: "bg-red-50",    text: "text-red-700",    label: "🔴 หลีกเลี่ยง 3-6 เดือน" },
  reduce:       { bg: "bg-amber-50",  text: "text-amber-700",  label: "🟠 ≤ 1 ครั้ง/สัปดาห์" },
  within_limit: { bg: "bg-green-50",  text: "text-green-700",  label: "✅ ปกติ" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  avoid:       { bg: "bg-red-50",     text: "text-red-700",    icon: "🔴", label: "AVOID" },
  reduce_freq: { bg: "bg-amber-50",   text: "text-amber-700",  icon: "🟠", label: "REDUCE FREQUENCY" },
  caution:     { bg: "bg-yellow-50",  text: "text-yellow-700", icon: "🟡", label: "CAUTION · VERIFY" },
  safe:        { bg: "bg-green-50",   text: "text-green-700",  icon: "✅", label: "SAFE" },
  unknown:     { bg: "bg-gray-50",    text: "text-gray-700",   icon: "❓", label: "UNKNOWN" },
};

export function AllergyPanel({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [tests,     setTests]     = useState<AllergyTest[]>([]);
  const [allergens, setAllergens] = useState<FoodAllergen[]>([]);
  const [safety,    setSafety]    = useState<SupplementSafety[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<"food" | "supplement">("supplement");

  const deleteTest = async (testId: string) => {
    if (!confirm("ลบ test นี้และ allergens ทั้งหมดที่ผูกกับมัน?")) return;
    const r = await fetch(`/api/customers/${customerId}/allergies/tests/${testId}`, { method: "DELETE" });
    if (!r.ok) { alert("ลบไม่สำเร็จ"); return; }
    router.refresh();
    // also reload local state
    setTests(tests.filter(t => t.id !== testId));
    setAllergens(allergens.filter(a => true /* will refresh */));
    location.reload();
  };

  useEffect(() => {
    fetch(`/api/customers/${customerId}/allergies`)
      .then(r => r.json())
      .then(d => {
        setTests(d.tests ?? []);
        setAllergens(d.allergens ?? []);
        setSafety(d.safety ?? []);
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-surface" />;
  }

  if (tests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-10 bg-surface p-6 text-center">
        <div className="text-2xl">🧪</div>
        <p className="mt-2 font-thai text-[13px] text-ink-60">ยังไม่มีผลตรวจ allergy / food sensitivity</p>
        <Link href={`/customers/${customerId}/allergies/new`}
          className="mt-3 inline-block rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white">
          + เพิ่มผลตรวจ
        </Link>
      </div>
    );
  }

  // Group allergens by severity
  const eliminate = allergens.filter(a => a.severity === "eliminate");
  const reduce    = allergens.filter(a => a.severity === "reduce");

  // Group supplements by status
  const grouped = {
    avoid:       safety.filter(s => s.status === "avoid"),
    reduce_freq: safety.filter(s => s.status === "reduce_freq"),
    caution:     safety.filter(s => s.status === "caution"),
    safe:        safety.filter(s => s.status === "safe"),
  };

  return (
    <div className="space-y-4">
      {/* Test summary + actions */}
      {tests[0] && (
        <div className="rounded-xl bg-ink/5 px-4 py-3 text-[12px] font-mono text-ink-60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-bold text-ink">{tests[0].test_type}</span>
                <span>· {tests[0].test_lab}</span>
                <span>· {tests[0].test_name}</span>
                {tests[0].panel_size && <span>· {tests[0].panel_size} foods</span>}
                <span>· {new Date(tests[0].tested_at).toLocaleDateString("th-TH")}</span>
              </div>
              {tests[0].notes && <div className="mt-1 font-thai text-[11px]">{tests[0].notes}</div>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Link href={`/customers/${customerId}/allergies/new`}
                className="rounded-md border border-ink-10 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-ink-20"
                title="เพิ่ม test ใหม่">
                + Test
              </Link>
              <button onClick={() => deleteTest(tests[0].id)}
                className="rounded-md border border-ink-10 bg-white px-2 py-1 text-[11px] text-ink-40 hover:text-red-600 hover:border-red-300"
                title="ลบ test ล่าสุด">
                🗑️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-ink-10">
        <button
          onClick={() => setTab("supplement")}
          className={`px-4 py-2 text-[13px] font-semibold transition-colors ${
            tab === "supplement" ? "text-rose border-b-2 border-rose" : "text-ink-60 hover:text-ink"
          }`}
        >
          💊 Supplement Safety ({safety.length})
        </button>
        <button
          onClick={() => setTab("food")}
          className={`px-4 py-2 text-[13px] font-semibold transition-colors ${
            tab === "food" ? "text-rose border-b-2 border-rose" : "text-ink-60 hover:text-ink"
          }`}
        >
          🍽️ Food Allergens ({allergens.length})
        </button>
      </div>

      {/* Tab: Supplement Safety */}
      {tab === "supplement" && (
        <div className="space-y-4">
          {(["avoid", "reduce_freq", "caution", "safe"] as const).map(status => {
            const items = grouped[status];
            if (items.length === 0) return null;
            const s = STATUS_STYLE[status];
            return (
              <div key={status}>
                <div className={`mb-2 inline-flex items-center gap-2 rounded-full ${s.bg} ${s.text} px-3 py-1 text-[11px] font-bold tracking-wider`}>
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  <span className="font-mono opacity-60">· {items.length}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map(p => (
                    <div key={p.product_key} className={`rounded-xl border border-ink-10 bg-white p-4 hover:border-ink-20 transition-colors`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-thai text-[13px] font-semibold text-ink">{p.product_th}</div>
                          <div className="font-mono text-[10px] text-ink-40 truncate">{p.product_en} · {p.sku_id}</div>
                        </div>
                      </div>
                      {p.conflicting_ingredients && p.conflicting_ingredients.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.conflicting_ingredients.map((ing, i) => (
                            <span key={ing} className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${SEVERITY_STYLE[p.conflict_severity?.[i] ?? "eliminate"]?.bg ?? "bg-gray-100"} ${SEVERITY_STYLE[p.conflict_severity?.[i] ?? "eliminate"]?.text ?? "text-gray-700"}`}>
                              ⚠ {ing}
                            </span>
                          ))}
                        </div>
                      )}
                      {p.reason && (
                        <p className="mt-2 font-thai text-[11px] text-ink-60 leading-relaxed">{p.reason}</p>
                      )}
                      {p.alternative_product && (
                        <div className="mt-2 rounded-lg bg-green-50 px-3 py-1.5 text-[10px] font-thai text-green-700">
                          💡 ทางเลือก: {p.alternative_product}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Food Allergens */}
      {tab === "food" && (
        <div className="space-y-4">
          {[
            { items: eliminate, key: "eliminate" },
            { items: reduce,    key: "reduce" },
          ].map(({ items, key }) => {
            if (items.length === 0) return null;
            const s = SEVERITY_STYLE[key];
            return (
              <div key={key}>
                <div className={`mb-2 inline-flex items-center gap-2 rounded-full ${s.bg} ${s.text} px-3 py-1 text-[11px] font-bold`}>
                  {s.label} · {items.length} foods
                </div>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(a => (
                    <div key={a.food_key} className="flex items-center justify-between rounded-lg border border-ink-10 bg-white px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-thai text-[12px] text-ink truncate">{a.food_name_th}</div>
                        <div className="font-mono text-[9px] text-ink-40 truncate">{a.food_name_en} · {a.food_category}</div>
                      </div>
                      <div className={`flex-shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${s.text}`}>
                        {a.score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
