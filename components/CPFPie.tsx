/**
 * C:P:F donut chart — pure SVG, no deps.
 *
 * Carb · Protein · Fat segments rendered as donut arcs.
 * Center shows total kcal (or custom label).
 */

interface Props {
  carb_pct:    number;
  protein_pct: number;
  fat_pct:     number;
  total_kcal?: number;
  centerLabel?: string;       // override the kcal text
  size?:        number;       // px · default 180
  thickness?:   number;       // ring thickness · default 36
  showLegend?:  boolean;      // default true
}

// Brand color hex (match tailwind config)
const ROSE     = "#8C4C4C";
const WELLNESS = "#396755";
const AMBER    = "#C47A2A";
const LINE     = "#DDD9DF";

export function CPFPie({
  carb_pct, protein_pct, fat_pct,
  total_kcal, centerLabel,
  size = 180, thickness = 36, showLegend = true,
}: Props) {
  const radius   = size / 2;
  const outerR   = radius - 2;
  const innerR   = outerR - thickness;
  const cx = radius, cy = radius;

  // Total may not be exactly 100 (rounding) · normalize for arc math
  const total = carb_pct + protein_pct + fat_pct;
  const hasData = total > 0;

  const segments = hasData ? [
    { value: carb_pct,    color: ROSE,     label: "Carb",    pct: carb_pct },
    { value: protein_pct, color: WELLNESS, label: "Protein", pct: protein_pct },
    { value: fat_pct,     color: AMBER,    label: "Fat",     pct: fat_pct },
  ].filter((s) => s.value > 0) : [];

  // Single full segment short-circuit (avoid arc path with 360°)
  const isFull = segments.length === 1;

  let cursor = -Math.PI / 2; // start at top

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        {!hasData && (
          <>
            <circle cx={cx} cy={cy} r={outerR} fill={LINE} />
            <circle cx={cx} cy={cy} r={innerR} fill="white" />
          </>
        )}
        {isFull && (
          <>
            <circle cx={cx} cy={cy} r={outerR} fill={segments[0].color} />
            <circle cx={cx} cy={cy} r={innerR} fill="white" />
          </>
        )}
        {!isFull && segments.map((seg, i) => {
          const angle = (seg.value / total) * 2 * Math.PI;
          const start = cursor;
          const end   = cursor + angle;
          cursor = end;
          const d = arcPath(cx, cy, outerR, innerR, start, end);
          return <path key={i} d={d} fill={seg.color} />;
        })}

        {/* Center label */}
        {hasData && (
          <>
            <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
                  className="fill-ink"
                  style={{ fontSize: size * 0.16, fontWeight: 800 }}>
              {centerLabel ?? (total_kcal != null ? total_kcal.toLocaleString() : "—")}
            </text>
            {!centerLabel && total_kcal != null && (
              <text x={cx} y={cy + size * 0.11} textAnchor="middle" dominantBaseline="middle"
                    className="fill-ink-40"
                    style={{ fontSize: size * 0.07, fontWeight: 500 }}>
                kcal
              </text>
            )}
          </>
        )}
      </svg>

      {showLegend && hasData && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-mono">
          <LegendItem color={ROSE}     label="C"  pct={carb_pct} />
          <LegendItem color={WELLNESS} label="P"  pct={protein_pct} />
          <LegendItem color={AMBER}    label="F"  pct={fat_pct} />
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="font-bold text-ink">{label}</span>
      <span className="text-ink-60">{pct}%</span>
    </div>
  );
}

/** SVG donut arc path */
function arcPath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle);
  const y2 = cy + outerR * Math.sin(endAngle);
  const x3 = cx + innerR * Math.cos(endAngle);
  const y3 = cy + innerR * Math.sin(endAngle);
  const x4 = cx + innerR * Math.cos(startAngle);
  const y4 = cy + innerR * Math.sin(startAngle);
  const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}
