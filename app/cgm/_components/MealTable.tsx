"use client";

import { useState } from "react";
import type { CGMMeal } from "@/lib/types-cgm";

interface MealTableProps {
  meals: CGMMeal[];
  onEdit?:   (m: CGMMeal) => void;
  onDelete?: (m: CGMMeal) => void;
  showActions?: boolean;
}

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString("th-TH", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

const fmtNum = (n: number | null) => (n == null ? "—" : n.toString());

export function MealTable({ meals, onEdit, onDelete, showActions = true }: MealTableProps) {
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleDelete = async (m: CGMMeal) => {
    if (!onDelete) return;
    if (!confirm(`ลบมื้อ "${m.description}" วันที่ ${fmtTime(m.meal_timestamp)}?`)) return;
    setDeleting(m.id);
    try { await onDelete(m); }
    finally { setDeleting(null); }
  };

  if (meals.length === 0) {
    return (
      <div className="rounded-2xl bg-surface py-10 text-center font-thai text-sm text-ink-40">
        ยังไม่มีบันทึกมื้ออาหาร
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-10 text-left">
            <Th>เวลา</Th>
            <Th>รายการอาหาร</Th>
            <Th align="right">คาร์บ</Th>
            <Th align="right">โปรตีน</Th>
            <Th align="right">ไขมัน</Th>
            {showActions && <Th align="right"> </Th>}
          </tr>
        </thead>
        <tbody>
          {meals.map((m) => (
            <tr key={m.id} className="border-b border-ink-5 last:border-b-0 hover:bg-surface transition-colors">
              <Td><span className="font-mono text-[12px]">{fmtTime(m.meal_timestamp)}</span></Td>
              <Td><span className="font-thai text-ink">{m.description}</span></Td>
              <Td align="right" mono>{fmtNum(m.carbs)}</Td>
              <Td align="right" mono>{fmtNum(m.protein)}</Td>
              <Td align="right" mono>{fmtNum(m.fat)}</Td>
              {showActions && (
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(m)}
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-rose hover:bg-rose-ultra transition-colors"
                    >แก้ไข</button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => handleDelete(m)}
                      disabled={deleting === m.id}
                      className="ml-1 rounded-md px-2 py-1 text-[11px] font-semibold text-status-danger hover:bg-status-bg-danger transition-colors disabled:opacity-50"
                    >{deleting === m.id ? "..." : "ลบ"}</button>
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
    <td className={`px-3 py-3 ${align === "right" ? "text-right" : ""} ${mono ? "font-mono text-[13px]" : ""} text-ink`}>
      {children}
    </td>
  );
}
