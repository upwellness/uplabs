"use client";

import { useState } from "react";
import { BodyView } from "./BodyView";
import { CATEGORY_LABEL, type Category } from "@/lib/records/catalog";

interface Value {
  id: string;
  category: string;
  metric_key: string;
  metric_label_th: string | null;
  metric_label_en: string | null;
  value: string | null;
  value_num: number | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  status: string | null;
}

const STATUS_COLOR: Record<string, { fg: string; bg: string; label: string }> = {
  normal:     { fg: "#16A34A", bg: "#DCFCE7", label: "ปกติ" },
  low:        { fg: "#F97316", bg: "#FED7AA", label: "ต่ำกว่าปกติ" },
  high:       { fg: "#DC2626", bg: "#FEE2E2", label: "สูงกว่าปกติ" },
  borderline: { fg: "#EAB308", bg: "#FEF9C3", label: "borderline" },
  critical:   { fg: "#7F1D1D", bg: "#FECACA", label: "วิกฤต" },
  unknown:    { fg: "#64748B", bg: "#F1F5F9", label: "—" },
};

export function RecordTabs({ values, gender }: { values: Value[]; gender?: string | null }) {
  const [tab, setTab] = useState<"table" | "body">("body");

  // Group by category for table view
  const grouped = new Map<string, Value[]>();
  for (const v of values) {
    if (!grouped.has(v.category)) grouped.set(v.category, []);
    grouped.get(v.category)!.push(v);
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-5 flex gap-2 border-b border-ink-10">
        <TabBtn active={tab === "body"}  onClick={() => setTab("body")}>🧍 ดูบนรูปร่างกาย</TabBtn>
        <TabBtn active={tab === "table"} onClick={() => setTab("table")}>📋 ตารางตามหมวด</TabBtn>
      </div>

      {tab === "body" && <BodyView values={values} gender={gender} />}

      {tab === "table" && (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat} className="rounded-3xl border border-ink-10 bg-white p-6">
              <h2 className="font-head text-[16px] font-extrabold tracking-tight text-ink">
                {CATEGORY_LABEL[cat as Category] ?? cat}
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-10 text-left">
                      <Th>รายการ</Th>
                      <Th align="right">ผล</Th>
                      <Th>หน่วย</Th>
                      <Th>ค่าปกติ</Th>
                      <Th>สถานะ</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((v) => {
                      const meta = STATUS_COLOR[v.status ?? "unknown"] ?? STATUS_COLOR.unknown;
                      const range = v.ref_low != null && v.ref_high != null ? `${v.ref_low} - ${v.ref_high}`
                        : v.ref_high != null ? `< ${v.ref_high}`
                        : v.ref_low != null  ? `> ${v.ref_low}`
                        : v.ref_text ?? "—";
                      return (
                        <tr key={v.id} className="border-b border-ink-5 last:border-b-0">
                          <Td>
                            <div className="font-thai text-ink">{v.metric_label_th ?? v.metric_key}</div>
                            {v.metric_label_en && <div className="font-mono text-[10px] text-ink-40">{v.metric_label_en}</div>}
                          </Td>
                          <Td align="right">
                            <strong className="font-mono text-[14px]" style={{ color: meta.fg }}>{v.value ?? "—"}</strong>
                          </Td>
                          <Td>{v.unit || "—"}</Td>
                          <Td><span className="font-mono text-[11px] text-ink-60">{range}</span></Td>
                          <Td>
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-mono font-bold"
                              style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`relative px-4 py-2.5 font-head text-[14px] font-bold transition-colors ${active ? "text-rose" : "text-ink-40 hover:text-ink"}`}>
      {children}
      {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-rose rounded-t" />}
    </button>
  );
}
function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-40 ${align === "right" ? "text-right" : ""}`}>{children}</th>;
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-3 ${align === "right" ? "text-right" : ""}`}>{children}</td>;
}
