"use client";

import Link from "next/link";

interface PulseAssessment {
  id:         string;
  status:     string;
  blocked:    boolean;
  share_token:string | null;
  sent_at:    string | null;
  created_at: string;
  ai_output:  any;
}

interface PulseIntake {
  submitted_at: string;
  goal:         string | null;
  budget_range: string | null;
}

export function PulseTab({
  assessments,
  intake,
}: {
  assessments: PulseAssessment[];
  intake: PulseIntake | null;
}) {
  return (
    <div className="space-y-4">
      {intake && (
        <div className="liquid rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-thai text-[14px] font-bold text-ink">📋 Latest Intake</h3>
            <span className="font-mono text-[10px] text-ink-40">
              {new Date(intake.submitted_at).toLocaleDateString("th-TH")}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-white/40 backdrop-blur-md border border-white/60 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wider text-ink-40">เป้าหมาย</div>
              <div className="mt-0.5 font-thai text-[13px] text-ink">{intake.goal ?? "—"}</div>
            </div>
            <div className="rounded-xl bg-white/40 backdrop-blur-md border border-white/60 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wider text-ink-40">งบประมาณ</div>
              <div className="mt-0.5 font-thai text-[13px] text-ink">{intake.budget_range ?? "—"}</div>
            </div>
          </div>
        </div>
      )}

      <div className="liquid rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-thai text-[14px] font-bold text-ink">📱 Pulse Assessments</h3>
          <span className="font-mono text-[10px] text-ink-40">{assessments.length} รายการ</span>
        </div>

        {assessments.length === 0 ? (
          <div className="liquid rounded-xl p-6 text-center border-dashed">
            <p className="font-thai text-[12px] text-ink-60">ยังไม่มี Pulse assessment</p>
            <Link href="/pulse" className="mt-3 inline-block rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white">
              → ไป Pulse
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {assessments.slice(0, 5).map(a => (
              <div key={a.id} className="rounded-xl bg-white/40 backdrop-blur-md border border-white/60 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-thai text-[13px] font-semibold text-ink">
                        {a.blocked ? "⚕️ Blocked" : a.sent_at ? "✅ Sent" : "📝 Draft"}
                      </div>
                      <div className="font-mono text-[10px] text-ink-40">
                        {new Date(a.created_at).toLocaleDateString("th-TH")}
                      </div>
                    </div>
                    {a.ai_output?.summary && (
                      <p className="mt-1 font-thai text-[11px] text-ink-60 line-clamp-2">{a.ai_output.summary}</p>
                    )}
                  </div>
                  <Link href={`/pulse/assessments/${a.id}`} target="_blank"
                    className="rounded-md border border-ink-10 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-ink-20">
                    👁
                  </Link>
                </div>
              </div>
            ))}
            {assessments.length > 5 && (
              <p className="mt-2 font-mono text-[10px] text-ink-40 text-center">
                แสดง 5 จาก {assessments.length} · <Link href="/pulse" className="text-rose">ดูทั้งหมด →</Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
