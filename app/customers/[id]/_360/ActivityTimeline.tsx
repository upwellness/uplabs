"use client";

import { useState, useMemo } from "react";

interface TimelineEvent {
  type: string;
  icon: string;
  date: string;
  title: string;
  href?: string;
}

const FILTER_OPTIONS = [
  { key: "all",     label: "ทั้งหมด" },
  { key: "health",  label: "Health Data" },
  { key: "comm",    label: "Communication" },
] as const;

type FilterKey = typeof FILTER_OPTIONS[number]["key"];

const HEALTH_TYPES = ["bca", "record", "allergy"];
const COMM_TYPES   = ["pulse", "note", "call"];

function fmtDateThai(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  return day;
}

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันก่อน`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ก่อน`;
  return `${Math.floor(days / 30)} เดือนก่อน`;
}

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "health") return events.filter(e => HEALTH_TYPES.includes(e.type));
    if (filter === "comm")   return events.filter(e => COMM_TYPES.includes(e.type));
    return events;
  }, [events, filter]);

  return (
    <section className="rounded-3xl border border-ink-10 bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-head text-[16px] font-extrabold tracking-tight text-ink">⏱ Activity Timeline</h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-40 mt-0.5">90 days</p>
        </div>
        <div className="flex gap-1">
          {FILTER_OPTIONS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                filter === f.key
                  ? "bg-ink text-white"
                  : "bg-surface text-ink-60 hover:bg-ink-10"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-10 bg-surface p-8 text-center">
          <div className="text-2xl">📭</div>
          <p className="mt-2 font-thai text-[12px] text-ink-40">ไม่มี activity ใน 90 วัน · {filter !== "all" ? "ลองเปลี่ยน filter" : ""}</p>
        </div>
      ) : (
        <ul className="space-y-3 relative">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-ink-10" aria-hidden="true" />
          {filtered.map((e, i) => {
            const Content = (
              <div className="flex gap-4 items-start">
                <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white border border-ink-10 text-sm">
                  {e.icon}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="font-thai text-[13px] text-ink leading-snug">{e.title}</div>
                  <div className="font-mono text-[10px] text-ink-40 mt-0.5">
                    {fmtDateThai(e.date)} · {relativeDays(e.date)}
                  </div>
                </div>
              </div>
            );
            return e.href ? (
              <li key={i}><a href={e.href} className="block hover:opacity-80 transition">{Content}</a></li>
            ) : (
              <li key={i}>{Content}</li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
