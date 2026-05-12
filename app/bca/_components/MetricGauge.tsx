import { StatusPill } from "@/components/ui/StatusPill";
import { StatusLevel, statusHex, STATUS_LABEL_TH } from "@/lib/medical-status";

interface MetricGaugeProps {
  title: string;
  subtitle?: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  markers: { v: number; label: string }[];
  level: StatusLevel;
  sub?: string;
  higherIsBetter?: boolean;
}

export function MetricGauge({ title, subtitle, value, unit, min, max, markers, level, sub }: MetricGaugeProps) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const color = statusHex[level];

  return (
    <div className="rounded-3xl border border-ink-10 bg-white p-7">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-head text-[15px] font-bold tracking-tight text-ink">{title}</h3>
          {subtitle && <p className="mt-1 font-thai text-xs text-ink-60">{subtitle}</p>}
        </div>
        <StatusPill level={level} />
      </div>

      <div className="mt-6 flex items-baseline gap-2">
        <div className="font-head text-[48px] font-extrabold leading-none tracking-[-2px]" style={{ color }}>
          {value}
        </div>
        <div className="text-base text-ink-40">{unit}</div>
        <div className="ml-auto text-right">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Status</div>
          <div className="font-head text-sm font-bold" style={{ color }}>{STATUS_LABEL_TH[level]}</div>
        </div>
      </div>

      {/* Gauge bar */}
      <div className="relative mt-6">
        <div className="h-2 w-full rounded-full bg-ink-5">
          <div
            className="h-2 rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        {/* Markers */}
        <div className="relative h-6 mt-1">
          {markers.map((m) => {
            const mpct = Math.max(0, Math.min(100, ((m.v - min) / (max - min)) * 100));
            return (
              <div
                key={m.v}
                className="absolute -translate-x-1/2 text-center"
                style={{ left: `${mpct}%`, top: 0 }}
              >
                <div className="mx-auto -mt-2.5 h-3 w-px bg-ink-20" />
                <div className="mt-0.5 font-mono text-[9px] text-ink-40 whitespace-nowrap">{m.v}</div>
                <div className="font-mono text-[8px] text-ink-30 whitespace-nowrap uppercase tracking-wider">{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {sub && <div className="mt-4 border-t border-ink-5 pt-3 font-mono text-[11px] text-ink-40">{sub}</div>}
    </div>
  );
}
