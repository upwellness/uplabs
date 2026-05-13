"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { RISK_LABEL } from "@/lib/healthcheck/score";

interface Lead {
  id:             string;
  coach_id:       string | null;
  quiz_type:      string;
  created_at:     string;
  name:           string;
  phone:          string | null;
  email:          string | null;
  line_id:        string | null;
  consent_followup: boolean;
  age:            number | null;
  gender:         string | null;
  height_cm:      number | null;
  weight_kg:      number | null;
  waist_cm:       number | null;
  bmi:            number | null;
  risk_score:     number;
  risk_level:     "low" | "moderate" | "high" | "very_high";
  flags:          string[];
  answers:        any;
  status:         string;
  contacted_at:   string | null;
  customer_id:    string | null;
  notes:          string | null;
}

const STATUS_TABS = [
  { v: "all",       label: "ทั้งหมด" },
  { v: "new",       label: "ใหม่" },
  { v: "contacted", label: "ติดต่อแล้ว" },
  { v: "converted", label: "เป็นลูกค้า" },
  { v: "dismissed", label: "ปิด" },
];

export default function HealthCheckPage() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab,     setTab]       = useState("all");
  const [quizType, setQuizType] = useState<"all" | "healthcheck" | "metaflex">("all");
  const [search,  setSearch]    = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [coachId,  setCoachId]  = useState<string>("");
  const checkUrl    = coachId ? `${typeof window !== "undefined" ? window.location.origin : ""}/check/${coachId}`    : "";
  const metaflexUrl = coachId ? `${typeof window !== "undefined" ? window.location.origin : ""}/metaflex/${coachId}` : "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/healthcheck/leads${tab !== "all" ? `?status=${tab}` : ""}`);
      const json = await res.json();
      setLeads(json.leads ?? []);
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/debug/me").then(r => r.json()).then((d) => {
      if (d.user?.id) setCoachId(d.user.id);
    });
  }, []);

  const filtered = useMemo(() => {
    let l = leads;
    if (quizType !== "all") l = l.filter((x) => x.quiz_type === quizType);
    if (search) {
      const s = search.toLowerCase();
      l = l.filter((x) =>
        x.name.toLowerCase().includes(s) ||
        x.phone?.includes(s) ||
        x.line_id?.toLowerCase().includes(s),
      );
    }
    return l;
  }, [leads, search, quizType]);

  const counts = useMemo(() => ({
    new:       leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    converted: leads.filter((l) => l.status === "converted").length,
    high_risk: leads.filter((l) => l.risk_level === "high" || l.risk_level === "very_high").length,
  }), [leads]);

  const updateLead = async (id: string, patch: Partial<Lead>) => {
    const res = await fetch(`/api/healthcheck/leads/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) load();
  };

  const convertLead = async (id: string) => {
    if (!confirm("Convert lead นี้เป็นลูกค้าในระบบ?")) return;
    const res = await fetch(`/api/healthcheck/leads/${id}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    alert(`Converted! Customer ID: ${json.customer.id}`);
    load();
  };

  const copyLink = async (url: string, label: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    alert(`คัดลอกลิงก์ ${label} แล้ว — ส่งให้คนทาง LINE/SNS`);
  };

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">
              Health Check · Lead Capture
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-10 py-10">
        {/* Share link cards — 2 quizzes */}
        <section className="grid gap-4 md:grid-cols-2">
          <ShareCard
            title="🏥 Health Check"
            desc="ประเมินสุขภาพ metabolic ครบชุด · risk score · BMI · 6 sections"
            url={checkUrl}
            onCopy={() => copyLink(checkUrl, "Health Check")}
          />
          <ShareCard
            title="🔥 MetaFlex Quiz"
            desc="วัด Metabolic Flexibility · sci-fi UI · quick 8 คำถาม"
            url={metaflexUrl}
            onCopy={() => copyLink(metaflexUrl, "MetaFlex Quiz")}
          />
        </section>

        {/* Stats */}
        <section className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Lead ใหม่"      value={counts.new}       color="#2563EB" />
          <Stat label="ติดต่อแล้ว"     value={counts.contacted} color="#EAB308" />
          <Stat label="เป็นลูกค้าแล้ว" value={counts.converted} color="#16A34A" />
          <Stat label="High Risk"      value={counts.high_risk} color="#DC2626" />
        </section>

        {/* Filters: Quiz Type + Status + Search */}
        <section className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Quiz:</span>
            {([
              { v: "all",         label: "ทั้งหมด" },
              { v: "healthcheck", label: "🏥 Health Check" },
              { v: "metaflex",    label: "🔥 MetaFlex" },
            ] as const).map((t) => (
              <button
                key={t.v}
                onClick={() => setQuizType(t.v)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                  quizType === t.v
                    ? "border-rose bg-rose text-white"
                    : "border-ink-10 bg-white text-ink-60 hover:border-ink-20"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Status:</span>
              {STATUS_TABS.map((t) => (
                <button
                  key={t.v}
                  onClick={() => setTab(t.v)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                    tab === t.v
                      ? "border-rose bg-rose text-white"
                      : "border-ink-10 bg-white text-ink-60 hover:border-ink-20"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 ค้นหาชื่อ / เบอร์ / LINE..."
              className="w-full sm:w-72 rounded-full border border-ink-10 bg-white px-4 py-2 text-sm outline-none focus:border-rose"
            />
          </div>
        </section>

        {/* Leads list */}
        <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-6">
          {loading ? (
            <div className="py-12 text-center font-thai text-sm text-ink-40">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center font-thai text-sm text-ink-40">ยังไม่มี lead</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  isMine={l.coach_id === coachId}
                  onClick={() => setSelected(l)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <LeadDetailModal
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateLead}
          onConvert={convertLead}
        />
      )}
    </main>
  );
}

/* ───────────────────────────────────────────────── */

function ShareCard({ title, desc, url, onCopy }: { title: string; desc: string; url: string; onCopy: () => void }) {
  return (
    <div className="rounded-3xl border border-rose bg-rose-ultra p-5">
      <div className="font-head text-[16px] font-extrabold text-ink">{title}</div>
      <p className="mt-1 font-thai text-[12px] text-ink-60">{desc}</p>
      {url ? (
        <div className="mt-3 rounded-xl bg-ink p-2.5 font-mono text-[10px] text-white break-all">{url}</div>
      ) : (
        <div className="mt-3 h-9 animate-pulse rounded-xl bg-ink-10" />
      )}
      <div className="mt-3 flex gap-2">
        <Button variant="rose" size="sm" onClick={onCopy} disabled={!url}>📋 Copy</Button>
        {url && (
          <a href={url} target="_blank" rel="noopener" className="rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink">
            👁 Preview
          </a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-5 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-1 font-head text-[28px] font-extrabold leading-none" style={{ color }}>{value}</div>
    </div>
  );
}

function LeadRow({ lead, isMine, onClick }: { lead: Lead; isMine: boolean; onClick: () => void }) {
  const meta = RISK_LABEL[lead.risk_level] ?? RISK_LABEL.moderate;
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-2xl border border-ink-10 bg-white p-4 text-left hover:border-ink-20 hover:shadow-sm transition-all"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-head text-[15px] font-bold text-ink truncate">{lead.name}</div>
            <QuizPill type={lead.quiz_type} />
            {!isMine && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-700">other coach</span>}
            <StatusPill status={lead.status} />
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-40">
            {lead.phone && <span>📞 {lead.phone}</span>}
            {lead.line_id && <span className="ml-2">💬 {lead.line_id}</span>}
            <span className="ml-2">·</span>
            <span className="ml-1">{new Date(lead.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: meta.bg, color: meta.color }}>
            {lead.risk_score} · {meta.th}
          </div>
        </div>
      </div>
    </button>
  );
}

function QuizPill({ type }: { type: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    healthcheck: { bg: "#DBEAFE", fg: "#1D4ED8", label: "🏥 HEALTH" },
    metaflex:    { bg: "#FEE2E2", fg: "#B91C1C", label: "🔥 METAFLEX" },
  };
  const m = map[type] ?? map.healthcheck;
  return (
    <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider"
      style={{ background: m.bg, color: m.fg }}>{m.label}</span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    new:       { bg: "#DBEAFE", fg: "#2563EB", label: "NEW" },
    contacted: { bg: "#FEF9C3", fg: "#A16207", label: "CONTACTED" },
    converted: { bg: "#DCFCE7", fg: "#16A34A", label: "CONVERTED" },
    dismissed: { bg: "#F1F5F9", fg: "#64748B", label: "DISMISSED" },
  };
  const m = map[status] ?? map.new;
  return (
    <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider"
      style={{ background: m.bg, color: m.fg }}>{m.label}</span>
  );
}

function LeadDetailModal({ lead, onClose, onUpdate, onConvert }: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
  onConvert: (id: string) => void;
}) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const meta = RISK_LABEL[lead.risk_level] ?? RISK_LABEL.moderate;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-auto w-full max-w-2xl rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-10 bg-white px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Lead Detail</div>
            <div className="mt-0.5 font-head text-xl font-extrabold text-ink">{lead.name}</div>
          </div>
          <button onClick={onClose} className="text-ink-40 hover:text-ink text-2xl">×</button>
        </div>

        <div className="space-y-5 p-6">
          {/* Risk + BMI */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 text-center" style={{ background: meta.bg }}>
              <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: meta.color }}>Risk Score</div>
              <div className="mt-1 font-head text-[36px] font-extrabold leading-none" style={{ color: meta.color }}>{lead.risk_score}</div>
              <div className="mt-1 font-mono text-[11px]" style={{ color: meta.color }}>{meta.th}</div>
            </div>
            {lead.bmi != null && (
              <div className="rounded-2xl bg-surface p-4 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">BMI</div>
                <div className="mt-1 font-head text-[36px] font-extrabold leading-none text-ink">{lead.bmi}</div>
              </div>
            )}
          </div>

          {/* Contact */}
          <Section title="ติดต่อ">
            <Row label="เบอร์โทร" value={lead.phone} copyable />
            <Row label="LINE"     value={lead.line_id} copyable />
            <Row label="Email"    value={lead.email} copyable />
            <Row label="ยินยอมติดต่อ" value={lead.consent_followup ? "✅ ใช่" : "❌ ไม่"} />
          </Section>

          {/* Demographics */}
          <Section title="ข้อมูลพื้นฐาน">
            <Row label="อายุ"     value={lead.age?.toString()} />
            <Row label="เพศ"      value={lead.gender === "male" ? "ชาย" : lead.gender === "female" ? "หญิง" : "—"} />
            <Row label="ส่วนสูง"  value={lead.height_cm ? `${lead.height_cm} cm` : null} />
            <Row label="น้ำหนัก"  value={lead.weight_kg ? `${lead.weight_kg} kg` : null} />
            <Row label="รอบเอว"   value={lead.waist_cm ? `${lead.waist_cm} cm` : null} />
          </Section>

          {/* Flags */}
          {lead.flags.length > 0 && (
            <Section title="ปัจจัยที่พบ">
              <ul className="space-y-1">
                {lead.flags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 font-thai text-[13px] text-ink">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />{f}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Coach notes */}
          <Section title="หมายเหตุ (coach)">
            <textarea
              rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="บันทึกเกี่ยวกับ lead นี้..."
              className="w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
            />
            <Button size="sm" variant="outline" className="mt-2" onClick={() => onUpdate(lead.id, { notes })}>บันทึกหมายเหตุ</Button>
          </Section>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-t border-ink-10 pt-4">
            {lead.status === "new" && (
              <Button variant="primary" size="sm" onClick={() => onUpdate(lead.id, { status: "contacted" })}>
                ✓ ติดต่อแล้ว
              </Button>
            )}
            {lead.status !== "converted" && (
              <Button variant="rose" size="sm" onClick={() => onConvert(lead.id)}>
                ➡️ Convert เป็นลูกค้า
              </Button>
            )}
            {lead.status !== "dismissed" && (
              <Button variant="ghost" size="sm" onClick={() => onUpdate(lead.id, { status: "dismissed" })}>
                ปิด (dismiss)
              </Button>
            )}
            {lead.customer_id && (
              <Link href={`/bca?customer=${lead.customer_id}`} className="rounded-full border border-ink-10 px-4 py-2 text-[12px] font-semibold text-ink">
                → ไป BCA
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-40 mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, copyable }: { label: string; value: string | null | undefined; copyable?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-[13px]">
      <span className="text-ink-60">{label}</span>
      <span className="font-mono text-ink">
        {value}
        {copyable && (
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(value); }} className="ml-2 text-ink-40 hover:text-rose" title="copy">📋</button>
        )}
      </span>
    </div>
  );
}
