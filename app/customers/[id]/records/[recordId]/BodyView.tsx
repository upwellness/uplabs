"use client";

import { useMemo, useState } from "react";
import { BODY_REGIONS, worstStatus, STATUS_COLOR, STATUS_LABEL, type BodyRegion } from "@/lib/records/body-map";

interface LabValue {
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

export function BodyView({ values, gender }: { values: LabValue[]; gender?: string | null }) {
  const [selected, setSelected] = useState<BodyRegion | null>(null);

  // Aggregate values per region + compute region status
  const regionData = useMemo(() => {
    const byKey = new Map<string, LabValue[]>();
    for (const r of BODY_REGIONS) byKey.set(r.key, []);

    for (const v of values) {
      for (const r of BODY_REGIONS) {
        if (r.metrics.includes(v.metric_key)) {
          byKey.get(r.key)!.push(v);
        }
      }
    }

    return BODY_REGIONS.map((r) => {
      const items = byKey.get(r.key) ?? [];
      const status = worstStatus(items.map((v) => v.status));
      const abnormal = items.filter((v) => v.status && ["low","high","critical","borderline"].includes(v.status)).length;
      return { region: r, items, status, abnormal };
    });
  }, [values]);

  const hasReproductive = (gender ?? "").toLowerCase() === "female"
    ? true   // CA-125 only for female (mostly)
    : true;  // still show if PSA exists

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
      {/* ── SVG Body ──────────────────────────────────── */}
      <div className="relative">
        <svg viewBox="0 0 400 640" className="w-full h-auto" aria-label="Human body diagram">
          {/* Body silhouette */}
          <BodyOutline gender={gender} />

          {/* Region status circles + labels */}
          {regionData.map(({ region, items, status, abnormal }) => {
            if (items.length === 0) return null;
            const c = STATUS_COLOR[status];
            const isSelected = selected?.key === region.key;
            return (
              <g key={region.key}
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(isSelected ? null : region)}>
                {/* Glow ring if abnormal */}
                {abnormal > 0 && (
                  <circle cx={region.x} cy={region.y} r={28}
                    fill={c.fill} fillOpacity={0.15} />
                )}
                {/* Main dot */}
                <circle cx={region.x} cy={region.y} r={isSelected ? 14 : 11}
                  fill={c.fill} stroke="white" strokeWidth={3}
                  style={{ transition: "r 0.15s" }} />
                {/* Abnormal badge */}
                {abnormal > 0 && (
                  <g>
                    <circle cx={region.x + 10} cy={region.y - 10} r={8} fill="#DC2626" />
                    <text x={region.x + 10} y={region.y - 7} fontSize="10" fontWeight="700"
                      fill="white" textAnchor="middle">{abnormal}</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Callout labels */}
          {regionData.map(({ region, items, status }) => {
            if (items.length === 0) return null;
            const c = STATUS_COLOR[status];
            const anchor = region.callout.anchor;
            return (
              <g key={`label-${region.key}`}
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(selected?.key === region.key ? null : region)}>
                {/* Connector line */}
                <line x1={region.x} y1={region.y}
                  x2={region.callout.x + (anchor === "left" ? 10 : -10)} y2={region.callout.y}
                  stroke={c.stroke} strokeWidth={1.2} strokeDasharray="3 2" />
                {/* Label box */}
                <foreignObject
                  x={anchor === "left" ? region.callout.x : region.callout.x - 100}
                  y={region.callout.y - 14} width={100} height={28}>
                  <div style={{
                    background: c.bg, color: c.text,
                    padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                    border: `1px solid ${c.stroke}`,
                    textAlign: anchor === "left" ? "left" : "right",
                  }}>
                    {region.short} · {items.length}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Detail panel ─────────────────────────────── */}
      <div className="lg:sticky lg:top-20 self-start">
        {selected ? (
          <RegionDetail
            region={selected}
            items={regionData.find((r) => r.region.key === selected.key)?.items ?? []}
            onClose={() => setSelected(null)}
          />
        ) : (
          <LegendCard regionData={regionData} onSelect={setSelected} />
        )}
      </div>
    </div>
  );
}

/* ── Sub: Region Detail ─────────────────────────── */

function RegionDetail({ region, items, onClose }: {
  region: BodyRegion; items: LabValue[]; onClose: () => void;
}) {
  const status = worstStatus(items.map((v) => v.status));
  const c = STATUS_COLOR[status];
  return (
    <div className="rounded-3xl border border-ink-10 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Region</div>
          <h3 className="mt-1 font-head text-[18px] font-extrabold text-ink">{region.label}</h3>
        </div>
        <button onClick={onClose} className="text-ink-40 hover:text-ink text-2xl leading-none">×</button>
      </div>

      <div className="mt-3 inline-block rounded-full px-3 py-1 font-mono text-[11px] font-bold"
        style={{ background: c.bg, color: c.text }}>
        {STATUS_LABEL[status]} · {items.length} ค่า
      </div>

      <div className="mt-4 space-y-2">
        {items.map((v) => {
          const vc = STATUS_COLOR[v.status ?? "unknown"];
          const range = v.ref_low != null && v.ref_high != null ? `${v.ref_low} - ${v.ref_high}`
            : v.ref_high != null ? `< ${v.ref_high}`
            : v.ref_low != null  ? `> ${v.ref_low}`
            : v.ref_text ?? "—";
          // Long narrative (imaging findings etc) → put on own row · numeric values inline
          const isNarrative = (v.value ?? "").length > 25 || !!v.value_num === false && /[ก-๛]/.test(v.value ?? "");
          return (
            <div key={v.id} className="rounded-xl border border-ink-10 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-thai text-[13px] font-semibold text-ink break-words">{v.metric_label_th || v.metric_key}</div>
                  {v.metric_label_en && <div className="mt-0.5 font-mono text-[10px] text-ink-40">{v.metric_label_en}</div>}
                </div>
                {!isNarrative && (
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[14px] font-bold" style={{ color: vc.text }}>
                      {v.value} {v.unit && <span className="text-[10px] text-ink-40 font-normal">{v.unit}</span>}
                    </div>
                    <div className="mt-0.5 font-mono text-[9px] text-ink-40">ปกติ: {range}</div>
                  </div>
                )}
              </div>
              {isNarrative && (
                <div className="mt-2 rounded-lg px-3 py-2 font-thai text-[12px] leading-[1.6] break-words"
                  style={{ background: vc.bg, color: vc.text }}>
                  {v.value}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sub: Legend (when no region selected) ──────── */

function LegendCard({ regionData, onSelect }: {
  regionData: { region: BodyRegion; items: LabValue[]; status: string; abnormal: number }[];
  onSelect: (r: BodyRegion) => void;
}) {
  const active = regionData.filter((r) => r.items.length > 0);
  return (
    <div className="rounded-3xl border border-ink-10 bg-white p-6">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Visual Body Map</div>
      <h3 className="mt-1 font-head text-[18px] font-extrabold text-ink">คลิกบนร่างกายเพื่อดูค่า</h3>
      <p className="mt-1 font-thai text-[12px] text-ink-60">
        แต่ละจุดบนรูป = ระบบในร่างกาย · สีบอกสถานะ · ป้ายแดงเลข = จำนวนค่าผิดปกติ
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        {Object.entries(STATUS_LABEL).filter(([k]) => k !== "unknown").map(([k, label]) => {
          const c = STATUS_COLOR[k];
          return (
            <div key={k} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: c.fill }} />
              <span className="text-ink-60">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-ink-5 pt-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40 mb-2">ระบบที่มีข้อมูล ({active.length})</div>
        <div className="space-y-1">
          {active.map(({ region, items, status, abnormal }) => {
            const c = STATUS_COLOR[status];
            return (
              <button key={region.key} onClick={() => onSelect(region)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-surface transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.fill }} />
                  <span className="font-thai text-[12px] text-ink truncate">{region.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {abnormal > 0 && (
                    <span className="rounded-full bg-status-bg-danger px-1.5 py-0.5 font-mono text-[9px] font-bold text-status-danger">
                      {abnormal}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-ink-40">{items.length}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Body silhouette (stylized · single continuous outline) ─────── */

function BodyOutline({ gender }: { gender?: string | null }) {
  // Single connected path — avoids overlapping rectangles seen previously.
  // Mostly mirror-symmetric around x=200.
  return (
    <g stroke="#94A3B8" strokeWidth={1.5} fill="#F8FAFC" strokeLinejoin="round" strokeLinecap="round">
      {/* Head */}
      <ellipse cx={200} cy={70} rx={36} ry={42} />
      {/* Face hint */}
      <circle cx={188} cy={66} r={2} fill="#94A3B8" stroke="none" />
      <circle cx={212} cy={66} r={2} fill="#94A3B8" stroke="none" />
      <path d="M 190 84 Q 200 90 210 84" fill="none" />

      {/* Body — single continuous path: neck → shoulders → torso → hips → outside leg → inseam → other leg → other inseam → mirror */}
      <path d="
        M 188 110
        L 188 122
        L 152 138
        Q 138 148 138 178
        L 144 320
        L 152 410
        L 168 590
        Q 172 605 184 605
        L 195 605
        Q 200 605 200 590
        L 200 410
        L 200 590
        Q 200 605 205 605
        L 216 605
        Q 228 605 232 590
        L 248 410
        L 256 320
        L 262 178
        Q 262 148 248 138
        L 212 122
        L 212 110
        Z" />

      {/* Arms — separate (so they don't fight with the torso fill) */}
      <path d="M 142 142 Q 110 200 100 280 L 108 380 Q 110 392 120 388 Q 124 386 122 376 L 116 280 Q 122 220 152 162"
        fill="none" />
      <path d="M 258 142 Q 290 200 300 280 L 292 380 Q 290 392 280 388 Q 276 386 278 376 L 284 280 Q 278 220 248 162"
        fill="none" />

      {/* Hands */}
      <ellipse cx={115}  cy={392} rx={10} ry={7} />
      <ellipse cx={285} cy={392} rx={10} ry={7} />

      {/* Feet */}
      <ellipse cx={178} cy={618} rx={16} ry={7} />
      <ellipse cx={222} cy={618} rx={16} ry={7} />
    </g>
  );
}
