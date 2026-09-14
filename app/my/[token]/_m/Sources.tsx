"use client";

/** Raw-source pages behind "ดูประวัติทั้งหมด ›" — labs by panel, BCA, CGM day, wearable 14 days. */
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { PortalData } from "@/lib/health-design/portal-data";
import { fmtDateTh, fmtNum, fmtTimeTh, levelShort } from "@/lib/health-design/portal-nav";
import { Card, Sub, Big, Chip, LevelChip, Row, Val, Tag, Empty, PrimaryBtn } from "./ui";
import { Sparkline, Bars, CgmDay } from "./charts";
import { TopBar, type Nav } from "./Portal";
import { domainOfMetric } from "./resolve";

/* ── ผลเลือด ─────────────────────────────────────────────────────────────── */
export function LabsScreen({ data, nav }: { data: PortalData; nav: Nav }) {
  return (
    <div className="flex flex-col gap-2.5">
      <TopBar title="ผลเลือด" onBack={nav.back} right={data.labs.latest_at ? <Chip tone="muted">ล่าสุด {fmtDateTh(data.labs.latest_at, data.today)}</Chip> : undefined} />
      {data.labs.panels.length === 0 && <Card className="p-4"><Empty>ยังไม่มีผลเลือดในระบบ — ส่งใบผลตรวจให้โค้ช หรือให้โค้ชนำเข้าจากไฟล์</Empty></Card>}
      {data.labs.panels.map((p) => (
        <Card key={p.panel} className="px-4 pb-1 pt-3">
          <Tag>{p.label_th}</Tag>
          {p.items.map((it, i) => {
            const arrow = it.prev != null && it.value != null ? (it.value > it.prev ? "↑" : it.value < it.prev ? "↓" : "→") : null;
            return (
              <Row key={it.metric} first={i === 0} onClick={() => nav.go(`#src/labs/${it.metric}`)}
                left={<span className="min-w-0"><span className="block font-thai text-[14.5px] font-medium leading-tight">{it.label_th}</span><Sub className="text-[12px]">{fmtDateTh(it.recorded_at, data.today)}{arrow ? ` · ${arrow} จาก ${fmtNum(it.prev)}` : ""}</Sub></span>}
                right={<span className="flex flex-col items-end gap-0.5"><Val value={it.value != null ? fmtNum(it.value, 2) : it.value_text ?? "—"} unit={it.unit ?? undefined} />{it.level && <LevelChip domain={domainOfMetric(it.metric)} level={it.level} text={levelShort(domainOfMetric(it.metric), it.level)} />}</span>} />
            );
          })}
        </Card>
      ))}
      <Sub className="px-2 text-center text-[12px]">สีสถานะจากเกณฑ์ที่ระบุในแต่ละค่า (แตะดู) · ค่าที่ไม่มีสี = ยังไม่มีเกณฑ์ตัดสินในระบบ</Sub>
    </div>
  );
}

/* ── ร่างกาย (BCA) ─────────────────────────────────────────────────────────── */
export function BcaScreen({ data, nav }: { data: PortalData; nav: Nav }) {
  const b = data.bca; const latest = b[0] ?? null; const prev = b[1] ?? null;
  const a = data.assessment?.a; const drv = (m: string) => a?.domains.body_comp.drivers.find((d) => d.metric === m) ?? null;
  const delta = (k: "weight" | "fat_pct" | "muscle_pct" | "visceral") => latest && prev && latest[k] != null && prev[k] != null ? Math.round((latest[k]! - prev[k]!) * 10) / 10 : null;
  const tile = (k: "weight" | "fat_pct" | "muscle_pct" | "visceral", label: string, unit: string, metric: string) => {
    const d = delta(k); const dr = drv(metric);
    return (
      <Card as="button" onClick={() => nav.go(`#health/body_comp/${metric}`)} className="p-3.5">
        <Sub>{label}</Sub>
        <Big value={latest?.[k] != null ? fmtNum(latest[k]) : "—"} unit={unit} className="mt-1 !text-[24px]" />
        <div className="mt-1.5 flex items-center gap-1.5">{dr?.level ? <LevelChip domain="body_comp" level={dr.level} /> : null}{d != null && prev && <Sub className="text-[12px]">{d > 0 ? "↑" : d < 0 ? "↓" : "→"} {fmtNum(Math.abs(d))} จาก {fmtDateTh(prev.at, data.today)}</Sub>}</div>
      </Card>
    );
  };
  const fatHist = [...b].reverse().filter((x) => x.fat_pct != null);
  const gender = data.customer.gender;
  return (
    <div className="flex flex-col gap-2.5">
      <TopBar title="ร่างกาย (BCA)" onBack={nav.back} right={latest ? <Chip tone="muted">{fmtDateTh(latest.at, data.today)}</Chip> : undefined} />
      {!latest ? <Card className="p-4"><Empty>ยังไม่มีค่า BCA — ชั่งที่ศูนย์กับโค้ชแล้วค่าจะมาอยู่ที่นี่</Empty></Card> : (
        <>
          <div className="grid grid-cols-2 gap-2.5">{tile("weight", "น้ำหนัก", "kg", "weight")}{tile("fat_pct", "ไขมัน", "%", "fat_pct")}{tile("muscle_pct", "กล้ามเนื้อ", "%", "muscle_pct")}{tile("visceral", "ไขมันช่องท้อง", "ระดับ", "visceral")}</div>
          {fatHist.length > 1 && (
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-head text-[15px] font-bold text-ink">ไขมัน % · {fatHist.length} ครั้งหลัง</h3><Sub>เป้า &lt;{gender === "male" ? 20 : 30}</Sub></div>
              <Sparkline values={fatHist.map((x) => x.fat_pct!)} labels={fatHist.map((x) => fmtDateTh(x.at, data.today))} target={gender === "male" ? 20 : 30} />
            </Card>
          )}
          <Card className="px-4 py-1">
            {drv("bmi") && <Row first left="BMI" right={<><Val value={fmtNum(drv("bmi")!.value as number)} /><LevelChip domain="body_comp" level={drv("bmi")!.level} /></>} onClick={() => nav.go("#health/body_comp/bmi")} />}
            {latest.bmr != null && <Row first={!drv("bmi")} left="BMR (พลังงานพื้นฐาน)" right={<Val value={fmtNum(Math.round(latest.bmr), 0)} unit="kcal" />} />}
            {latest.body_age != null && <Row left="อายุร่างกาย (เครื่องชั่ง)" right={<Val value={latest.body_age} unit="ปี" />} onClick={drv("body_age") ? () => nav.go("#health/body_comp/body_age") : undefined} />}
          </Card>
          {b.length > 1 && (
            <Card className="px-4 pb-1 pt-3"><Tag>ทุกครั้งที่ชั่ง</Tag>
              {b.map((x, i) => <Row key={x.at} first={i === 0} left={<span className="font-thai text-[13.5px]">{fmtDateTh(x.at, data.today)}</span>} right={<span className="font-head text-[13px] tabular-nums text-ink-60">{fmtNum(x.weight)} kg · ไขมัน {fmtNum(x.fat_pct)}% · กล้าม {fmtNum(x.muscle_pct)}%</span>} />)}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ── น้ำตาล (CGM) ──────────────────────────────────────────────────────────── */
export function CgmScreen({ data, nav }: { data: PortalData; nav: Nav }) {
  const c = data.cgm; const m = c?.metrics ?? null;
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch(`/api/my/${nav.token}/cgm`, { method: "POST", body: fd }); const j = await r.json();
      setMsg(r.ok ? `${j.message} — ${j.parsed?.count ?? ""} ค่า ${fmtDateTh(j.parsed?.first?.slice(0, 10), data.today)} → ${fmtDateTh(j.parsed?.last?.slice(0, 10), data.today)} · รีเฟรชหน้าเพื่อดูกราฟใหม่` : (j.error ?? "อัปโหลดไม่สำเร็จ"));
    } catch { setMsg("อัปโหลดไม่สำเร็จ"); } finally { setBusy(false); e.target.value = ""; }
  };
  return (
    <div className="flex flex-col gap-2.5">
      <TopBar title="น้ำตาล (CGM)" onBack={nav.back} right={c ? <Chip tone="muted">{m!.days} วัน · ถึง {fmtDateTh(c.window.to, data.today)}</Chip> : undefined} />
      {!c || !m ? <Card className="p-4"><Empty>ยังไม่มีข้อมูลเซ็นเซอร์น้ำตาล — ถ้าใส่ CGM อยู่ ส่งไฟล์จากแอปได้ที่ปุ่มด้านล่าง</Empty></Card> : (
        <>
          <Card solid className="p-4">
            <div className="flex items-end justify-between">
              <button type="button" onClick={() => nav.go("#health/metabolic/cgm_tir")} className="text-left"><Sub light>เวลาอยู่ในช่วง 70–180</Sub><Big light value={m.tir_70_180 != null ? fmtNum(m.tir_70_180, 0) : "—"} unit="%" /></button>
              <div className="text-right"><Sub light>เฉลี่ย</Sub><Big light value={m.mean != null ? fmtNum(Math.round(m.mean), 0) : "—"} unit="mg/dL" className="!text-[22px]" /></div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 font-thai text-[12.5px] text-white/90">
              <span>ต่ำ {fmtNum(m.tbr_below_70, 0)}%</span><span>สูง {fmtNum(m.tar_above_180, 0)}%</span><span>ในช่วง 70–140 {fmtNum(m.titr_70_140, 0)}%</span><span>GMI {fmtNum(m.gmi)}%</span><span>CV {fmtNum(m.cv, 0)}%</span>
            </div>
            {!m.reliable && <Sub light className="mt-2 text-[12px]">ข้อมูล {m.days} วัน · ครบ {m.completeness_pct}% — ยังไม่ถึงเกณฑ์ 14 วัน/70% ใช้ดูแนวโน้ม</Sub>}
          </Card>
          {c.last_day && c.last_day.points.length > 3 && (
            <Card className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-head text-[15px] font-bold text-ink">{fmtDateTh(c.last_day.date, data.today)} · 24 ชม.</h3><Sub><span className="inline-block h-2 w-2 rounded-full bg-rose" /> มื้ออาหาร</Sub></div>
              <div className="mt-1"><CgmDay points={c.last_day.points} meals={c.last_day.meals} /></div>
              <Sub className="text-[12px]">แถบเขียว = ช่วง 70–140 · จุดทองคือค่าสูงสุดของวัน · จุดชมพูคือมื้อที่คุณบันทึก</Sub>
            </Card>
          )}
          {m.per_day.length > 1 && (
            <Card className="p-4">
              <h3 className="font-head text-[15px] font-bold text-ink">เฉลี่ยรายวัน</h3>
              <Sparkline values={m.per_day.map((d: any) => Math.round(d.mean ?? 0))} labels={m.per_day.map((d: any) => fmtDateTh(d.date, data.today))} unitDigits={0} />
            </Card>
          )}
        </>
      )}
      <Card className="p-4">
        <h3 className="font-head text-[15px] font-bold text-ink">ส่งไฟล์จากแอปเซ็นเซอร์</h3>
        <Sub className="mt-0.5">ในแอป (เช่น Ottai) กด Export → ได้ไฟล์ .xlsx → เลือกไฟล์นั้นที่นี่ · อัปโหลดซ้ำได้ ค่าที่มีแล้วจะถูกข้าม</Sub>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={upload} className="hidden" />
        <div className="mt-3"><PrimaryBtn tone="ghost" disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{busy ? "กำลังอัปโหลด…" : "เลือกไฟล์"}</PrimaryBtn></div>
        {msg && <Sub className="mt-2">{msg}</Sub>}
      </Card>
    </div>
  );
}

/* ── นาฬิกา ──────────────────────────────────────────────────────────────── */
export function WearableScreen({ data, nav }: { data: PortalData; nav: Nav }) {
  const w = data.wearable; const days = w.days; const conn = w.connection;
  const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const steps = days.map((d) => d.steps); const stepsAvg = avg(steps);
  const sleepAvg = avg(days.map((d) => d.sleep_min)); const hrvAvg = avg(days.map((d) => d.hrv)); const rhrAvg = avg(days.map((d) => d.rhr)); const recAvg = avg(days.map((d) => d.recovery_pct));
  const hrAvg = avg(w.hr.map((d) => d.avg)); const hrMin = avg(w.hr.map((d) => d.min));
  const a = data.assessment?.a; const drv = (m: string) => a?.domains.recovery.drivers.find((d) => d.metric === m) ?? a?.domains.cardio_lipid.drivers.find((d) => d.metric === m) ?? null;
  const provider = conn?.provider === "google_health" ? "Google Health" : conn?.provider === "google_fit" ? "Google Fit" : w.source === "Whoop" ? "Whoop" : conn?.provider ?? w.source;
  const needsRelink = conn?.status === "reauth_required" || conn?.status === "revoked";
  return (
    <div className="flex flex-col gap-2.5">
      <TopBar title="นาฬิกา" onBack={nav.back} right={conn?.last_sync_at ? <Chip tone={needsRelink ? "gold" : "green"}>{needsRelink ? "ต้องเชื่อมใหม่" : `sync ${fmtDateTh(conn.last_sync_at, data.today)} ${fmtTimeTh(conn.last_sync_at)}`}</Chip> : undefined} />
      {days.length === 0 ? <Card className="p-4"><Empty>ยังไม่มีข้อมูลจากนาฬิกา — {conn ? "เชื่อมแล้วแต่ยังไม่มีค่าเข้ามา นาฬิกาต้อง sync เข้าแอปของมันก่อน" : "ขอลิงก์เชื่อมนาฬิกาจากโค้ช หรือส่งไฟล์ export ให้โค้ช"}</Empty></Card> : (
        <>
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <button type="button" onClick={() => nav.go("#health/recovery/steps")} className="text-left"><Sub>ก้าว · เฉลี่ย {days.filter((d) => d.steps != null).length} วัน</Sub><Big value={stepsAvg != null ? fmtNum(Math.round(stepsAvg), 0) : "—"} className="mt-1" /></button>
              {drv("steps") && <LevelChip domain="recovery" level={drv("steps")!.level} text={drv("steps")!.level === "good" ? "≥7,500 active" : "เป้า 7,500"} />}
            </div>
            {steps.some((s) => s != null) && <div className="mt-2.5"><Bars values={steps} low={7500} /><div className="mt-1 flex justify-between"><Sub className="text-[11px]">{fmtDateTh(days[0].date, data.today)}</Sub><Sub className="text-[11px]">{fmtDateTh(days[days.length - 1].date, data.today)}</Sub></div></div>}
          </Card>
          <Card className="px-4 py-1">
            <Row first left="นอน · เฉลี่ย" right={sleepAvg != null ? <><Val value={fmtNum(Math.round((sleepAvg / 60) * 10) / 10)} unit="ชม." />{drv("sleep") && <LevelChip domain="recovery" level={drv("sleep")!.level} />}</> : <Chip tone="muted">นาฬิกาไม่ส่งค่า</Chip>} onClick={sleepAvg != null ? () => nav.go("#health/recovery/sleep") : undefined} />
            <Row left="หัวใจเฉลี่ย / ต่ำสุด" right={hrAvg != null ? <><Val value={fmtNum(Math.round(hrAvg), 0)} unit={hrMin != null ? `/ ${fmtNum(Math.round(hrMin), 0)}` : "bpm"} /><Chip tone="muted">แนวโน้ม</Chip></> : <Chip tone="muted">นาฬิกาไม่ส่งค่า</Chip>} />
            <Row left="ชีพจรขณะพัก" right={rhrAvg != null ? <><Val value={fmtNum(Math.round(rhrAvg), 0)} unit="bpm" /><Chip tone="muted">แนวโน้ม</Chip></> : <Chip tone="muted">นาฬิกาไม่ส่งค่า</Chip>} onClick={rhrAvg != null ? () => nav.go("#health/cardio_lipid/rhr") : undefined} />
            <Row left="HRV" right={hrvAvg != null ? <><Val value={fmtNum(Math.round(hrvAvg), 0)} unit="ms" /><Chip tone="muted">แนวโน้ม</Chip></> : <Chip tone="muted">นาฬิกาไม่ส่งค่า</Chip>} onClick={hrvAvg != null ? () => nav.go("#health/recovery/hrv") : undefined} />
            {recAvg != null && <Row left="Recovery (Whoop)" right={<><Val value={fmtNum(Math.round(recAvg), 0)} unit="%" />{drv("recovery") && <LevelChip domain="recovery" level={drv("recovery")!.level} />}</>} onClick={() => nav.go("#health/recovery/recovery")} />}
          </Card>
          {hrvAvg == null && rhrAvg == null && <Sub className="px-2 text-[12px]">ชีพจรขณะพักและ HRV เป็นค่าที่นาฬิกาต้องคำนวณเอง (Fitbit/Pixel Watch ส่งให้ · Galaxy Watch ผ่าน Samsung Health ยังไม่ส่ง) — ไม่ใช่ค่าที่ระบบประมาณแทนได้</Sub>}
        </>
      )}
      {(conn || w.source) && (
        <Card className={`p-4 ${needsRelink ? "border-[rgba(201,146,43,.4)]" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-thai text-[13.5px] text-ink">ข้อมูลผ่าน <b>{provider}</b>{conn?.provider === "google_health" ? " · นาฬิกา → Samsung Health/Fitbit → Health Connect → แอป Google Health" : ""}</div>
            <Chip tone={needsRelink ? "gold" : "green"}>{needsRelink ? "หลุด" : "เชื่อมอยู่"}</Chip>
          </div>
          {needsRelink && <Sub className="mt-2">การเชื่อมหมดอายุ (Google ให้ 7 วันในโหมดทดสอบ) — ขอลิงก์เชื่อมใหม่จากโค้ช ข้อมูลเดิมยังอยู่ครบ</Sub>}
        </Card>
      )}
    </div>
  );
}
