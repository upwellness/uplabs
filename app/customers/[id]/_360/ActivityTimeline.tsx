"use client";

import { useState, useMemo } from "react";
import { Clock, Inbox } from "lucide-react";

interface TimelineEvent {
  type: string;
  icon: string;
  date: string;
  title: string;
  href?: string;
}

const FILTER_OPTIONS = [
  { key: "all",     label: "ทั้งหมด" },
  { key: "health",  label: "ข้อมูลสุขภาพ" },
  { key: "comm",    label: "การติดต่อ" },
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
    <section className="liquid liquid-shine rounded-3xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-head text-[16px] font-extrabold tracking-tight text-ink inline-flex items-center gap-1.5">
            <Clock size={15} strokeWidth={2.25} className="text-rose" aria-hidden="true" /> ไทม์ไลน์ 90 วัน
          </h2>
          <p className="font-mono text-[10.5px] uppercase tracking-wider text-ink-60 mt-0.5">เรียงจากใหม่ → เก่า</p>
        </div>
        <div className="flex gap-1" role="radiogroup" aria-label="กรองตามประเภท">
          {FILTER_OPTIONS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              role="radio"
              aria-checked={filter === f.key}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 ${
                filter === f.key
                  ? "bg-ink text-white shadow-md"
                  : "bg-white/70 text-ink-60 hover:bg-white border border-ink/8"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="liquid rounded-2xl p-8 text-center border-dashed">
          <Inbox size={26} strokeWidth={1.75} className="mx-auto text-ink-40" aria-hidden="true" />
          <p className="mt-2 font-thai text-[12px] text-ink-60">
            {filter === "all"
              ? "ยังไม่มีความเคลื่อนไหวใน 90 วัน · ลองทักทายเพื่อเริ่มต้น"
              : "ไม่มีรายการในหมวดนี้ · ลองดูหมวดอื่นได้ค่ะ"}
          </p>
        </div>
      ) : (
        <ul className="space-y-3 relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-rose/30 via-ink/15 to-transparent" aria-hidden="true" />
          {filtered.map((e, i) => {
            const Content = (
              <div className="flex gap-4 items-start">
                <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/70 backdrop-blur-md border border-white/70 text-base shadow-sm">
                  {e.icon}
                </div>
                <div className="min-w-0 flex-1 pt-2">
                  <div className="font-thai text-[13px] text-ink leading-snug">{e.title}</div>
                  <div className="font-mono text-[10px] text-ink-40 mt-0.5">
                    {fmtDateThai(e.date)} · {relativeDays(e.date)}
                  </div>
                </div>
              </div>
            );
            return e.href ? (
              <li key={i}><a href={e.href} className="block hover:translate-x-0.5 transition-transform">{Content}</a></li>
            ) : (
              <li key={i}>{Content}</li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
