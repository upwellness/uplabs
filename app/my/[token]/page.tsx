import { customerByPortalToken, markPortalOpened } from "@/lib/health-design/portal";
import { latestAssessment, runAssessment } from "@/lib/health-design/load";
import { currentPlan, planProgress } from "@/lib/health-design/plan-store";
import { GOAL_STATUS_TH } from "@/lib/health-design/progress";
import { DOMAIN_LABEL_TH, type Level, type DomainKey } from "@/lib/health-design/assess";
import { PortalTools } from "./PortalTools";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DOT: Record<Level, string> = { good: "#3E7C59", watch: "#C9922B", attention: "#B4413C" };
const CLINICAL = new Set<DomainKey>(["metabolic", "cardio_lipid", "liver_kidney"]);
// Same split as the engine's priorities: lab domains escalate to a doctor, the rest are lifestyle work.
const levelLabel = (k: DomainKey, l: Level) => (l === "good" ? "อยู่ในเกณฑ์ดี" : l === "watch" ? "ควรติดตาม" : CLINICAL.has(k) ? "ควรปรึกษาแพทย์" : "ต้องดูแลจริงจัง");
const SOURCE_TH: Record<string, string> = { labs: "ผลเลือด", bca: "เครื่องชั่ง BCA", cgm: "เซ็นเซอร์น้ำตาล", wearable: "นาฬิกา", food: "บันทึกอาหาร", labs_panel: "ผลเลือด", health_age: "อายุสุขภาพ" };
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

/**
 * /my/<token> — the customer's own page (SPEC-Health-Design §3.6). Read-mostly:
 * their assessment in plain words, the plan once the coach sent it, plus two ways to
 * feed the system themselves (meal log, CGM file). Everything a coach sees is here in
 * softer language; nothing here diagnoses.
 */
export default async function PortalPage({ params }: { params: { token: string } }) {
  const c = await customerByPortalToken(params.token);
  if (!c) return <Shell><p className="font-thai text-sm text-ink-60">ลิงก์นี้ใช้ไม่ได้แล้ว — ขอลิงก์ใหม่จากโค้ชของคุณได้เลยค่ะ</p></Shell>;
  await markPortalOpened(c.id);

  const [stored, plan, pp] = await Promise.all([
    (async () => (await latestAssessment(c.id)) ?? (await runAssessment(c.id, "manual").catch(() => null)))(),
    currentPlan(c.id),
    planProgress(c.id).catch(() => null),
  ]);
  const a = stored?.assessment ?? null;
  const first = c.name.split(/\s+/)[0];

  return (
    <Shell>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose">UP Health Design</div>
      <h1 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">สวัสดีคุณ{first}</h1>
      <p className="mt-1 font-thai text-[13px] text-ink-60">หน้านี้เป็นของคุณคนเดียว — ดูภาพรวมสุขภาพ แผนดูแล และส่งข้อมูลให้โค้ชได้จากที่นี่</p>

      <Section title="ภาพรวมสุขภาพของคุณ">
        {!a ? <p className="font-thai text-sm text-ink-60">ยังไม่มีข้อมูลพอจะประเมิน — เริ่มจากส่งผลเลือดหรือชั่ง BCA กับโค้ช หรือบันทึกอาหารด้านล่างได้เลย</p> : (
          <>
            <p className="font-thai text-[12px] text-ink-60">จาก: {a.sources_used.map((s) => SOURCE_TH[s]).join(" · ") || "—"} · อัปเดต {new Date(stored!.computed_at).toLocaleDateString("th-TH", { dateStyle: "medium" })}</p>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(DOMAIN_LABEL_TH) as DomainKey[]).map((k) => {
                const level: Level | null = k === "health_age" ? a.domains.health_age.level : (a.domains[k] as any).level;
                const sub = k === "health_age"
                  ? (a.domains.health_age.phenoage != null ? `${a.domains.health_age.phenoage} ปี (อายุจริง ${a.domains.health_age.chrono_age})` : "ยังคำนวณไม่ได้")
                  : level ? levelLabel(k, level) : "ยังไม่มีข้อมูล";
                return (
                  <li key={k} className="rounded-xl border border-ink-10 p-3">
                    <div className="font-thai text-[12px] font-semibold text-ink">{DOMAIN_LABEL_TH[k]}</div>
                    <div className="mt-1 flex items-center gap-1.5 font-thai text-[12px] text-ink-60">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: level ? DOT[level] : "#c4c0b8" }} aria-hidden />{sub}
                    </div>
                  </li>
                );
              })}
            </ul>
            {a.priorities.length > 0 && (
              <div className="mt-3 rounded-2xl bg-surface p-4">
                <div className="font-thai text-[12px] font-semibold text-ink-60">สิ่งที่ควรใส่ใจก่อน</div>
                {a.priorities.map((p) => <p key={p.rank} className="mt-1 font-thai text-sm text-ink">{p.rank}. {p.why}</p>)}
              </div>
            )}
            {a.data_gaps.length > 0 && (
              <div className="mt-3">
                <div className="font-thai text-[12px] font-semibold text-ink-60">ข้อมูลที่ยังไม่มี — ส่งมาเพิ่มได้ ภาพจะชัดขึ้น</div>
                <ul className="mt-1 list-disc pl-5 font-thai text-[12px] text-ink-60">{a.data_gaps.map((g, i) => <li key={i}>{g.reason}</li>)}</ul>
              </div>
            )}
            <p className="mt-3 font-thai text-[11px] leading-relaxed text-ink-40">{a.disclaimer}</p>
          </>
        )}
      </Section>

      <Section title="แผนดูแล 90 วัน">
        {plan?.status === "sent" && plan.share_token
          ? <a href={`${siteUrl()}/r/plan/${plan.share_token}`} className="inline-block rounded-xl bg-rose px-4 py-2 font-thai text-sm font-semibold text-white">เปิดแผนของคุณ →</a>
          : <p className="font-thai text-sm text-ink-60">{plan ? "โค้ชกำลังตรวจแผนของคุณ — จะส่งให้เมื่อพร้อมค่ะ" : "ยังไม่มีแผน — โค้ชจะร่างให้หลังมีผลประเมิน"}</p>}
        {pp && plan?.status === "sent" && (
          <div className="mt-3 rounded-2xl bg-surface p-4">
            <div className="font-thai text-[12px] font-semibold text-ink-60">ความคืบหน้า — {pp.progress.summary_th}</div>
            <ul className="mt-1.5 space-y-1 font-thai text-sm text-ink">
              {pp.progress.goals.map((g, i) => <li key={i}><b>{GOAL_STATUS_TH[g.status]}</b> · {DOMAIN_LABEL_TH[g.domain]}{g.status !== "no_new_data" && g.note ? <span className="text-ink-60"> — {g.note}</span> : null}</li>)}
            </ul>
            {pp.progress.due_now.length > 0 && <p className="mt-2 font-thai text-[12px] text-status-caution">ถึงกำหนดแล้ว: {pp.progress.due_now.map((d) => d.what).join(" · ")}</p>}
          </div>
        )}
      </Section>

      <PortalTools token={params.token} />

      <p className="mt-8 font-thai text-[11px] text-ink-40">ลิงก์นี้เป็นส่วนตัว อย่าส่งต่อ · ขอลิงก์ใหม่ได้จากโค้ชทุกเมื่อ</p>
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
  return (<section className="mt-6"><h2 className="mb-2 font-head text-[15px] font-bold text-ink">{title}</h2>{children}</section>);
}
