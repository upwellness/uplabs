"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RISK_LABEL, type ScoreResult } from "@/lib/healthcheck/score";

export function CheckForm({ coachId, coachName }: { coachId: string; coachName: string }) {
  // Contact
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [lineId, setLineId]   = useState("");
  const [consent, setConsent] = useState(true);

  // Demographics
  const [age,     setAge]     = useState("");
  const [gender,  setGender]  = useState<"male" | "female" | "">("");
  const [height,  setHeight]  = useState("");
  const [weight,  setWeight]  = useState("");
  const [waist,   setWaist]   = useState("");

  // Lifestyle
  const [exercise, setExercise] = useState("");
  const [sleep,    setSleep]    = useState("");
  const [stress,   setStress]   = useState("");
  const [smoking,  setSmoking]  = useState("");
  const [alcohol,  setAlcohol]  = useState("");
  const [diet,     setDiet]     = useState("");

  // Symptoms + history
  const [symptoms,      setSymptoms]      = useState<string[]>([]);
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);
  const [conditions,    setConditions]    = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [result,     setResult]     = useState<(ScoreResult & { id: string }) | null>(null);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    arr.includes(v) ? set(arr.filter((x) => x !== v)) : set([...arr, v]);

  const submit = async () => {
    if (!name || !phone) { setError("กรุณากรอกชื่อและเบอร์โทร"); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/check/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coach_id: coachId,
          name, phone, line_id: lineId, consent_followup: consent,
          answers: {
            age:        age ? +age : undefined,
            gender:     gender || undefined,
            height_cm:  height ? +height : undefined,
            weight_kg:  weight ? +weight : undefined,
            waist_cm:   waist ? +waist : undefined,
            exercise_freq: exercise || undefined,
            sleep_hours:   sleep || undefined,
            stress_level:  stress || undefined,
            smoking:       smoking || undefined,
            alcohol:       alcohol || undefined,
            diet_quality:  diet || undefined,
            symptoms,
            family_history: familyHistory,
            conditions:     conditions.includes("none") ? [] : conditions,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "submit failed");
      setResult(json.lead);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <ResultView result={result} coachName={coachName} />;

  return (
    <div className="mt-7 space-y-7">
      {/* Contact */}
      <Section title="1. ติดต่อ" desc="เพื่อโค้ชส่งผลและติดตามให้คุณ">
        <div className="space-y-3">
          <Input label="ชื่อ" value={name} onChange={setName} placeholder="คุณ____" required />
          <Input label="เบอร์โทร" value={phone} onChange={setPhone} placeholder="0812345678" type="tel" required />
          <Input label="LINE ID" value={lineId} onChange={setLineId} placeholder="(ไม่บังคับ)" />
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-60">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-4 w-4 accent-rose" />
            <span>ยินดีให้โค้ชติดต่อกลับเพื่อให้คำแนะนำเพิ่ม</span>
          </label>
        </div>
      </Section>

      {/* Demographics */}
      <Section title="2. ข้อมูลพื้นฐาน">
        <div className="grid grid-cols-2 gap-3">
          <Input label="อายุ" value={age} onChange={setAge} type="number" placeholder="40" />
          <div>
            <Label>เพศ</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <Chip checked={gender === "male"}   onClick={() => setGender("male")}>ชาย</Chip>
              <Chip checked={gender === "female"} onClick={() => setGender("female")}>หญิง</Chip>
            </div>
          </div>
          <Input label="ส่วนสูง (cm)" value={height} onChange={setHeight} type="number" placeholder="165" />
          <Input label="น้ำหนัก (kg)" value={weight} onChange={setWeight} type="number" placeholder="65" />
          <Input label="รอบเอว (cm)" value={waist} onChange={setWaist} type="number" placeholder="80" />
        </div>
      </Section>

      {/* Lifestyle */}
      <Section title="3. Lifestyle">
        <Group label="ออกกำลังกาย / สัปดาห์">
          {[
            ["none", "ไม่ค่อย"],
            ["1-2_per_week", "1-2 ครั้ง"],
            ["3-4_per_week", "3-4 ครั้ง"],
            ["5+_per_week", "5+ ครั้ง"],
          ].map(([v, l]) => <Chip key={v} checked={exercise === v} onClick={() => setExercise(v)}>{l}</Chip>)}
        </Group>

        <Group label="นอนคืนละ">
          {[
            ["lt_5", "< 5 ชม."],
            ["5_6", "5-6 ชม."],
            ["6_7", "6-7 ชม."],
            ["7_8", "7-8 ชม."],
            ["gt_8", "> 8 ชม."],
          ].map(([v, l]) => <Chip key={v} checked={sleep === v} onClick={() => setSleep(v)}>{l}</Chip>)}
        </Group>

        <Group label="ระดับความเครียด">
          {[
            ["low", "ต่ำ"],
            ["moderate", "ปานกลาง"],
            ["high", "สูง"],
            ["very_high", "สูงมาก"],
          ].map(([v, l]) => <Chip key={v} checked={stress === v} onClick={() => setStress(v)}>{l}</Chip>)}
        </Group>

        <Group label="สูบบุหรี่">
          {[
            ["never", "ไม่เคย"],
            ["former", "เคย/เลิกแล้ว"],
            ["current", "สูบประจำ"],
          ].map(([v, l]) => <Chip key={v} checked={smoking === v} onClick={() => setSmoking(v)}>{l}</Chip>)}
        </Group>

        <Group label="ดื่มเหล้า/เบียร์">
          {[
            ["none", "ไม่ดื่ม"],
            ["occasional", "นานๆ ครั้ง"],
            ["weekly", "รายสัปดาห์"],
            ["daily", "ทุกวัน"],
          ].map(([v, l]) => <Chip key={v} checked={alcohol === v} onClick={() => setAlcohol(v)}>{l}</Chip>)}
        </Group>

        <Group label="คุณภาพอาหาร (ทานผัก/โปรตีนครบ?)">
          {[
            ["poor", "แย่"],
            ["average", "ปกติ"],
            ["good", "ดี"],
            ["excellent", "ดีมาก"],
          ].map(([v, l]) => <Chip key={v} checked={diet === v} onClick={() => setDiet(v)}>{l}</Chip>)}
        </Group>
      </Section>

      {/* Symptoms */}
      <Section title="4. อาการในช่วง 3 เดือน (เลือกได้หลายข้อ)">
        <div className="grid grid-cols-2 gap-2">
          {[
            ["fatigue", "อ่อนเพลีย"],
            ["poor_sleep", "นอนไม่หลับ"],
            ["weight_gain", "น้ำหนักขึ้น"],
            ["joint_pain", "ปวดข้อ"],
            ["dizziness", "เวียนหัว"],
            ["palpitation", "ใจสั่น"],
            ["digestive", "ระบบย่อยอาหารผิดปกติ"],
            ["mood", "อารมณ์แปรปรวน"],
          ].map(([v, l]) => (
            <Chip key={v} checked={symptoms.includes(v)} onClick={() => toggle(symptoms, v, setSymptoms)}>{l}</Chip>
          ))}
        </div>
      </Section>

      {/* Family history */}
      <Section title="5. โรคในครอบครัว">
        <div className="grid grid-cols-2 gap-2">
          {[
            ["diabetes", "เบาหวาน"],
            ["heart_disease", "โรคหัวใจ"],
            ["hypertension", "ความดัน"],
            ["cancer", "มะเร็ง"],
          ].map(([v, l]) => (
            <Chip key={v} checked={familyHistory.includes(v)} onClick={() => toggle(familyHistory, v, setFamilyHistory)}>{l}</Chip>
          ))}
        </div>
      </Section>

      {/* Existing conditions */}
      <Section title="6. โรคประจำตัว">
        <div className="grid grid-cols-2 gap-2">
          {[
            ["diabetes", "เบาหวาน"],
            ["hypertension", "ความดัน"],
            ["high_cholesterol", "ไขมันสูง"],
            ["none", "ไม่มี"],
          ].map(([v, l]) => (
            <Chip key={v} checked={conditions.includes(v)} onClick={() => toggle(conditions, v, setConditions)}>{l}</Chip>
          ))}
        </div>
      </Section>

      {error && (
        <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      <Button variant="rose" size="lg" className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? "กำลังคำนวณ..." : "📊 ดูผล Health Check"}
      </Button>
      <p className="text-center font-thai text-[11px] text-ink-40">
        ข้อมูลของคุณเก็บเป็นความลับ · ใช้เพื่อให้โค้ชแนะนำเท่านั้น
      </p>
    </div>
  );
}

/* ── Result view ────────────────────────────────── */

function ResultView({ result, coachName }: { result: ScoreResult & { id: string }; coachName: string }) {
  const meta = RISK_LABEL[result.risk_level];

  return (
    <div className="mt-7 space-y-6">
      {/* Score gauge */}
      <div className="rounded-3xl border-2 p-7 text-center" style={{ borderColor: meta.color, background: meta.bg + "50" }}>
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-60">Risk Score</div>
        <div className="mt-2 font-head text-[64px] font-extrabold leading-none" style={{ color: meta.color }}>
          {result.risk_score}
        </div>
        <div className="mt-1 font-mono text-[11px] text-ink-60">จาก 100</div>
        <div className="mt-4 font-head text-[20px] font-extrabold" style={{ color: meta.color }}>
          {meta.th}
        </div>
        <p className="mt-3 font-thai text-[14px] leading-[1.7] text-ink">{meta.advice}</p>
      </div>

      {/* BMI */}
      {result.bmi && (
        <div className="rounded-2xl border border-ink-10 bg-white px-5 py-4 text-center">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">BMI</div>
          <div className="mt-1 font-head text-[28px] font-extrabold text-ink">{result.bmi}</div>
        </div>
      )}

      {/* Flags */}
      {result.flags.length > 0 && (
        <div className="rounded-2xl border border-ink-10 bg-white p-5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">ปัจจัยที่พบ</div>
          <ul className="mt-3 space-y-1.5">
            {result.flags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 font-thai text-[13px] text-ink">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA */}
      <div className="rounded-3xl border-2 border-rose bg-rose-ultra p-6 text-center">
        <div className="text-3xl">💬</div>
        <h3 className="mt-2 font-head text-[18px] font-extrabold text-ink">
          ขั้นต่อไป — คุยกับ {coachName}
        </h3>
        <p className="mt-2 font-thai text-[13px] leading-[1.7] text-ink-60">
          ผลของคุณถูกส่งให้โค้ชเรียบร้อยแล้ว · โค้ชจะติดต่อกลับเพื่อให้คำแนะนำเฉพาะคุณ
        </p>
      </div>

      <p className="text-center font-thai text-[11px] text-ink-40">
        นี่คือ wellness assessment ไม่ใช่การวินิจฉัยทางการแพทย์ · ปรึกษาแพทย์ถ้ามีอาการรุนแรง
      </p>
    </div>
  );
}

/* ── Tiny components ────────────────────────────── */

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-head text-[15px] font-bold text-ink">{title}</div>
      {desc && <p className="mt-0.5 font-thai text-[12px] text-ink-60">{desc}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <Label>{label}</Label>
      <div className="mt-1.5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-semibold text-ink-60">{children}</div>;
}

function Input({ label, value, onChange, placeholder, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}{required && <span className="text-rose ml-1">*</span>}</Label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
      />
    </label>
  );
}

function Chip({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
        checked
          ? "border-rose bg-rose-ultra text-rose"
          : "border-ink-10 bg-white text-ink hover:border-ink-20"
      }`}
    >
      {checked && <span className="mr-1.5">✓</span>}{children}
    </button>
  );
}
