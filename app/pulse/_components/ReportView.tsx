/**
 * Shared report view — used by both:
 *  - /pulse/assessments/[id] (coach preview, before publish)
 *  - /r/[share_token]        (public, after publish)
 */
import { Logo } from "@/components/ui/Logo";

interface AiOutput {
  summary?: string;
  observations?: string[];
  recommendations?: Array<{
    category: string;
    why: string;
    evidence_grade: string;
    skus: Array<{ sku: string; dose: string; timing?: string }>;
  }>;
  next_step?: string;
}

interface ReportViewProps {
  customerName: string;
  aiOutput: AiOutput | null;
  blocked: boolean;
  blockReasons?: string[];
  generatedAt: string;
  isPreview?: boolean;
}

export function ReportView({ customerName, aiOutput, blocked, blockReasons, generatedAt, isPreview }: ReportViewProps) {
  if (blocked) {
    return (
      <main className="min-h-screen bg-surface px-6 py-12">
        <div className="mx-auto max-w-2xl">
          {isPreview && <PreviewBanner />}
          <Logo size="md" />
          <div className="mt-8 rounded-3xl border-2 border-amber-300 bg-amber-50 p-8">
            <div className="text-3xl">⚕️</div>
            <h1 className="mt-3 font-head text-2xl font-extrabold text-amber-900">
              {customerName} — ขอให้ปรึกษาแพทย์ก่อน
            </h1>
            <p className="mt-3 font-thai text-[14px] leading-[1.7] text-amber-900">
              จากข้อมูลของคุณ มีปัจจัยที่ต้องตรวจกับแพทย์ก่อน เราจึงยังไม่แนะนำ supplement
            </p>
            <ul className="mt-4 space-y-1 font-thai text-[13px] text-amber-900">
              {(blockReasons ?? []).map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface">
      {isPreview && <PreviewBanner />}
      <header className="border-b border-ink-10 bg-white">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <Logo size="sm" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-40">UP Pulse Report</span>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-6 py-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Personalized Wellness Report</div>
        <h1 className="mt-2 font-head text-[28px] font-extrabold tracking-tight text-ink">สำหรับ {customerName}</h1>
        <p className="mt-1 font-mono text-[11px] text-ink-40">
          {isPreview ? "DRAFT · " : ""}จัดทำเมื่อ {new Date(generatedAt).toLocaleString("th-TH")}
        </p>

        {/* Summary */}
        {aiOutput?.summary && (
          <section className="mt-8 rounded-3xl border border-ink-10 bg-white p-6">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Summary</div>
            <p className="mt-2 font-thai text-[15px] leading-[1.8] text-ink">{aiOutput.summary}</p>
          </section>
        )}

        {/* Observations */}
        {(aiOutput?.observations?.length ?? 0) > 0 && (
          <section className="mt-5 rounded-3xl border border-ink-10 bg-white p-6">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">สิ่งที่สังเกตได้</div>
            <ul className="mt-3 space-y-2">
              {aiOutput!.observations!.map((o, i) => (
                <li key={i} className="flex gap-3 font-thai text-[14px] leading-[1.7] text-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />
                  {o}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recommendations */}
        {(aiOutput?.recommendations?.length ?? 0) > 0 && (
          <section className="mt-5 space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">คำแนะนำ</div>
            {aiOutput!.recommendations!.map((rec, i) => (
              <div key={i} className="rounded-3xl border border-ink-10 bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-head text-[18px] font-bold text-ink">{rec.category}</h3>
                    <p className="mt-1.5 font-thai text-[13px] leading-[1.7] text-ink-60">{rec.why}</p>
                  </div>
                  <GradeBadge grade={rec.evidence_grade} />
                </div>
                {(rec.skus?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-2">
                    {rec.skus.map((s, j) => (
                      <div key={j} className="rounded-xl bg-surface px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="font-head text-[14px] font-bold text-rose">{s.sku}</div>
                          <div className="font-mono text-[12px] text-ink">{s.dose}</div>
                        </div>
                        {s.timing && <div className="mt-1 font-thai text-[11px] text-ink-60">⏰ {s.timing}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Next step */}
        {aiOutput?.next_step && (
          <section className="mt-5 rounded-3xl border-2 border-rose bg-rose-ultra p-6">
            <div className="font-mono text-[10px] uppercase tracking-wider text-rose">ขั้นต่อไป</div>
            <p className="mt-2 font-thai text-[15px] leading-[1.7] text-ink">{aiOutput.next_step}</p>
          </section>
        )}

        {/* Disclaimer */}
        <div className="mt-8 rounded-2xl border border-ink-10 bg-ink-5/50 px-5 py-4 font-thai text-[11px] leading-[1.6] text-ink-60">
          <strong className="text-ink">หมายเหตุ:</strong> เอกสารฉบับนี้คือ wellness recommendation ที่ผ่านการตรวจสอบจากเภสัชกรของ UP Wellness — ไม่ใช่การวินิจฉัยทางการแพทย์ ปรึกษาแพทย์ก่อนเริ่ม supplement หากคุณมีโรคประจำตัว ตั้งครรภ์ ให้นมบุตร หรือกินยาประจำ
        </div>

        <footer className="mt-8 text-center font-mono text-[10px] text-ink-40">
          UPLABS · UP Pulse · UP Wellness
        </footer>
      </article>
    </main>
  );
}

function PreviewBanner() {
  return (
    <div className="sticky top-0 z-50 bg-amber-100 px-6 py-2.5 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-amber-900 border-b-2 border-amber-300">
      👁 Preview Mode · ลูกค้ายังเห็นไม่ได้ จนกว่าจะกด "เผยแพร่"
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const map: Record<string, { fg: string; bg: string }> = {
    A: { fg: "#16A34A", bg: "#DCFCE7" },
    B: { fg: "#EAB308", bg: "#FEF9C3" },
    C: { fg: "#DC2626", bg: "#FEE2E2" },
  };
  const g = map[grade] ?? map.C;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-head text-base font-extrabold"
      style={{ background: g.bg, color: g.fg }}>
      {grade}
    </div>
  );
}
