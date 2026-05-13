"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { METRICS, CATEGORY_LABEL, findMetric, type Category } from "@/lib/records/catalog";

interface ValueEntry {
  metric_key: string;
  value: string;
}

export function NewRecordForm({ customerId }: { customerId: string }) {
  const [recordedAt, setRecordedAt]   = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource]           = useState("Paolo Hospital");
  const [sourceId, setSourceId]       = useState("");
  const [docType, setDocType]         = useState("lab");
  const [notes, setNotes]             = useState("");
  const [entries, setEntries]         = useState<ValueEntry[]>([]);
  const [submitting, setSubmitting]   = useState(false);
  const router = useRouter();

  const grouped = useMemo(() => {
    const m = new Map<Category, typeof METRICS>();
    for (const met of METRICS) {
      if (!m.has(met.category)) m.set(met.category, []);
      m.get(met.category)!.push(met);
    }
    return m;
  }, []);

  const setEntry = (key: string, value: string) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.metric_key === key);
      if (idx === -1) return value.trim() ? [...prev, { metric_key: key, value }] : prev;
      if (!value.trim()) return prev.filter((e) => e.metric_key !== key);
      const next = [...prev];
      next[idx] = { metric_key: key, value };
      return next;
    });
  };

  const getEntry = (key: string) => entries.find((e) => e.metric_key === key)?.value ?? "";

  const submit = async () => {
    if (entries.length === 0) {
      if (!confirm("ยังไม่ใส่ค่าเลย ต้องการบันทึก record เปล่าๆ?")) return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recorded_at: recordedAt,
          source: source.trim() || null,
          source_id: sourceId.trim() || null,
          document_type: docType,
          notes: notes.trim() || null,
          values: entries.map((e) => ({ metric_key: e.metric_key, value: e.value })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "save failed");
      router.push(`/customers/${customerId}/records/${json.record.id}`);
    } catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header info */}
      <section className="rounded-3xl border border-ink-10 bg-white p-6">
        <h2 className="mb-4 font-head text-[16px] font-extrabold tracking-tight text-ink">ข้อมูลรอบการตรวจ</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="วันที่ตรวจ *" type="date" value={recordedAt} onChange={setRecordedAt} />
          <Field label="ประเภท" value={docType} onChange={setDocType} placeholder="lab / annual_physical / imaging" />
          <Field label="โรงพยาบาล / ห้องแลป" value={source} onChange={setSource} />
          <Field label="เลขที่ HN / Lab" value={sourceId} onChange={setSourceId} placeholder="R-62-031476" />
        </div>
        <label className="mt-4 block">
          <Label>หมายเหตุ</Label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none" />
        </label>
      </section>

      {/* Value inputs grouped by category */}
      {Array.from(grouped.entries()).map(([cat, metrics]) => (
        <section key={cat} className="rounded-3xl border border-ink-10 bg-white p-6">
          <h2 className="mb-4 font-head text-[16px] font-extrabold tracking-tight text-ink">
            {CATEGORY_LABEL[cat]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.map((m) => (
              <label key={m.key} className="block">
                <div className="flex items-center justify-between">
                  <Label>{m.th}</Label>
                  <span className="font-mono text-[9px] text-ink-40">
                    {m.ref_low != null && m.ref_high != null ? `${m.ref_low}-${m.ref_high}` :
                     m.ref_high != null ? `< ${m.ref_high}` :
                     m.ref_low != null  ? `> ${m.ref_low}`  :
                     m.ref_text ?? ""} {m.unit && `· ${m.unit}`}
                  </span>
                </div>
                <input
                  value={getEntry(m.key)}
                  onChange={(e) => setEntry(m.key, e.target.value)}
                  placeholder={m.en}
                  className="mt-1.5 w-full rounded-lg border border-ink-10 bg-white px-3 py-2 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      {/* Submit */}
      <div className="sticky bottom-4 z-10 rounded-3xl border-2 border-rose bg-white p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-head text-[14px] font-bold text-ink">
              {entries.length} ค่าพร้อมบันทึก
            </div>
            <div className="font-thai text-[11px] text-ink-60">
              ใส่ค่าเฉพาะที่มีในรายงาน · ไม่ต้องใส่ครบทุกช่อง
            </div>
          </div>
          <Button variant="rose" size="lg" onClick={submit} disabled={submitting}>
            {submitting ? "กำลังบันทึก..." : "💾 บันทึก Record"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none" />
    </label>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">{children}</span>;
}
