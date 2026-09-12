import { planByToken } from "@/lib/health-design/plan-store";
import { DOMAIN_LABEL_TH } from "@/lib/health-design/assess";

export const dynamic = "force-dynamic";

const AREA_TH: Record<string, string> = { sleep: "การนอน", steps: "การเดิน", resistance: "ฝึกแรงต้าน", food_log: "บันทึกอาหาร", cgm: "ติดเซ็นเซอร์น้ำตาล" };
const GOAL_TH: Record<string, string> = { loss: "ลดไขมัน / น้ำหนัก", longevity: "ชะลอวัย", muscle: "สร้างกล้ามเนื้อ" };

/** Public, token-gated view of a confirmed-and-sent plan — the page the customer opens from LINE. */
export default async function PlanPage({ params }: { params: { token: string } }) {
  const r = await planByToken(params.token);
  if (!r) return <Shell><p className="font-thai text-sm text-ink-60">ไม่พบแผน หรือโค้ชยังไม่ได้ส่ง</p></Shell>;
  const p = r.plan;
  const sent = new Date(r.sent_at).toLocaleDateString("th-TH", { dateStyle: "long" });
  return (
    <Shell>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose">UP Health Design</div>
      <h1 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">แผนดูแลสุขภาพ 90 วัน — {r.customer_name}</h1>
      <p className="mt-1 font-thai text-[12px] text-ink-60">เป้าหมายหลัก: <b className="text-ink">{GOAL_TH[p.goal] ?? p.goal}</b> · โค้ชยืนยันและส่งเมื่อ {sent}</p>
      {r.coach_note && <div className="mt-4 rounded-2xl border border-wellness/30 bg-wellness/5 p-4 font-thai text-sm text-ink">💬 {r.coach_note}</div>}

      <Section title="เป้า 90 วัน">
        {p.goals_90d.map((g, i) => (
          <div key={i} className="rounded-xl border border-ink-10 p-3">
            <div className="text-[11px] font-semibold text-ink-60">{DOMAIN_LABEL_TH[g.domain]}</div>
            <div className="mt-0.5 font-thai text-sm font-semibold text-ink">{g.target}</div>
            <div className="mt-0.5 font-thai text-[12px] text-ink-60">{g.why}</div>
            <div className="mt-0.5 font-thai text-[11px] text-ink-40">วัดผล: {g.measure}</div>
          </div>
        ))}
      </Section>

      {p.nutrition.targets && (
        <Section title="อาหาร">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["พลังงาน", `${p.nutrition.targets.kcal} kcal`], ["โปรตีน", `${p.nutrition.targets.p} g (${p.nutrition.targets.protein_g_per_kg} g/kg)`], ["คาร์บ", `${p.nutrition.targets.c} g`], ["ไขมัน", `${p.nutrition.targets.f} g`]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface p-3"><div className="text-[11px] text-ink-60">{k}/วัน</div><div className="font-head text-lg font-bold text-ink">{v}</div></div>
            ))}
          </div>
          {p.nutrition.notes.map((n, i) => <p key={i} className="mt-2 font-thai text-[12px] text-ink-60">• {n}</p>)}
          {p.nutrition.sample_days.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer font-thai text-sm font-semibold text-ink">เมนูตัวอย่าง 7 วัน</summary>
              <div className="mt-2 space-y-3">
                {p.nutrition.sample_days.map((day, di) => (
                  <div key={di} className="rounded-xl border border-ink-10 p-3">
                    <div className="text-[11px] font-semibold text-ink-60">วันที่ {di + 1}</div>
                    {day.map((m, mi) => (
                      <div key={mi} className="mt-1 font-thai text-[12px] text-ink"><b>{m.name}:</b> {m.items.map((it) => `${it.th} ${it.g}${it.u}`).join(" · ")} <span className="text-ink-40">({m.tot.kcal} kcal · P{m.tot.p})</span></div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}
        </Section>
      )}

      <Section title="กิจวัตร">
        {p.lifestyle.map((l, i) => (
          <div key={i} className="rounded-xl border border-ink-10 p-3">
            <div className="font-thai text-sm font-semibold text-ink">{AREA_TH[l.area] ?? l.area}: {l.target}</div>
            {l.current && <div className="font-thai text-[12px] text-ink-60">ตอนนี้ {l.current}</div>}
            <div className="font-thai text-[11px] text-ink-40">{l.why}</div>
          </div>
        ))}
      </Section>

      <Section title="อาหารเสริม (ตามที่เภสัชกรจัด)">
        {p.supplements.schedule?.length ? p.supplements.schedule.map((s, i) => (
          <div key={i} className="font-thai text-sm text-ink"><b>{s.meal_slot}:</b> {s.items.join(", ")}</div>
        )) : <p className="font-thai text-[12px] text-ink-60">{p.supplements.note}</p>}
      </Section>

      <Section title="ตรวจซ้ำเมื่อไร">
        {p.retest.map((t, i) => <div key={i} className="font-thai text-sm text-ink">• {t.what} — ภายใน {t.when_days} วัน <span className="text-[12px] text-ink-60">({t.why})</span></div>)}
      </Section>

      {p.doctor_flags.length > 0 && (
        <Section title="ควรปรึกษาแพทย์">
          {p.doctor_flags.map((f, i) => <div key={i} className="rounded-xl border border-status-danger/30 bg-status-bg-danger p-3 font-thai text-sm text-status-danger">{f.label_th} {f.value} — {f.message}</div>)}
        </Section>
      )}

      <p className="mt-8 font-thai text-[11px] leading-relaxed text-ink-40">{p.disclaimer}</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-2xl rounded-3xl border border-ink-10 bg-white p-6 sm:p-10">{children}</div>
      <footer className="py-6 text-center font-mono text-[11px] text-ink-40">UP Wellness · Health Design</footer>
    </main>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section className="mt-6"><h2 className="mb-2 font-head text-[15px] font-bold text-ink">{title}</h2><div className="space-y-2">{children}</div></section>);
}
