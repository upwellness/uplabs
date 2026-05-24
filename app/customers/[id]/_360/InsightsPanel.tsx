"use client";

import type { InsightResult, Insight, Severity } from "@/lib/customers/insight-rules";

const SEV_STYLE: Record<Severity, { bg: string; text: string; border: string }> = {
  critical: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  watch:    { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  info:     { bg: "#DCFCE7", text: "#14532D", border: "#86EFAC" },
};

function InsightCard({ ins }: { ins: Insight }) {
  const s = SEV_STYLE[ins.severity];
  return (
    <div className="rounded-2xl border p-3" style={{ background: s.bg, borderColor: s.border }}>
      <div className="font-thai text-[13px] font-semibold leading-snug" style={{ color: s.text }}>
        {ins.title}
      </div>
      {ins.detail && <p className="mt-1 text-[11px] leading-snug" style={{ color: s.text, opacity: 0.85 }}>{ins.detail}</p>}
      {ins.metric && <div className="mt-1 font-mono text-[9px] uppercase tracking-wider opacity-60" style={{ color: s.text }}>{ins.metric}</div>}
      {ins.action && (
        ins.href ? (
          <a href={ins.href} className="mt-2 inline-block rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-white transition" style={{ color: s.text }}>
            {ins.action} →
          </a>
        ) : (
          <span className="mt-2 inline-block rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: s.text }}>
            {ins.action}
          </span>
        )
      )}
    </div>
  );
}

export function InsightsPanel({ insights }: { insights: InsightResult }) {
  const total = insights.alerts.length + insights.trends.length + insights.actions.length;

  return (
    <section className="rounded-3xl border border-ink-10 bg-white p-5">
      <h2 className="font-head text-[15px] font-extrabold tracking-tight text-ink mb-1">⚡ Smart Insights</h2>
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-40 mb-4">
        {total > 0 ? `${total} items detected` : "ทุกอย่างปกติ"}
      </p>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-10 bg-surface p-6 text-center">
          <div className="text-2xl">✨</div>
          <p className="mt-2 font-thai text-[12px] text-ink-40">ไม่มี alert / trend / action ที่ต้องสนใจ</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.alerts.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-60">
                🚨 Alerts <span className="font-bold text-red-700">{insights.alerts.length}</span>
              </div>
              <div className="space-y-2">
                {insights.alerts.map(ins => <InsightCard key={ins.id} ins={ins} />)}
              </div>
            </div>
          )}

          {insights.trends.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-60">
                📈 Trends <span className="font-bold">{insights.trends.length}</span>
              </div>
              <div className="space-y-2">
                {insights.trends.map(ins => <InsightCard key={ins.id} ins={ins} />)}
              </div>
            </div>
          )}

          {insights.actions.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-60">
                🎯 Next Best Action <span className="font-bold">{insights.actions.length}</span>
              </div>
              <div className="space-y-2">
                {insights.actions.map(ins => <InsightCard key={ins.id} ins={ins} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
