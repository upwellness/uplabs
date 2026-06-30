"use client";

/**
 * UP Labs v2 · CheckForm FORM-Method wizard (SPEC §6 "ฟอร์มยาวมี progress" + §7.7)
 * ────────────────────────────────────────────────────────────────────────────────
 * The FORM Method (Family · Occupation · Recreation · Money) rendered as a 4-step
 * wizard with a progress indicator. Each step collects the matching profile group
 * using the SAME v1 option data (app/checkform/_data/profile-options) so the AI
 * payload is identical to v1. Clinical-warm: Lucide step icons, chip pickers,
 * ≥12px text, ≥44px touch targets, keyboard-friendly.
 *
 * Controlled — owns no draft state; reads/writes ProfileData + DiscData from the page.
 */

import { useMemo } from "react";
import {
  Users, Briefcase, Leaf, Gem, ChevronLeft, ChevronRight, Check, Target,
} from "lucide-react";
import {
  AGE_RANGES, GENDERS, EDUCATIONS, MARITAL,
  OCCUPATIONS, INCOME_RANGES, JOB_SATISFACTION,
  HEALTH_AWARENESS, EXERCISE_FREQ, DIET_STYLE, HOBBIES, TIME_AVAILABLE,
  FAMILY_DEPS, FAMILY_HEALTH, FAMILY_FINANCE,
  DISC_STYLES, DISC_CONFIDENCE,
  type Option, type DiscStyle,
} from "@/app/checkform/_data/profile-options";
import type { ProfileData, DiscData } from "@/app/checkform/_components/ProfileForm";

type StepKey = "F" | "O" | "R" | "M";

const STEPS: { key: StepKey; letter: string; label: string; sub: string; icon: typeof Users }[] = [
  { key: "F", letter: "F", label: "Family", sub: "ครอบครัว · คนที่เขาแคร์", icon: Users },
  { key: "O", letter: "O", label: "Occupation", sub: "งาน · อาชีพ · รายได้", icon: Briefcase },
  { key: "R", letter: "R", label: "Recreation", sub: "ไลฟ์สไตล์ · สุขภาพ", icon: Leaf },
  { key: "M", letter: "M", label: "Money", sub: "เงิน · เป้าหมาย · บุคลิก", icon: Gem },
];

/** How many fields each FORM step considers "filled" — drives the progress ring. */
function stepFilled(key: StepKey, p: ProfileData, disc: DiscData): { filled: number; total: number } {
  switch (key) {
    case "F":
      return {
        filled: [p.family.deps, p.family.health, p.family.finance, p.demographics.marital].filter(Boolean).length,
        total: 4,
      };
    case "O":
      return {
        filled: [p.career.occupation, p.career.incomeRange, p.career.jobSatisfaction].filter(Boolean).length,
        total: 3,
      };
    case "R":
      return {
        filled: [p.lifestyle.healthAwareness, p.lifestyle.exerciseFreq, p.lifestyle.dietStyle, p.lifestyle.timeAvailable].filter(Boolean).length,
        total: 4,
      };
    case "M":
      // Money pillar carries the soft-financial demographics + DISC read.
      return {
        filled: [p.demographics.ageRange, p.demographics.gender, disc.primary].filter(Boolean).length,
        total: 3,
      };
  }
}

interface Props {
  step: number;                       // 0..3
  setStep: (n: number) => void;
  profile: ProfileData;
  disc: DiscData;
  onProfileChange: (p: ProfileData) => void;
  onDiscChange: (d: DiscData) => void;
}

export function ProfileWizard({ step, setStep, profile, disc, onProfileChange, onDiscChange }: Props) {
  const setDemo = (k: keyof ProfileData["demographics"], v?: string) =>
    onProfileChange({ ...profile, demographics: { ...profile.demographics, [k]: v } });
  const setCareer = (k: keyof ProfileData["career"], v?: string) =>
    onProfileChange({ ...profile, career: { ...profile.career, [k]: v } });
  const setLifestyle = <K extends keyof ProfileData["lifestyle"]>(k: K, v: ProfileData["lifestyle"][K]) =>
    onProfileChange({ ...profile, lifestyle: { ...profile.lifestyle, [k]: v } });
  const setFamily = (k: keyof ProfileData["family"], v?: string) =>
    onProfileChange({ ...profile, family: { ...profile.family, [k]: v } });

  const toggleHobby = (h: string) => {
    const cur = profile.lifestyle.hobbies ?? [];
    setLifestyle("hobbies", cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h]);
  };

  const progress = useMemo(() => STEPS.map((s) => stepFilled(s.key, profile, disc)), [profile, disc]);
  const stepsTouched = progress.filter((s) => s.filled > 0).length;

  const cur = STEPS[step];
  const CurIcon = cur.icon;

  return (
    <section className="overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-[0_1px_2px_rgba(24,21,26,0.04)]">
      {/* ── Progress stepper (SPEC §6) ── */}
      <div className="border-b border-ink-5 bg-surface/60 px-4 py-4 lg:px-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[12px] font-semibold text-ink-60">วิธี FORM · 4 ด้าน</div>
          <div className="font-mono text-[11px] text-ink-40">{stepsTouched}/4 ด้านเริ่มแล้ว</div>
        </div>
        <ol className="flex items-center gap-1.5" aria-label="ความคืบหน้าฟอร์ม FORM">
          {STEPS.map((s, i) => {
            const isCurrent = i === step;
            const pr = progress[i];
            const done = pr.filled > 0;
            const Icon = s.icon;
            return (
              <li key={s.key} className="flex flex-1 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`ด้าน ${s.label} (${pr.filled}/${pr.total})`}
                  className={`group flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1 ${
                    isCurrent ? "bg-rose-ultra" : "hover:bg-ink-5"
                  }`}
                >
                  <span
                    className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                      isCurrent ? "bg-rose text-white" : done ? "bg-wellness text-white" : "border border-ink-10 bg-white text-ink-40"
                    }`}
                  >
                    {done && !isCurrent ? <Check size={15} strokeWidth={2.75} aria-hidden /> : <Icon size={15} strokeWidth={2.25} aria-hidden />}
                  </span>
                  <span className={`text-[11px] font-semibold ${isCurrent ? "text-rose" : done ? "text-wellness" : "text-ink-40"}`}>
                    {s.letter}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className={`hidden h-px w-3 shrink-0 sm:block ${progress[i].filled > 0 ? "bg-wellness" : "bg-ink-10"}`} aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
        {/* thin fill bar */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-5">
          <div
            className="h-full bg-rose transition-all duration-300"
            style={{ width: `${(stepsTouched / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Current step header ── */}
      <div className="flex items-start gap-3 px-4 pt-5 lg:px-6">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-ultra text-rose">
          <CurIcon size={20} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-head text-[22px] font-extrabold leading-none text-rose">{cur.letter}</span>
            <h2 className="font-head text-[17px] font-bold text-ink">{cur.label}</h2>
          </div>
          <p className="mt-0.5 font-thai text-[12.5px] text-ink-60">{cur.sub} · กรอกเฉพาะที่รู้ ที่เหลือ AI เดาได้</p>
        </div>
      </div>

      {/* ── Step body ── */}
      <div className="space-y-5 px-4 py-5 lg:px-6">
        {step === 0 && (
          <>
            <ChipPicker label="ภาระคนที่ต้องดูแล" options={FAMILY_DEPS} value={profile.family.deps} onChange={(v) => setFamily("deps", v)} />
            <ChipPicker label="สุขภาพคนในบ้าน" options={FAMILY_HEALTH} value={profile.family.health} onChange={(v) => setFamily("health", v)} />
            <ChipPicker label="แรงกดดันการเงินของครอบครัว" options={FAMILY_FINANCE} value={profile.family.finance} onChange={(v) => setFamily("finance", v)} />
            <ChipPicker label="สถานภาพครอบครัว" options={MARITAL} value={profile.demographics.marital} onChange={(v) => setDemo("marital", v)} />
          </>
        )}

        {step === 1 && (
          <>
            <ChipPicker label="อาชีพหลัก" options={OCCUPATIONS} value={profile.career.occupation} onChange={(v) => setCareer("occupation", v)} />
            <TextField
              label="รายละเอียดอาชีพ · ตำแหน่ง (ถ้ามี)"
              value={profile.career.occupationDetail ?? ""}
              onChange={(v) => setCareer("occupationDetail", v)}
              placeholder="HR Manager · เจ้าของร้านกาแฟ · นักวิเคราะห์การเงิน…"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ChipPicker label="รายได้ประมาณ" options={INCOME_RANGES} value={profile.career.incomeRange} onChange={(v) => setCareer("incomeRange", v)} />
              <ChipPicker label="ความพอใจกับงาน" options={JOB_SATISFACTION} value={profile.career.jobSatisfaction} onChange={(v) => setCareer("jobSatisfaction", v)} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <ChipPicker label="ความใส่ใจสุขภาพ" options={HEALTH_AWARENESS} value={profile.lifestyle.healthAwareness} onChange={(v) => setLifestyle("healthAwareness", v)} />
              <ChipPicker label="ความถี่ออกกำลัง" options={EXERCISE_FREQ} value={profile.lifestyle.exerciseFreq} onChange={(v) => setLifestyle("exerciseFreq", v)} />
              <ChipPicker label="สไตล์การกิน" options={DIET_STYLE} value={profile.lifestyle.dietStyle} onChange={(v) => setLifestyle("dietStyle", v)} />
              <ChipPicker label="เวลาว่างที่มี" options={TIME_AVAILABLE} value={profile.lifestyle.timeAvailable} onChange={(v) => setLifestyle("timeAvailable", v)} />
            </div>
            <div>
              <Label>งานอดิเรก · ความสนใจ <span className="font-normal text-ink-40">(เลือกได้หลายข้อ)</span></Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {HOBBIES.map((h) => {
                  const active = (profile.lifestyle.hobbies ?? []).includes(h.value);
                  return (
                    <Chip key={h.value} active={active} onClick={() => toggleHobby(h.value)} tone="wellness">{h.label}</Chip>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <ChipPicker label="ช่วงอายุ" options={AGE_RANGES} value={profile.demographics.ageRange} onChange={(v) => setDemo("ageRange", v)} />
              <ChipPicker label="เพศ" options={GENDERS} value={profile.demographics.gender} onChange={(v) => setDemo("gender", v)} />
              <ChipPicker label="การศึกษา" options={EDUCATIONS} value={profile.demographics.education} onChange={(v) => setDemo("education", v)} />
            </div>

            {/* DISC */}
            <div className="rounded-xl border border-ink-10 bg-surface/40 p-4">
              <div className="mb-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose">
                <Target size={14} strokeWidth={2.25} aria-hidden /> บุคลิก DISC <span className="font-normal text-ink-40">(ถ้ายังไม่รู้ ข้ามได้)</span>
              </div>
              <div className="mt-2 space-y-3">
                <div>
                  <Label>หลัก (Primary)</Label>
                  <DiscGrid value={disc.primary} onChange={(v) => onDiscChange({ ...disc, primary: v })} />
                </div>
                <div>
                  <Label>รอง (Secondary · optional)</Label>
                  <DiscGrid value={disc.secondary} onChange={(v) => onDiscChange({ ...disc, secondary: v === disc.primary ? undefined : v })} />
                </div>
                {disc.primary && (
                  <ChipPicker label="ความมั่นใจ" options={DISC_CONFIDENCE} value={disc.confidence} onChange={(v) => onDiscChange({ ...disc, confidence: v as DiscData["confidence"] })} />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Wizard nav ── */}
      <div className="flex items-center justify-between gap-3 border-t border-ink-5 bg-surface/40 px-4 py-3 lg:px-6">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          <ChevronLeft size={14} strokeWidth={2.25} aria-hidden /> ย้อนกลับ
        </button>
        <span className="font-mono text-[11px] text-ink-40">ด้าน {step + 1} / 4</span>
        <button
          type="button"
          onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
          disabled={step === STEPS.length - 1}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-ink-80 disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          ถัดไป <ChevronRight size={14} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────── primitives ─────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold text-ink-60">{children}</div>;
}

function Chip({ active, onClick, children, tone = "ink" }: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: "ink" | "wellness" }) {
  const activeCls = tone === "wellness" ? "border-wellness bg-wellness text-white" : "border-ink bg-ink text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[36px] rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1 ${
        active ? activeCls : "border-ink-10 bg-white text-ink-60 hover:border-ink-20 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ChipPicker({ label, options, value, onChange }: { label: string; options: Option[]; value?: string; onChange: (v?: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o.value} active={value === o.value} onClick={() => onChange(value === o.value ? undefined : o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
      />
    </div>
  );
}

function DiscGrid({ value, onChange }: { value?: "D" | "I" | "S" | "C"; onChange: (v?: "D" | "I" | "S" | "C") => void }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {DISC_STYLES.map((d: DiscStyle) => {
        const active = value === d.key;
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => onChange(active ? undefined : d.key)}
            aria-pressed={active}
            title={`${d.label} — ${d.description}`}
            className={`min-h-[44px] rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1 ${
              active ? "border-rose bg-rose-ultra" : "border-ink-10 bg-white hover:border-ink-20"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className={`font-head text-[20px] font-extrabold leading-none ${active ? "text-rose" : "text-ink"}`}>{d.key}</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-40">{d.label}</span>
            </div>
            <p className={`mt-1 font-thai text-[11px] leading-relaxed ${active ? "text-ink-80" : "text-ink-50"}`}>{d.full}</p>
          </button>
        );
      })}
    </div>
  );
}
