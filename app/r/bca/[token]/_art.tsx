"use client";

/**
 * Illustrations for the BCA reveal page. Most are inline SVG that take the person's own
 * numbers; fat% and visceral fat use reference photos (public/bca/*.webp) with the
 * person's position marked on them. Colours are the app's status ramp.
 */
import { statusHex, type StatusLevel, type Gender } from "@/lib/medical-status";

const INK = "#1F1E1B", MUTED = "#8A838E", GREEN = "#396755", ROSE = "#8C4C4C", GOLD = "#C9922B";
const col = (l: StatusLevel | null) => (l ? statusHex[l] : "#B8C2BD");

/** Front-view body silhouette with four tappable zones. Fat% widens the outer layer, visceral tints the belly. */
export function BodyFigure({ fat, visceral, muscle, weight, onPick }: {
  fat: { value: number | null; level: StatusLevel | null }; visceral: { value: number | null; level: StatusLevel | null };
  muscle: { value: number | null; level: StatusLevel | null }; weight: { value: number | null };
  onPick: (k: "fat_pct" | "visceral" | "muscle_pct" | "bmi") => void;
}) {
  const f = Math.min(1, Math.max(0, ((fat.value ?? 25) - 8) / 40)); // 8%→0 · 48%→1
  const w = 1 + f * 0.22;
  const zone = "cursor-pointer";
  return (
    <svg viewBox="0 0 320 300" className="mx-auto block h-auto w-full max-w-[340px]" role="img" aria-label="ร่างกายของคุณ">
      <defs>
        <radialGradient id="belly" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={col(visceral.level)} stopOpacity="0.55" /><stop offset="100%" stopColor={col(visceral.level)} stopOpacity="0" /></radialGradient>
        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F3E9DD" /><stop offset="100%" stopColor="#E8D9C8" /></linearGradient>
      </defs>
      <g transform="translate(60 0)">
      {/* outer (fat) layer scales with fat% */}
      <g transform={`translate(100 0) scale(${w} 1) translate(-100 0)`}>
        <path d="M100 18c-14 0-24 10-24 24 0 10 5 18 12 22v10c-22 6-38 16-44 36l-8 62c-2 10 4 14 10 12l12-40 4 40-6 76c-1 8 4 12 10 12h10c6 0 9-4 10-12l6-60c1-6 5-6 6 0l6 60c1 8 4 12 10 12h10c6 0 11-4 10-12l-6-76 4-40 12 40c6 2 12-2 10-12l-8-62c-6-20-22-30-44-36V64c7-4 12-12 12-22 0-14-10-24-24-24z" fill={col(fat.level)} opacity={0.28} />
      </g>
      {/* body */}
      <path d="M100 18c-14 0-24 10-24 24 0 10 5 18 12 22v10c-22 6-38 16-44 36l-8 62c-2 10 4 14 10 12l12-40 4 40-6 76c-1 8 4 12 10 12h10c6 0 9-4 10-12l6-60c1-6 5-6 6 0l6 60c1 8 4 12 10 12h10c6 0 11-4 10-12l-6-76 4-40 12 40c6 2 12-2 10-12l-8-62c-6-20-22-30-44-36V64c7-4 12-12 12-22 0-14-10-24-24-24z" fill="url(#skin)" stroke="#D9C9B6" strokeWidth={1.5} />
      {/* muscle lines on thighs/arms */}
      <g stroke={col(muscle.level)} strokeWidth={2.2} strokeLinecap="round" opacity={0.7}><path d="M84 170c-2 20-3 40-2 60M116 170c2 20 3 40 2 60M60 110l-4 30M140 110l4 30" /></g>
      {/* belly glow */}
      <ellipse cx={100} cy={132} rx={26 + f * 10} ry={20 + f * 6} fill="url(#belly)" />
      </g>
      {/* zones */}
      <g className={zone} onClick={() => onPick("visceral")}><circle cx={160} cy={132} r={20} fill="transparent" /><Callout x={160} y={132} tx={236} ty={146} label="ไขมันช่องท้อง" value={visceral.value != null ? `ระดับ ${visceral.value}` : "—"} level={visceral.level} side="r" /></g>
      <g className={zone} onClick={() => onPick("fat_pct")}><circle cx={124} cy={110} r={16} fill="transparent" /><Callout x={126} y={112} tx={84} ty={92} label="ไขมัน" value={fat.value != null ? `${fat.value}%` : "—"} level={fat.level} side="l" /></g>
      <g className={zone} onClick={() => onPick("muscle_pct")}><circle cx={176} cy={200} r={16} fill="transparent" /><Callout x={176} y={200} tx={236} ty={220} label="กล้ามเนื้อ" value={muscle.value != null ? `${muscle.value}%` : "—"} level={muscle.level} side="r" /></g>
      <g className={zone} onClick={() => onPick("bmi")}><circle cx={160} cy={90} r={14} fill="transparent" /><Callout x={158} y={88} tx={84} ty={52} label="น้ำหนัก" value={weight.value != null ? `${weight.value} kg` : "—"} level={null} side="l" /></g>
    </svg>
  );
}

function Callout({ x, y, tx, ty, label, value, level, side }: { x: number; y: number; tx: number; ty: number; label: string; value: string; level: StatusLevel | null; side: "l" | "r" }) {
  const anchor = side === "l" ? "end" : "start";
  return (
    <g>
      <line x1={x} y1={y} x2={tx} y2={ty} stroke={MUTED} strokeWidth={1} strokeDasharray="2 2" />
      <circle cx={x} cy={y} r={4} fill={col(level)} stroke="#fff" strokeWidth={1.5} />
      <text x={tx} y={ty - 6} fontSize={9} fill={MUTED} textAnchor={anchor} fontFamily="Sarabun, sans-serif">{label}</text>
      <text x={tx} y={ty + 7} fontSize={12} fontWeight={800} fill={INK} textAnchor={anchor} fontFamily="Manrope, sans-serif">{value}</text>
    </g>
  );
}

/**
 * Photo reference for fat% — six real bodies at labelled fat% (one row per sex). The
 * person's own value is placed by linear interpolation between the labelled panels
 * (their centres, measured on the source image) and marked with an arrow; between two
 * panels the position is an estimate, and values outside the row clamp to its edge.
 */
const FAT_ANCHORS: Record<Gender, [number, number][]> = {
  male: [[3, 0.1025], [5, 0.302], [10, 0.485], [20, 0.6445], [30, 0.804], [40, 0.944]],
  female: [[10, 0.0847], [15, 0.246], [20, 0.404], [25, 0.59], [30, 0.76], [40, 0.915]],
};
function fatX(v: number, anchors: [number, number][]): { x: number; clamped: "low" | "high" | null } {
  if (v <= anchors[0][0]) return { x: anchors[0][1], clamped: v < anchors[0][0] ? "low" : null };
  const last = anchors[anchors.length - 1];
  if (v >= last[0]) return { x: last[1], clamped: v > last[0] ? "high" : null };
  for (let i = 1; i < anchors.length; i++) {
    const [v0, x0] = anchors[i - 1], [v1, x1] = anchors[i];
    if (v <= v1) return { x: x0 + ((v - v0) / (v1 - v0)) * (x1 - x0), clamped: null };
  }
  return { x: last[1], clamped: null };
}

/** Arrow + chip that sits above a photo strip at a horizontal fraction. */
function Pin({ x, label, color }: { x: number; label: string; color: string }) {
  return (
    <div className="absolute bottom-0 flex flex-col items-center" style={{ left: `${x * 100}%`, transform: "translateX(-50%)" }}>
      <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 font-head text-[12px] font-bold text-white shadow-sm" style={{ background: color }}>{label}</span>
      <svg width={16} height={14} viewBox="0 0 16 14" aria-hidden><path d="M8 14L0 3h16z" fill={color} /></svg>
    </div>
  );
}

export function FatLayerArt({ fatPct, gender, level }: { fatPct: number | null; gender: Gender; level: StatusLevel | null }) {
  const pos = fatPct != null ? fatX(fatPct, FAT_ANCHORS[gender]) : null;
  const c = col(level);
  return (
    <div>
      <div className="relative h-11">{pos && <Pin x={pos.x} label={`คุณ ${fatPct}%`} color={c} />}</div>
      <div className="relative overflow-hidden rounded-xl">
        <img src={`/bca/fat-${gender}.webp`} alt={`ตัวอย่างรูปร่างที่ % ไขมันต่าง ๆ (${gender === "male" ? "ชาย" : "หญิง"})`} className="block h-auto w-full" />
        {pos && <div className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.25)]" style={{ left: `${pos.x * 100}%` }} />}
      </div>
      <p className="mt-2 font-thai text-[12px] leading-relaxed text-ink-60">
        {fatPct == null
          ? "ยังไม่มีค่า % ไขมันของคุณ"
          : pos?.clamped === "low" ? `ค่าของคุณ (${fatPct}%) ต่ำกว่าภาพซ้ายสุด — ลูกศรจึงชี้ที่ขอบภาพ`
          : pos?.clamped === "high" ? `ค่าของคุณ (${fatPct}%) สูงกว่าภาพขวาสุด — ลูกศรจึงชี้ที่ขอบภาพ`
          : "ลูกศรคือค่าของคุณ · ตำแหน่งระหว่างภาพเป็นการประมาณ รูปร่างจริงต่างกันตามกล้ามเนื้อและส่วนสูง"}
        {" "}· % ไขมัน = น้ำหนักไขมันทั้งตัว ÷ น้ำหนักตัว
      </p>
    </div>
  );
}

/**
 * Photo reference for visceral fat — an abdominal model that runs from lean (left,
 * device level ≈ 1–2) to fat-wrapped (right, ≈ 10–11). The model occupies the middle
 * of the photo, so the level maps onto that span; levels above 11 clamp to the right edge.
 */
const VIS_LEFT = 0.104, VIS_RIGHT = 0.896;
export function VisceralArt({ level, value }: { level: StatusLevel | null; value: number | null }) {
  const c = col(level);
  const x = value != null ? VIS_LEFT + ((Math.min(11, Math.max(1, value)) - 1) / 10) * (VIS_RIGHT - VIS_LEFT) : null;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  return (
    <div>
      <div className="relative h-11">{x != null && <Pin x={x} label={`คุณ · ระดับ ${value}`} color={c} />}</div>
      <div className="relative overflow-hidden rounded-xl">
        <img src="/bca/visceral.webp" alt="โมเดลช่องท้อง ซ้ายไขมันน้อย ขวาไขมันพันรอบอวัยวะ" className="block h-auto w-full" />
        {x != null && (
          <>
            {/* dim everything except a band around the person's position */}
            <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(31,30,27,.42) 0, rgba(31,30,27,.42) calc(${pct(x)} - 9%), transparent calc(${pct(x)} - 4%), transparent calc(${pct(x)} + 4%), rgba(31,30,27,.42) calc(${pct(x)} + 9%), rgba(31,30,27,.42) 100%)` }} />
            <div className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.25)]" style={{ left: pct(x) }} />
          </>
        )}
      </div>
      <div className="mt-1.5 flex justify-between font-thai text-[11.5px] text-ink-60"><span>← ระดับ 1–2 ไขมันน้อย</span><span>ระดับ 10–11 ไขมันพันรอบอวัยวะ →</span></div>
      <p className="mt-1.5 font-thai text-[12px] leading-relaxed text-ink-60">
        {value == null ? "ยังไม่มีค่าระดับไขมันช่องท้องของคุณ" : value > 11 ? `ระดับ ${value} เกินขอบขวาของภาพ — ไขมันรอบอวัยวะมากกว่าที่เห็นในภาพ` : "แถบสว่างคือตำแหน่งของคุณ"}
        {" "}· ไขมันที่พันรอบตับ ลำไส้ ตับอ่อน มองไม่เห็นจากภายนอก · ระดับจากเครื่อง 1–30: 1–2 ดี · 3–5 ปกติ · 6–10 เริ่มเสี่ยง · 11–15 เสี่ยงสูง · 16+ อันตราย
      </p>
    </div>
  );
}

/** Muscle fibres — denser strands when muscle% is in the good band. */
export function MuscleArt({ level }: { level: StatusLevel | null }) {
  const n = level === "optimal" ? 9 : level === "good" ? 7 : 4;
  return (
    <svg viewBox="0 0 240 110" className="block h-auto w-full" role="img" aria-label="มวลกล้ามเนื้อ">
      <ellipse cx={120} cy={55} rx={100} ry={34} fill={ROSE} opacity={0.15} />
      {Array.from({ length: n }, (_, i) => <path key={i} d={`M30 ${30 + (i * 50) / Math.max(1, n - 1)}c40 -10 140 -10 180 0`} stroke={ROSE} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.75} />)}
      <text x={12} y={16} fontSize={9.5} fill={MUTED} fontFamily="Sarabun">กล้ามเนื้อคือ "เครื่องยนต์" ที่เผาผลาญและพยุงร่างกายตอนอายุมาก</text>
      <text x={12} y={104} fontSize={9.5} fill={MUTED} fontFamily="Sarabun">หลัง 40 ปี มวลกล้ามเนื้อลดราว 3–8% ต่อ 10 ปีถ้าไม่ฝึก (ACSM)</text>
    </svg>
  );
}

/** BMI ruler with the person's marker (Asia-Pacific bands). */
export function BmiArt({ bmi }: { bmi: number | null }) {
  const lo = 15, hi = 35; const x = (v: number) => 12 + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 216;
  const segs: [number, number, StatusLevel, string][] = [[lo, 18.5, "caution", "ผอม"], [18.5, 23, "good", "ปกติ"], [23, 25, "caution", "ระดับ 1"], [25, 30, "warning", "ระดับ 2"], [30, hi, "danger", "ระดับ 3"]];
  return (
    <svg viewBox="0 0 240 80" className="block h-auto w-full" role="img" aria-label="ตำแหน่ง BMI">
      {segs.map(([a, b, l, t]) => <g key={t}><rect x={x(a)} y={30} width={x(b) - x(a)} height={12} fill={statusHex[l]} opacity={0.75} /><text x={(x(a) + x(b)) / 2} y={58} fontSize={8.5} fill={MUTED} textAnchor="middle" fontFamily="Sarabun">{t}</text></g>)}
      {[18.5, 23, 25, 30].map((v) => <text key={v} x={x(v)} y={26} fontSize={8.5} fill={MUTED} textAnchor="middle" fontFamily="Manrope">{v}</text>)}
      {bmi != null && <g><polygon points={`${x(bmi)},44 ${x(bmi) - 6},52 ${x(bmi) + 6},52`} fill={INK} /><text x={x(bmi)} y={74} fontSize={11} fontWeight={800} fill={INK} textAnchor="middle" fontFamily="Manrope">คุณ {bmi}</text></g>}
    </svg>
  );
}

/** BMR flame — what the body burns at rest vs with activity. */
export function BmrArt({ bmr, total }: { bmr: number | null; total: number | null }) {
  const h = 60;
  const r = bmr && total ? Math.min(1, bmr / total) : 0.7;
  return (
    <svg viewBox="0 0 240 100" className="block h-auto w-full" role="img" aria-label="พลังงานที่ใช้">
      <rect x={20} y={20} width={90} height={h} rx={10} fill="#EDE7DE" />
      <rect x={20} y={20 + h * (1 - r)} width={90} height={h * r} rx={10} fill={GOLD} opacity={0.8} />
      <text x={65} y={92} fontSize={9.5} fill={MUTED} textAnchor="middle" fontFamily="Sarabun">ตอนพัก (BMR)</text>
      <rect x={130} y={20} width={90} height={h} rx={10} fill={GREEN} opacity={0.8} />
      <text x={175} y={92} fontSize={9.5} fill={MUTED} textAnchor="middle" fontFamily="Sarabun">ทั้งวันตามกิจกรรม</text>
      <text x={65} y={16} fontSize={11} fontWeight={800} fill={INK} textAnchor="middle" fontFamily="Manrope">{bmr ?? "—"}</text>
      <text x={175} y={16} fontSize={11} fontWeight={800} fill={INK} textAnchor="middle" fontFamily="Manrope">{total ?? "—"}</text>
    </svg>
  );
}

/** Body age vs real age as two markers on one line. */
export function BodyAgeArt({ bodyAge, age }: { bodyAge: number | null; age: number | null }) {
  if (bodyAge == null || age == null) return null;
  const lo = Math.min(bodyAge, age) - 8, hi = Math.max(bodyAge, age) + 8; const x = (v: number) => 20 + ((v - lo) / (hi - lo)) * 200;
  const younger = bodyAge <= age;
  return (
    <svg viewBox="0 0 240 70" className="block h-auto w-full" role="img" aria-label="อายุร่างกายเทียบอายุจริง">
      <line x1={20} x2={220} y1={38} y2={38} stroke="#D9C9B6" strokeWidth={4} strokeLinecap="round" />
      <line x1={x(Math.min(age, bodyAge))} x2={x(Math.max(age, bodyAge))} y1={38} y2={38} stroke={younger ? statusHex.good : statusHex.warning} strokeWidth={6} strokeLinecap="round" />
      <circle cx={x(age)} cy={38} r={7} fill="#fff" stroke={INK} strokeWidth={2} /><text x={x(age)} y={18} fontSize={9.5} fill={MUTED} textAnchor="middle" fontFamily="Sarabun">อายุจริง {age}</text>
      <circle cx={x(bodyAge)} cy={38} r={7} fill={younger ? statusHex.good : statusHex.warning} /><text x={x(bodyAge)} y={62} fontSize={11} fontWeight={800} fill={INK} textAnchor="middle" fontFamily="Manrope">ร่างกาย {bodyAge}</text>
    </svg>
  );
}
