"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TH_MONTHS_SHORT,
  beToCe,
  ceToBe,
  detectYearSystem,
  formatBothYears,
  type YearSystem,
} from "@/lib/thai-date";

interface DOBPickerProps {
  value: string | null;                 // ISO YYYY-MM-DD (ค.ศ.)
  onChange: (iso: string | null) => void;
  defaultSystem?: YearSystem;           // default พ.ศ.
}

export function DOBPicker({ value, onChange, defaultSystem = "be" }: DOBPickerProps) {
  const initial = useMemo(() => {
    if (!value) return { day: "", month: "", yearInput: "" };
    const d = new Date(value);
    if (isNaN(d.getTime())) return { day: "", month: "", yearInput: "" };
    const ce = d.getFullYear();
    return {
      day: String(d.getDate()),
      month: String(d.getMonth() + 1),
      yearInput: String(defaultSystem === "be" ? ceToBe(ce) : ce),
    };
  }, [value, defaultSystem]);

  const [system, setSystem] = useState<YearSystem>(defaultSystem);
  const [day, setDay]       = useState(initial.day);
  const [month, setMonth]   = useState(initial.month);
  const [year, setYear]     = useState(initial.yearInput);

  // Push canonical ISO date upward whenever inputs change
  useEffect(() => {
    const dn = +day, mn = +month, yn = +year;
    if (!dn || !mn || !yn) { onChange(null); return; }
    const yearCE = system === "be" ? beToCe(yn) : yn;
    if (yearCE < 1900 || yearCE > 2100) { onChange(null); return; }
    if (mn < 1 || mn > 12 || dn < 1 || dn > 31) { onChange(null); return; }
    const iso = `${yearCE}-${String(mn).padStart(2, "0")}-${String(dn).padStart(2, "0")}`;
    onChange(iso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, month, year, system]);

  // When system toggles, auto-convert the year displayed
  const handleSystemToggle = (next: YearSystem) => {
    if (next === system) return;
    if (year) {
      const yn = +year;
      // detect what the year actually is based on its value to handle mid-edit ambiguity
      const probableSystem = detectYearSystem(yn);
      const ce = probableSystem === "be" ? beToCe(yn) : yn;
      setYear(String(next === "be" ? ceToBe(ce) : ce));
    }
    setSystem(next);
  };

  const previewIso = useMemo(() => {
    const dn = +day, mn = +month, yn = +year;
    if (!dn || !mn || !yn) return null;
    const yearCE = system === "be" ? beToCe(yn) : yn;
    if (yearCE < 1900 || yearCE > 2100) return null;
    if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return null;
    return `${yearCE}-${String(mn).padStart(2, "0")}-${String(dn).padStart(2, "0")}`;
  }, [day, month, year, system]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">วัน เดือน ปีเกิด</span>
        <div className="inline-flex rounded-full border border-ink-10 bg-white p-0.5 text-[10px] font-bold">
          {(["be", "ce"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSystemToggle(s)}
              className={`rounded-full px-2.5 py-0.5 transition-all ${
                system === s ? "bg-rose text-white" : "text-ink-40 hover:text-ink"
              }`}
            >
              {s === "be" ? "พ.ศ." : "ค.ศ."}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-2">
        <input
          type="number"
          min={1}
          max={31}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          placeholder="วัน"
          className="rounded-xl border border-ink-10 bg-white px-3 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
        />
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-ink-10 bg-white px-3 py-2.5 text-sm focus:border-rose focus:outline-none"
        >
          <option value="">เดือน</option>
          {TH_MONTHS_SHORT.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder={system === "be" ? "พ.ศ. (เช่น 2510)" : "ค.ศ. (เช่น 1967)"}
          className="rounded-xl border border-ink-10 bg-white px-3 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
        />
      </div>

      {previewIso && (
        <div className="font-mono text-[11px] text-ink-40">
          → {formatBothYears(previewIso)}
        </div>
      )}
    </div>
  );
}
