"use client";

import { AlertTriangle, TrendingUp, Target, Sparkles, Zap } from "lucide-react";
import type { InsightResult, Insight, Severity } from "@/lib/customers/insight-rules";

const SEV_CLASS: Record<Severity, string> = {
  critical: "liquid-critical",
  watch:    "liquid-watch",
  info:     "liquid-info",
};
const SEV_TEXT: Record<Severity, string> = {
  critical: "#991B1B",
  watch:    "#92400E",
  info:     "#14532D",
};

function InsightCard({ ins }: { ins: Insight }) {
  const cls = SEV_CLASS[ins.severity];
  const txt = SEV_TEXT[ins.severity];
  return (
    <div className={`${cls} rounded-2xl p-3 transition-all hover:translate-x-0.5`}>
      <div className="font-thai text-[13px] font-semibold leading-snug" style={{ color: txt }}>
        {ins.title}
      </div>
      {ins.detail && <p className="mt-1 text-[11px] leading-snug" style={{ color: txt, opacity: 0.85 }}>{ins.detail}</p>}
      {ins.metric && <div className="mt-1 font-mono text-[9px] uppercase tracking-wider opacity-60" style={{ color: txt }}>{ins.metric}</div>}
      {ins.action && (
        ins.href ? (
          <a href={ins.href} className="mt-2 inline-block rounded-full bg-white/70 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-white/95 transition" style={{ color: txt }}>
            {ins.action} →
          </a>
        ) : (
          <span className="mt-2 inline-block rounded-full bg-white/70 backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: txt }}>
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
    <section className="liquid liquid-shine rounded-3xl p-5">
      <h2 className="font-head text-[15px] font-extrabold tracking-tight text-ink mb-1 inline-flex items-center gap-1.5">
        <Zap size={15} strokeWidth={2.25} className="text-rose" aria-hidden="true" /> สิ่งที่น่าสังเกต
      </h2>
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-40 mb-4">
        {total > 0 ? `พบ ${total} เรื่องน่าสนใจ` : "ทุกอย่างดูดีค่ะ"}
      </p>

      {total === 0 ? (
        <div className="liquid-info rounded-2xl p-6 text-center">
          <Sparkles size={26} strokeWidth={1.75} className="mx-auto" style={{ color: SEV_TEXT.info }} aria-hidden="true" />
          <p className="mt-2 font-thai text-[12.5px]" style={{ color: SEV_TEXT.info }}>
            ทุกอย่างดูดีค่ะ ไม่มีสัญญาณที่ต้องกังวลตอนนี้
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.alerts.length > 0 && (
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-60">
                <AlertTriangle size={12} strokeWidth={2.25} className="text-red-700" aria-hidden="true" />
                จุดที่ควรดู <span className="font-bold text-red-700">{insights.alerts.length}</span>
              </div>
              <div className="space-y-2">
                {insights.alerts.map(ins => <InsightCard key={ins.id} ins={ins} />)}
              </div>
            </div>
          )}

          {insights.trends.length > 0 && (
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-60">
                <TrendingUp size={12} strokeWidth={2.25} aria-hidden="true" />
                แนวโน้ม <span className="font-bold">{insights.trends.length}</span>
              </div>
              <div className="space-y-2">
                {insights.trends.map(ins => <InsightCard key={ins.id} ins={ins} />)}
              </div>
            </div>
          )}

          {insights.actions.length > 0 && (
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-ink-60">
                <Target size={12} strokeWidth={2.25} aria-hidden="true" />
                สิ่งที่ควรทำต่อ <span className="font-bold">{insights.actions.length}</span>
              </div>
              <div className="space-y-2">
                {insights.actions.map(ins => <InsightCard key={ins.id} ins={ins} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Medical disclaimer · TPM scope-of-practice safeguard */}
      <p className="mt-5 pt-4 border-t border-ink/8 font-thai text-[10.5px] text-ink-60 leading-relaxed">
        ⚖️ ข้อมูลในกล่องนี้ใช้สำหรับ <strong>wellness coaching</strong> เท่านั้น ·
        ไม่ใช่การวินิจฉัยทางการแพทย์ · ค่าผิดปกติทุกครั้ง <strong>ควรปรึกษาแพทย์</strong> เพื่อยืนยัน
      </p>
    </section>
  );
}
