"use client";

/**
 * NewAllergyTestForm
 * ─────────────────────────────────────────────
 * 2-step form:
 *   Step 1: Test metadata (type, lab, date, panel size, notes)
 *   Step 2: Bulk allergens — TSV paste or row-by-row entry
 *
 * Paste format (one per line):
 *   food_name_th \t food_name_en \t category \t score \t severity
 *   yeast_baker  \t Yeast Baker's \t fungus  \t 81    \t eliminate
 *
 * Severity options: eliminate (≥30) · reduce (20-29) · within_limit (<20)
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface AllergenRow {
  food_key:           string;
  food_name_th:       string;
  food_name_en:       string;
  food_category:      string;
  score:              string;
  severity:           "eliminate" | "reduce" | "within_limit" | "unknown";
  recommended_action: string;
}

const CATEGORIES = ["grain","dairy","nut","seed","legume","fruit","vegetable","meat","seafood","fungus","spice","herb","algae","protein","other"];

const SEVERITY_AUTO = (score: number | null): AllergenRow["severity"] => {
  if (score == null) return "unknown";
  if (score >= 30) return "eliminate";
  if (score >= 20) return "reduce";
  return "within_limit";
};

const ACTION_BY_SEVERITY: Record<AllergenRow["severity"], string> = {
  eliminate:    "หลีกเลี่ยง 3-6 เดือน",
  reduce:       "ไม่เกิน 1 ครั้ง/สัปดาห์",
  within_limit: "ใช้ได้ตามปกติ",
  unknown:      "—",
};

// Slug helper for food_key
function toKey(en: string): string {
  return en.toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .slice(0, 40);
}

export function NewAllergyTestForm({ customerId }: { customerId: string }) {
  const router = useRouter();

  // Test metadata
  const [testType, setTestType] = useState<string>("IgG");
  const [testLab,  setTestLab]  = useState<string>("N Health");
  const [testName, setTestName] = useState<string>("Food Sensitivity Report");
  const [panelSize,setPanelSize]= useState<string>("220");
  const [testedAt, setTestedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes,    setNotes]    = useState<string>("");

  // Allergens
  const [rows, setRows] = useState<AllergenRow[]>([]);
  const [pasteText, setPasteText] = useState<string>("");
  const [pasteHelp, setPasteHelp] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk parse — TSV or comma-separated
  const parsePaste = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split("\n").filter(Boolean);
    const newRows: AllergenRow[] = lines.map((line) => {
      const parts = line.split(/\t|,/).map((p) => p.trim());
      const th    = parts[0] ?? "";
      const en    = parts[1] ?? "";
      const cat   = parts[2] ?? "other";
      const scoreStr = parts[3] ?? "";
      const score = scoreStr ? Number(scoreStr) : null;
      const sev   = (parts[4] as AllergenRow["severity"]) ?? SEVERITY_AUTO(score);
      return {
        food_key:           toKey(en || th),
        food_name_th:       th,
        food_name_en:       en,
        food_category:      cat,
        score:              scoreStr,
        severity:           sev,
        recommended_action: ACTION_BY_SEVERITY[sev],
      };
    });
    setRows([...rows, ...newRows]);
    setPasteText("");
  };

  const addEmptyRow = () => {
    setRows([...rows, {
      food_key: "", food_name_th: "", food_name_en: "",
      food_category: "other", score: "", severity: "unknown",
      recommended_action: "—",
    }]);
  };

  const updateRow = (i: number, patch: Partial<AllergenRow>) => {
    const updated = [...rows];
    const next = { ...updated[i], ...patch };
    // Auto-derive severity if score changes
    if (patch.score != null) {
      const s = next.score ? Number(next.score) : null;
      next.severity = SEVERITY_AUTO(s);
      next.recommended_action = ACTION_BY_SEVERITY[next.severity];
    }
    // Auto-fill food_key when EN is typed
    if (patch.food_name_en && !next.food_key) {
      next.food_key = toKey(patch.food_name_en);
    }
    updated[i] = next;
    setRows(updated);
  };

  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  // Counts per severity
  const counts = useMemo(() => {
    const c: Record<string, number> = { eliminate: 0, reduce: 0, within_limit: 0, unknown: 0 };
    rows.forEach((r) => { c[r.severity] = (c[r.severity] ?? 0) + 1; });
    return c;
  }, [rows]);

  const submit = async () => {
    setError(null);

    if (!testType || !testedAt) {
      setError("กรุณากรอก Test Type และวันที่ตรวจ");
      return;
    }
    if (rows.length === 0) {
      if (!confirm("ยังไม่มี allergen ใดเลย · บันทึกเฉพาะข้อมูล test header? (เพิ่ม allergen ภายหลังได้)")) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const r = await fetch(`/api/customers/${customerId}/allergies/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test: {
            test_type:  testType,
            test_lab:   testLab || null,
            test_name:  testName || null,
            panel_size: panelSize ? Number(panelSize) : null,
            tested_at:  testedAt,
            notes:      notes || null,
          },
          allergens: rows.map((row) => ({
            food_key:           row.food_key || toKey(row.food_name_en || row.food_name_th),
            food_name_th:       row.food_name_th,
            food_name_en:       row.food_name_en,
            food_category:      row.food_category,
            score:              row.score ? Number(row.score) : null,
            severity:           row.severity,
            recommended_action: row.recommended_action,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "save failed");
      // Success → back to profile
      router.push(`/customers/${customerId}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "ผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Test metadata ── */}
      <div className="rounded-3xl border border-ink-10 bg-white p-6">
        <h2 className="font-head text-[16px] font-bold text-ink mb-4">📋 Test Metadata</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Test Type *" value={testType} onChange={setTestType}>
            <select value={testType} onChange={(e) => setTestType(e.target.value)}
              className="w-full rounded-xl border border-ink-10 bg-white px-3 py-2 text-sm">
              <option value="IgG">IgG (Food Sensitivity)</option>
              <option value="IgE">IgE (True Allergy)</option>
              <option value="skin_prick">Skin Prick Test</option>
              <option value="patch">Patch Test</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="วันที่ตรวจ *">
            <input type="date" value={testedAt} onChange={(e) => setTestedAt(e.target.value)}
              className="w-full rounded-xl border border-ink-10 bg-white px-3 py-2 text-sm" />
          </Field>
          <Field label="Lab / สถานพยาบาล">
            <input type="text" value={testLab} onChange={(e) => setTestLab(e.target.value)}
              placeholder="N Health / ImuPro / โรงพยาบาล..."
              className="w-full rounded-xl border border-ink-10 bg-white px-3 py-2 text-sm" />
          </Field>
          <Field label="ชื่อ Test">
            <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)}
              placeholder="Food Sensitivity Report 220 panel"
              className="w-full rounded-xl border border-ink-10 bg-white px-3 py-2 text-sm" />
          </Field>
          <Field label="จำนวน foods ใน panel">
            <input type="number" value={panelSize} onChange={(e) => setPanelSize(e.target.value)}
              placeholder="220"
              className="w-full rounded-xl border border-ink-10 bg-white px-3 py-2 text-sm" />
          </Field>
          <Field label="หมายเหตุ (optional)" full>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} placeholder="ELIMINATE list (≥30 score · 3-6 months) + REDUCE list..."
              className="w-full rounded-xl border border-ink-10 bg-white px-3 py-2 text-sm" />
          </Field>
        </div>
      </div>

      {/* ── Bulk paste ── */}
      <div className="rounded-3xl border border-ink-10 bg-white p-6">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="font-head text-[16px] font-bold text-ink">📝 Bulk Paste Allergens</h2>
          <button type="button" onClick={() => setPasteHelp(!pasteHelp)} className="text-[11px] text-rose hover:underline">
            {pasteHelp ? "ซ่อนคำอธิบาย" : "ดูรูปแบบ"}
          </button>
        </div>
        {pasteHelp && (
          <div className="mb-3 rounded-xl bg-surface p-4 text-[12px] text-ink-60 font-mono leading-relaxed">
            แต่ละบรรทัด · คั่นด้วย <span className="text-rose">tab</span> หรือ comma:
            <br/><br/>
            <code className="text-ink">
              ยีสต์&nbsp;&nbsp;Yeast Baker's&nbsp;&nbsp;fungus&nbsp;&nbsp;81&nbsp;&nbsp;eliminate<br/>
              นมวัว&nbsp;&nbsp;Milk Cow&nbsp;&nbsp;dairy&nbsp;&nbsp;43&nbsp;&nbsp;eliminate<br/>
              ส้ม&nbsp;&nbsp;Orange&nbsp;&nbsp;fruit&nbsp;&nbsp;27&nbsp;&nbsp;reduce
            </code>
            <br/><br/>
            <span className="text-ink-40">
              Column: TH, EN, category, score, severity · severity จะ auto-derive จาก score ถ้าเว้นว่าง (≥30=eliminate · 20-29=reduce · &lt;20=within_limit)
            </span>
          </div>
        )}
        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
          rows={6} placeholder="paste TSV/CSV ที่นี่..."
          className="w-full rounded-xl border border-ink-10 bg-white px-3 py-2 text-sm font-mono" />
        <div className="mt-3 flex gap-2">
          <Button variant="rose" onClick={parsePaste} disabled={!pasteText.trim()}>
            ⬇️ Parse → เพิ่มใน table
          </Button>
          <Button variant="outline" onClick={addEmptyRow}>+ เพิ่มแถวว่าง</Button>
        </div>
      </div>

      {/* ── Allergens table ── */}
      <div className="rounded-3xl border border-ink-10 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head text-[16px] font-bold text-ink">🧪 Allergens ({rows.length})</h2>
          <div className="flex gap-2 text-[11px] font-mono">
            <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-0.5">eliminate {counts.eliminate}</span>
            <span className="rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5">reduce {counts.reduce}</span>
            <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5">ok {counts.within_limit}</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-10 bg-surface p-8 text-center">
            <div className="text-2xl">📋</div>
            <p className="mt-2 font-thai text-[13px] text-ink-60">ยังไม่มี allergen · paste หรือเพิ่มทีละแถวด้านบน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-10 text-[10px] font-mono uppercase tracking-wider text-ink-40">
                  <th className="px-2 py-2 text-left">TH</th>
                  <th className="px-2 py-2 text-left">EN</th>
                  <th className="px-2 py-2 text-left">Category</th>
                  <th className="px-2 py-2 text-center">Score</th>
                  <th className="px-2 py-2 text-left">Severity</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-ink-5 hover:bg-surface">
                    <td className="px-2 py-1.5">
                      <input value={r.food_name_th} onChange={(e) => updateRow(i, { food_name_th: e.target.value })}
                        className="w-full rounded border border-ink-10 bg-white px-2 py-1 text-[12px] font-thai" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={r.food_name_en} onChange={(e) => updateRow(i, { food_name_en: e.target.value })}
                        className="w-full rounded border border-ink-10 bg-white px-2 py-1 text-[12px] font-mono" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={r.food_category} onChange={(e) => updateRow(i, { food_category: e.target.value })}
                        className="w-full rounded border border-ink-10 bg-white px-2 py-1 text-[12px]">
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input type="number" value={r.score} onChange={(e) => updateRow(i, { score: e.target.value })}
                        className="w-16 rounded border border-ink-10 bg-white px-2 py-1 text-[12px] text-center font-mono" />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={r.severity} onChange={(e) => updateRow(i, { severity: e.target.value as any, recommended_action: ACTION_BY_SEVERITY[e.target.value as AllergenRow["severity"]] })}
                        className={`w-full rounded px-2 py-1 text-[11px] font-bold border ${
                          r.severity === "eliminate" ? "border-red-300 bg-red-50 text-red-700" :
                          r.severity === "reduce"    ? "border-amber-300 bg-amber-50 text-amber-700" :
                          r.severity === "within_limit" ? "border-green-300 bg-green-50 text-green-700" :
                          "border-ink-10 bg-white text-ink-60"}`}>
                        <option value="eliminate">eliminate</option>
                        <option value="reduce">reduce</option>
                        <option value="within_limit">within_limit</option>
                        <option value="unknown">unknown</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button type="button" onClick={() => removeRow(i)} className="text-ink-40 hover:text-red-600 text-[14px]">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Submit bar ── */}
      <div className="sticky bottom-4 z-30 flex items-center justify-between gap-3 rounded-2xl border border-ink-10 bg-white px-6 py-4 shadow-lg">
        {error && <div className="font-thai text-[12px] text-red-600">⚠️ {error}</div>}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => history.back()} disabled={submitting}>ยกเลิก</Button>
          <Button variant="rose" onClick={submit} disabled={submitting}>
            {submitting ? "กำลังบันทึก..." : `บันทึก Test + ${rows.length} allergens`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; value?: any; onChange?: any; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "col-span-full" : ""}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-60">{label}</span>
      {children}
    </label>
  );
}
