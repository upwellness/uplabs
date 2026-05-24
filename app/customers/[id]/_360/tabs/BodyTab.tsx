"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { classifyBodyFat, classifyMusclePct, classifyVisceralFat, statusHex } from "@/lib/medical-status";

interface Measurement {
  id:          string;
  recorded_at: string;
  weight:      number | null;
  fat_pct:     number | null;
  muscle_pct:  number | null;
  visceral:    number | null;
  body_age:    number | null;
  bmr:         number | null;
}

export function BodyTab({ customerId }: { customerId: string }) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [gender, setGender] = useState<"male" | "female">("female");

  useEffect(() => {
    Promise.all([
      fetch(`/api/customers/${customerId}/measurements`).then(r => r.json()),
      fetch(`/api/customers/${customerId}`).then(r => r.json()),
    ])
      .then(([m, c]) => {
        setMeasurements(m.measurements ?? m ?? []);
        if (c.gender === "male") setGender("male");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <div className="h-32 animate-pulse rounded-2xl liquid" />;

  if (measurements.length === 0) {
    return (
      <div className="liquid rounded-2xl p-8 text-center border-dashed">
        <div className="text-2xl">📊</div>
        <p className="mt-2 font-thai text-[13px] text-ink-60">ยังไม่มีผล BCA ของคนไข้คนนี้</p>
        <p className="mt-1 font-thai text-[11px] text-ink-60">ชั่งเครื่อง Omron แล้วบันทึกได้ที่หน้า BCA</p>
        <Link href="/bca" className="mt-3 inline-block rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white">
          → ไปหน้า BCA
        </Link>
      </div>
    );
  }

  const latest = measurements[0];

  return (
    <div className="space-y-4">
      {/* Latest highlight */}
      <div className="liquid rounded-2xl p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-40">BCA ล่าสุด</div>
            <div className="font-mono text-[10px] text-ink-60 mt-0.5">
              {new Date(latest.recorded_at).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
          <Link href="/bca" className="text-rose hover:underline text-[11px] font-mono">ดูทั้งหมด →</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
          <BodyMetric label="น้ำหนัก"  value={latest.weight}     unit="kg"   />
          <BodyMetric label="Fat %"   value={latest.fat_pct}    unit="%"    color={latest.fat_pct != null ? statusHex[classifyBodyFat(latest.fat_pct, gender)] : undefined} />
          <BodyMetric label="Visceral" value={latest.visceral}  unit="lv"   color={latest.visceral != null ? statusHex[classifyVisceralFat(latest.visceral)] : undefined} />
          <BodyMetric label="Muscle"  value={latest.muscle_pct} unit="%"    color={latest.muscle_pct != null ? statusHex[classifyMusclePct(latest.muscle_pct, gender)] : undefined} />
          <BodyMetric label="BMR"     value={latest.bmr}        unit="kcal" />
          <BodyMetric label="Body Age" value={latest.body_age}  unit="yr"   />
        </div>
      </div>

      {/* History compact */}
      <div className="liquid rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-thai text-[14px] font-bold text-ink">📈 ประวัติการชั่ง ({measurements.length} รอบ)</h3>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-wider text-ink-40">
                <th className="px-2 py-2 text-left">วันที่</th>
                <th className="px-2 py-2 text-right">นน.</th>
                <th className="px-2 py-2 text-right">Fat%</th>
                <th className="px-2 py-2 text-right">Visc.</th>
                <th className="px-2 py-2 text-right">Musc.</th>
                <th className="px-2 py-2 text-right">BodyAge</th>
              </tr>
            </thead>
            <tbody>
              {measurements.slice(0, 10).map((m, i) => (
                <tr key={m.id ?? i} className="border-t border-ink/5">
                  <td className="px-2 py-2 font-mono text-[11px] text-ink-60">
                    {new Date(m.recorded_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{m.weight ?? "—"}</td>
                  <td className="px-2 py-2 text-right font-mono">{m.fat_pct ?? "—"}</td>
                  <td className="px-2 py-2 text-right font-mono">{m.visceral ?? "—"}</td>
                  <td className="px-2 py-2 text-right font-mono">{m.muscle_pct ?? "—"}</td>
                  <td className="px-2 py-2 text-right font-mono">{m.body_age ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {measurements.length > 10 && (
          <p className="mt-3 font-mono text-[10px] text-ink-40 text-center">
            แสดง 10 จาก {measurements.length} · <Link href="/bca" className="text-rose">ดูทั้งหมด →</Link>
          </p>
        )}
      </div>
    </div>
  );
}

function BodyMetric({ label, value, unit, color }: { label: string; value: number | null; unit: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white/40 backdrop-blur-md border border-white/60 p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-ink-40">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-head text-[20px] font-extrabold leading-none" style={{ color: color ?? "#1F1E1B" }}>
          {value ?? "—"}
        </span>
        <span className="text-[9px] text-ink-40">{unit}</span>
      </div>
    </div>
  );
}
