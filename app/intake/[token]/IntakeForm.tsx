"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const COMMON_MEDS = [
  "Warfarin", "Statin", "Levothyroxine", "Metformin", "SSRI", "NSAID",
  "ยาความดัน", "ยาเบาหวาน",
];
const CONDITIONS = ["เบาหวาน", "ความดัน", "ไขมัน", "Thyroid", "โรคไต", "โรคตับ", "หัวใจ", "ไม่มี"];
const GOALS = [
  { v: "lose_weight",  label: "ลดน้ำหนัก" },
  { v: "energy",        label: "พลังงาน / ลดอ่อนเพลีย" },
  { v: "sleep",         label: "หลับลึก หลับยาว" },
  { v: "longevity",     label: "longevity / ชะลอวัย" },
  { v: "skin",          label: "ผิวพรรณ" },
];
const BUDGETS = [
  { v: "lt_500",     label: "น้อยกว่า 500 / เดือน" },
  { v: "500_1500",   label: "500–1,500 / เดือน" },
  { v: "1500_3000",  label: "1,500–3,000 / เดือน" },
  { v: "gt_3000",    label: "มากกว่า 3,000 / เดือน" },
];

export function IntakeForm({ token }: { token: string }) {
  const [meds,     setMeds]     = useState<string[]>([]);
  const [medOther, setMedOther] = useState("");
  const [conds,    setConds]    = useState<string[]>([]);
  const [pregnant,     setPregnant]     = useState(false);
  const [breastfeeding,setBreastfeeding]= useState(false);
  const [goal,     setGoal]     = useState("");
  const [budget,   setBudget]   = useState("");
  const [notes,    setNotes]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    arr.includes(v) ? set(arr.filter((x) => x !== v)) : set([...arr, v]);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const medsAll = medOther.trim()
        ? [...meds, ...medOther.split(",").map((s) => s.trim()).filter(Boolean)]
        : meds;
      const res = await fetch(`/api/pulse/intakes/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medications:  medsAll,
          conditions:   conds.includes("ไม่มี") ? [] : conds,
          pregnant,
          breastfeeding,
          goal,
          budget_range: budget,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "submit failed");
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return (
    <div className="mt-8 rounded-2xl border-2 border-status-bg-optimal bg-status-bg-optimal/30 p-8 text-center">
      <div className="text-5xl">✅</div>
      <h2 className="mt-3 font-head text-xl font-extrabold text-ink">ขอบคุณค่ะ!</h2>
      <p className="mt-2 font-thai text-sm text-ink-60">
        ข้อมูลของคุณถูกส่งให้โค้ชเรียบร้อยแล้ว — รอผลวิเคราะห์ใน 24 ชม.
      </p>
    </div>
  );

  return (
    <div className="mt-8 space-y-7">
      <Section title="1. ยาประจำที่ทานอยู่" desc="ติ๊กที่ใช่ + กรอกเพิ่มถ้ามี (ถ้าไม่มียา ปล่อยว่าง)">
        <div className="grid grid-cols-2 gap-2">
          {COMMON_MEDS.map((m) => (
            <Chip key={m} checked={meds.includes(m)} onClick={() => toggle(meds, m, setMeds)}>{m}</Chip>
          ))}
        </div>
        <input
          className="mt-3 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
          placeholder="ยาอื่น (คั่นด้วย , เช่น Aspirin, Vit D)"
          value={medOther} onChange={(e) => setMedOther(e.target.value)}
        />
      </Section>

      <Section title="2. โรคประจำตัว" desc="ติ๊กที่ใช่ (ถ้าไม่มี ติ๊ก 'ไม่มี')">
        <div className="grid grid-cols-2 gap-2">
          {CONDITIONS.map((c) => (
            <Chip key={c} checked={conds.includes(c)} onClick={() => toggle(conds, c, setConds)}>{c}</Chip>
          ))}
        </div>
      </Section>

      <Section title="3. สถานะ (สำหรับผู้หญิงเท่านั้น)" desc="ถ้าใช่ AI จะส่งให้แพทย์ตรวจก่อน">
        <div className="space-y-2">
          <Chip checked={pregnant}      onClick={() => setPregnant(!pregnant)}>ตั้งครรภ์</Chip>
          <Chip checked={breastfeeding} onClick={() => setBreastfeeding(!breastfeeding)}>ให้นมบุตร</Chip>
        </div>
      </Section>

      <Section title="4. เป้าหมายหลักของคุณ" desc="เลือก 1 ที่สำคัญที่สุด">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GOALS.map((g) => (
            <Chip key={g.v} checked={goal === g.v} onClick={() => setGoal(g.v)}>{g.label}</Chip>
          ))}
        </div>
      </Section>

      <Section title="5. งบ supplement ต่อเดือน">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BUDGETS.map((b) => (
            <Chip key={b.v} checked={budget === b.v} onClick={() => setBudget(b.v)}>{b.label}</Chip>
          ))}
        </div>
      </Section>

      <Section title="หมายเหตุ (ไม่บังคับ)" desc="อยากบอกอะไรเพิ่ม ปวดไหนหรือเปล่า แพ้อะไรไหม">
        <textarea
          rows={3}
          className="w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
          placeholder="ไม่บังคับ"
          value={notes} onChange={(e) => setNotes(e.target.value)}
        />
      </Section>

      {error && (
        <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      <Button variant="rose" size="lg" className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? "กำลังส่ง..." : "ส่งข้อมูล"}
      </Button>
      <p className="text-center font-thai text-[11px] text-ink-40">
        ข้อมูลของคุณเก็บเป็นความลับ · เฉพาะโค้ชและเภสัชกรของ UP Wellness เห็นเท่านั้น
      </p>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-head text-[15px] font-bold text-ink">{title}</div>
      {desc && <p className="mt-0.5 font-thai text-[12px] text-ink-60">{desc}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Chip({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-all ${
        checked
          ? "border-rose bg-rose-ultra text-rose"
          : "border-ink-10 bg-white text-ink hover:border-ink-20"
      }`}
    >
      <span className="mr-2">{checked ? "✓" : "○"}</span>{children}
    </button>
  );
}
