"use client";

import { useState } from "react";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  classifyBodyFat, classifyMusclePct, classifyVisceralFat,
  classifyBMI, statusHex, StatusLevel,
} from "@/lib/medical-status";
import type { Gender, MeasurementWithDerived } from "@/lib/types";

interface MeasurementTableProps {
  measurements: MeasurementWithDerived[];
  gender: Gender;
  onEdit?:   (m: MeasurementWithDerived) => void;
  onDelete?: (m: MeasurementWithDerived) => void;
  onSelect?: (m: MeasurementWithDerived) => void;
  showActions?: boolean;
}

export function MeasurementTable({
  measurements, gender, onEdit, onDelete, onSelect, showActions = true,
}: MeasurementTableProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (m: MeasurementWithDerived) => {
    if (!onDelete) return;
    if (!confirm(`ยืนยันการลบข้อมูลวันที่ ${formatDate(m.recorded_at)}?`)) return;
    setDeleting(m.id);
    try { await onDelete(m); }
    finally { setDeleting(null); }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-10 text-left">
            <Th>วันที่</Th>
            <Th align="right">น้ำหนัก</Th>
            <Th align="right">BMI</Th>
            <Th align="right">Fat %</Th>
            <Th align="right">Muscle %</Th>
            <Th align="right">Visceral</Th>
            <Th align="right">Body Age</Th>
            <Th align="right">BMR</Th>
            {showActions && <Th align="right"> </Th>}
          </tr>
        </thead>
        <tbody>
          {measurements.map((m) => (
            <tr
              key={m.id}
              onClick={() => onSelect?.(m)}
              className={`border-b border-ink-5 last:border-b-0 transition-colors ${
                onSelect ? "cursor-pointer hover:bg-rose-ultra" : "hover:bg-surface"
              }`}
            >
              <Td>{formatDate(m.recorded_at)}</Td>
              <Td align="right" mono><strong className="text-ink">{formatNumber(m.weight, 1)}</strong> <span className="text-ink-40">kg</span></Td>
              <ColoredTd value={m.bmi} level={m.bmi != null ? classifyBMI(m.bmi) : null} />
              <ColoredTd value={m.fat_pct}    level={m.fat_pct    != null ? classifyBodyFat(m.fat_pct, gender)   : null} suffix="%" />
              <ColoredTd value={m.muscle_pct} level={m.muscle_pct != null ? classifyMusclePct(m.muscle_pct, gender) : null} suffix="%" />
              <ColoredTd value={m.visceral}   level={m.visceral   != null ? classifyVisceralFat(m.visceral)     : null} digits={0} />
              <Td align="right" mono>{formatNumber(m.body_age, 0)}</Td>
              <Td align="right" mono>{formatNumber(m.bmr, 0)}</Td>
              {showActions && (
                <td className="px-3 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {onEdit && (
                    <button
                      onClick={() => onEdit(m)}
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-rose hover:bg-rose-ultra transition-colors"
                      title="แก้ไข"
                    >
                      แก้ไข
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => handleDelete(m)}
                      disabled={deleting === m.id}
                      className="ml-1 rounded-md px-2 py-1 text-[11px] font-semibold text-status-danger hover:bg-status-bg-danger transition-colors disabled:opacity-50"
                      title="ลบ"
                    >
                      {deleting === m.id ? "..." : "ลบ"}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40 ${align === "right" ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", mono }: { children: React.ReactNode; align?: "left" | "right"; mono?: boolean }) {
  return (
    <td className={`px-3 py-3 ${align === "right" ? "text-right" : ""} ${mono ? "font-mono text-[13px]" : "font-thai"} text-ink`}>
      {children}
    </td>
  );
}

function ColoredTd({ value, level, suffix = "", digits = 1 }: { value: number | null; level: StatusLevel | null; suffix?: string; digits?: number }) {
  return (
    <td className="px-3 py-3 text-right font-mono text-[13px]">
      <span style={{ color: level ? statusHex[level] : "#5C5660", fontWeight: level ? 700 : 400 }}>
        {formatNumber(value, digits)}{suffix}
      </span>
    </td>
  );
}
