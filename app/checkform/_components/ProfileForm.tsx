"use client";

import {
  AGE_RANGES, GENDERS, EDUCATIONS, MARITAL,
  OCCUPATIONS, INCOME_RANGES, JOB_SATISFACTION,
  HEALTH_AWARENESS, EXERCISE_FREQ, DIET_STYLE, HOBBIES, TIME_AVAILABLE,
  FAMILY_DEPS, FAMILY_HEALTH, FAMILY_FINANCE,
  DISC_STYLES, DISC_CONFIDENCE,
  type Option,
  type DiscStyle,
} from "../_data/profile-options";

export interface ProfileData {
  demographics: {
    ageRange?: string;
    gender?: string;
    education?: string;
    marital?: string;
  };
  career: {
    occupation?: string;
    occupationDetail?: string;
    incomeRange?: string;
    jobSatisfaction?: string;
  };
  lifestyle: {
    healthAwareness?: string;
    exerciseFreq?: string;
    dietStyle?: string;
    hobbies?: string[];
    timeAvailable?: string;
  };
  family: {
    deps?: string;
    health?: string;
    finance?: string;
  };
}

export interface DiscData {
  primary?: "D" | "I" | "S" | "C";
  secondary?: "D" | "I" | "S" | "C";
  confidence?: "guessing" | "maybe" | "certain";
}

export const EMPTY_PROFILE: ProfileData = {
  demographics: {},
  career: {},
  lifestyle: { hobbies: [] },
  family: {},
};

export const EMPTY_DISC: DiscData = {};

interface Props {
  profile: ProfileData;
  disc: DiscData;
  onProfileChange: (p: ProfileData) => void;
  onDiscChange: (d: DiscData) => void;
}

export function ProfileForm({ profile, disc, onProfileChange, onDiscChange }: Props) {
  const setDemo = (k: keyof ProfileData["demographics"], v: string | undefined) =>
    onProfileChange({ ...profile, demographics: { ...profile.demographics, [k]: v } });
  const setCareer = (k: keyof ProfileData["career"], v: string | undefined) =>
    onProfileChange({ ...profile, career: { ...profile.career, [k]: v } });
  const setLifestyle = <K extends keyof ProfileData["lifestyle"]>(
    k: K, v: ProfileData["lifestyle"][K],
  ) =>
    onProfileChange({ ...profile, lifestyle: { ...profile.lifestyle, [k]: v } });
  const setFamily = (k: keyof ProfileData["family"], v: string | undefined) =>
    onProfileChange({ ...profile, family: { ...profile.family, [k]: v } });

  const toggleHobby = (h: string) => {
    const current = profile.lifestyle.hobbies ?? [];
    setLifestyle("hobbies", current.includes(h) ? current.filter((x) => x !== h) : [...current, h]);
  };

  return (
    <div className="space-y-5">
      {/* ── Demographics ── */}
      <Section title="ข้อมูลทั่วไป" icon="👤" eyebrow="Demographics" accent="rose">
        <Grid>
          <ChipPicker label="ช่วงอายุ"        options={AGE_RANGES}   value={profile.demographics.ageRange} onChange={(v) => setDemo("ageRange", v)} />
          <ChipPicker label="เพศ"             options={GENDERS}      value={profile.demographics.gender}   onChange={(v) => setDemo("gender", v)}   />
          <ChipPicker label="การศึกษา"        options={EDUCATIONS}   value={profile.demographics.education} onChange={(v) => setDemo("education", v)} />
          <ChipPicker label="สถานภาพครอบครัว" options={MARITAL}      value={profile.demographics.marital}  onChange={(v) => setDemo("marital", v)}  />
        </Grid>
      </Section>

      {/* ── Career ── */}
      <Section title="อาชีพ · รายได้" icon="💼" eyebrow="Career" accent="science">
        <ChipPicker label="อาชีพหลัก"       options={OCCUPATIONS}      value={profile.career.occupation}       onChange={(v) => setCareer("occupation", v)} />
        <TextField
          label="รายละเอียดอาชีพ · ตำแหน่ง (optional)"
          value={profile.career.occupationDetail ?? ""}
          onChange={(v) => setCareer("occupationDetail", v)}
          placeholder="HR Manager · เจ้าของร้านกาแฟ · นักวิเคราะห์การเงิน..."
        />
        <Grid>
          <ChipPicker label="รายได้ประมาณ"        options={INCOME_RANGES}    value={profile.career.incomeRange}      onChange={(v) => setCareer("incomeRange", v)} />
          <ChipPicker label="ความพอใจกับงาน"      options={JOB_SATISFACTION} value={profile.career.jobSatisfaction}  onChange={(v) => setCareer("jobSatisfaction", v)} />
        </Grid>
      </Section>

      {/* ── Lifestyle ── */}
      <Section title="Lifestyle · สุขภาพ" icon="🌿" eyebrow="Lifestyle" accent="wellness">
        <Grid>
          <ChipPicker label="ความใส่ใจสุขภาพ"   options={HEALTH_AWARENESS} value={profile.lifestyle.healthAwareness} onChange={(v) => setLifestyle("healthAwareness", v)} />
          <ChipPicker label="ความถี่ออกกำลัง"   options={EXERCISE_FREQ}    value={profile.lifestyle.exerciseFreq}    onChange={(v) => setLifestyle("exerciseFreq", v)} />
          <ChipPicker label="สไตล์การกิน"        options={DIET_STYLE}       value={profile.lifestyle.dietStyle}       onChange={(v) => setLifestyle("dietStyle", v)} />
          <ChipPicker label="เวลาว่างที่มี"       options={TIME_AVAILABLE}   value={profile.lifestyle.timeAvailable}   onChange={(v) => setLifestyle("timeAvailable", v)} />
        </Grid>
        <div>
          <Label>งานอดิเรก · ความสนใจ <span className="font-normal text-ink-40">(เลือกได้หลายข้อ)</span></Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {HOBBIES.map((h) => {
              const active = (profile.lifestyle.hobbies ?? []).includes(h.value);
              return (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => toggleHobby(h.value)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                    active
                      ? "bg-wellness text-white border border-wellness"
                      : "bg-white border border-ink-10 text-ink-60 hover:border-ink-20 hover:text-ink"
                  }`}
                >
                  {h.label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ── Family ── */}
      <Section title="ครอบครัว" icon="👨‍👩‍👧" eyebrow="Family" accent="amber">
        <Grid>
          <ChipPicker label="ภาระคนต้องดูแล"      options={FAMILY_DEPS}     value={profile.family.deps}    onChange={(v) => setFamily("deps", v)} />
          <ChipPicker label="สุขภาพคนในบ้าน"      options={FAMILY_HEALTH}   value={profile.family.health}  onChange={(v) => setFamily("health", v)} />
          <ChipPicker label="แรงกดดันการเงิน"     options={FAMILY_FINANCE}  value={profile.family.finance} onChange={(v) => setFamily("finance", v)} />
        </Grid>
      </Section>

      {/* ── DISC ── */}
      <Section title="DISC Personality" icon="🎯" eyebrow="Personality · optional" accent="rose">
        <p className="font-thai text-[12px] text-ink-60 -mt-1">
          ถ้ายังไม่รู้ก็ข้ามได้ · คลิกเพื่อดูคำอธิบายแต่ละ style
        </p>
        <div>
          <Label>Primary <span className="font-normal text-ink-40">(หลัก)</span></Label>
          <DiscGrid value={disc.primary} onChange={(v) => onDiscChange({ ...disc, primary: v })} />
        </div>
        <div>
          <Label>Secondary <span className="font-normal text-ink-40">(รอง · optional)</span></Label>
          <DiscGrid value={disc.secondary} onChange={(v) => onDiscChange({ ...disc, secondary: v === disc.primary ? undefined : v })} />
        </div>
        {disc.primary && (
          <ChipPicker label="ความมั่นใจ" options={DISC_CONFIDENCE} value={disc.confidence} onChange={(v) => onDiscChange({ ...disc, confidence: v as any })} />
        )}
      </Section>
    </div>
  );
}

/* ────────────────────────────────────────────────── */

const SECTION_ACCENT: Record<"rose" | "science" | "wellness" | "amber", { bg: string; text: string; ring: string }> = {
  rose:     { bg: "bg-rose-ultra",     text: "text-rose",     ring: "ring-rose-pale" },
  science:  { bg: "bg-science-ultra",  text: "text-science",  ring: "ring-science-pale" },
  wellness: { bg: "bg-wellness-ultra", text: "text-wellness", ring: "ring-wellness-pale" },
  amber:    { bg: "bg-amber-ultra",    text: "text-amber",    ring: "ring-amber-pale" },
};

function Section({
  title, icon, eyebrow, accent, children,
}: {
  title: string;
  icon: string;
  eyebrow: string;
  accent: keyof typeof SECTION_ACCENT;
  children: React.ReactNode;
}) {
  const a = SECTION_ACCENT[accent];
  return (
    <section className="rounded-3xl border border-ink-10 bg-white p-6 lg:p-7 space-y-4">
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.bg} text-xl ring-1 ${a.ring}`}>
          {icon}
        </div>
        <div>
          <div className={`font-mono text-[10px] uppercase tracking-[0.16em] font-bold ${a.text}`}>{eyebrow}</div>
          <div className="mt-0.5 font-head text-[18px] font-extrabold text-ink">{title}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid md:grid-cols-2 gap-4">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">{children}</div>;
}

function ChipPicker({
  label, options, value, onChange,
}: {
  label: string;
  options: Option[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(active ? undefined : o.value)}
              title={o.hint}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                active
                  ? "bg-ink text-white border border-ink"
                  : "bg-white border border-ink-10 text-ink-60 hover:border-ink-20 hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none placeholder:text-ink-30"
      />
    </div>
  );
}

const DISC_ACCENT: Record<DiscStyle["color"], { bg: string; text: string; ring: string; border: string }> = {
  rose:     { bg: "bg-rose-ultra",     text: "text-rose",     ring: "ring-rose-pale",     border: "border-rose" },
  amber:    { bg: "bg-amber-ultra",    text: "text-amber",    ring: "ring-amber-pale",    border: "border-amber" },
  wellness: { bg: "bg-wellness-ultra", text: "text-wellness", ring: "ring-wellness-pale", border: "border-wellness" },
  science:  { bg: "bg-science-ultra",  text: "text-science",  ring: "ring-science-pale",  border: "border-science" },
};

function DiscGrid({
  value, onChange,
}: {
  value: "D" | "I" | "S" | "C" | undefined;
  onChange: (v: "D" | "I" | "S" | "C" | undefined) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
      {DISC_STYLES.map((d) => {
        const a = DISC_ACCENT[d.color];
        const active = value === d.key;
        return (
          <button
            key={d.key}
            type="button"
            onClick={() => onChange(active ? undefined : d.key)}
            title={`${d.label} — ${d.description}\n\nApproach: ${d.approach}`}
            className={`group rounded-2xl border p-3 text-left transition-all ${
              active
                ? `${a.bg} ${a.border} ${a.text} ring-2 ${a.ring}`
                : "border-ink-10 bg-white text-ink-60 hover:border-ink-20"
            }`}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className={`font-head text-[22px] font-extrabold leading-none ${active ? "" : "text-ink"}`}>{d.key}</span>
              <span className={`font-mono text-[9px] uppercase tracking-wide ${active ? "" : "text-ink-40"}`}>
                {d.label}
              </span>
            </div>
            <p className={`font-thai text-[11px] leading-relaxed ${active ? "" : "text-ink-50"}`}>{d.full}</p>
          </button>
        );
      })}
    </div>
  );
}
