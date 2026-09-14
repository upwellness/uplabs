"use client";

/**
 * S3 · อาหาร + S3a · ตรวจก่อนบันทึก. Camera first; the AI estimate fills the fields and
 * nothing is saved until the customer confirms (feedback_ai_estimate_needs_human_confirm).
 * Same /api/my/<token>/food contract as the old PortalTools; EXIF gives the time for album photos.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Images, PencilLine, Check, ChevronRight } from "lucide-react";
import type { PortalData } from "@/lib/health-design/portal-data";
import type { StoredFoodEntry } from "@/lib/food/store";
import { exifDateTime } from "@/lib/food/entries";
import { fmtDateTh, fmtNum, fmtTimeTh } from "@/lib/health-design/portal-nav";
import { Card, Sub, Chip, Row, Val, PrimaryBtn, Tag, Empty } from "./ui";
import { CpfRing } from "./charts";
import { TopBar, type Nav } from "./Portal";

interface Estimate { food_identified: string; calories_estimate?: number; macros?: { carb_g: number; protein_g: number; fat_g: number; fiber_g: number }; glucose_impact?: { score: number; label?: string }; health_score?: { score: number }; food_components?: string[] }
const p2 = (n: number) => String(n).padStart(2, "0");
const nowLocal = () => { const d = new Date(); d.setSeconds(0, 0); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const bkkDate = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

export function FoodScreen({ data, nav }: { data: PortalData; nav: Nav }) {
  const base = `/api/my/${nav.token}/food`;
  const [entries, setEntries] = useState<StoredFoodEntry[]>(data.food.entries);
  const [summary, setSummary] = useState(data.food.summary);
  const [showWeek, setShowWeek] = useState(false);
  // confirm flow
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [img, setImg] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [eatenAt, setEatenAt] = useState(nowLocal());
  const [hint, setHint] = useState<string | null>(null);
  const [est, setEst] = useState<Estimate | null>(null);
  const [fields, setFields] = useState({ description: "", calories: "", carb_g: "", protein_g: "", fat_g: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null), albumRef = useRef<HTMLInputElement>(null);
  const isNew = nav.state.page === "food-new";

  const reload = async () => { try { const r = await fetch(base, { cache: "no-store" }); const j = await r.json(); setEntries(j.entries ?? []); setSummary(j.summary ?? summary); } catch { /* ignore */ } };
  const reset = () => { setEst(null); setImg(null); setText(""); setEatenAt(nowLocal()); setHint(null); setMsg(null); };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>, fromAlbum: boolean) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    setMode("photo"); setEst(null); setMsg(null);
    try {
      const exif = exifDateTime(new Uint8Array(await f.arrayBuffer()));
      if (exif) { setEatenAt(exif.replace(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}).*$/, "$1-$2-$3T$4:$5")); setHint("เวลาจากรูป — แก้ได้ถ้าไม่ตรง"); }
      else if (fromAlbum && Date.now() - f.lastModified > 24 * 3600_000) { setEatenAt(""); setHint("รูปเก่าไม่มีเวลาถ่าย — เลือกวันเวลาที่กิน"); }
      else { setEatenAt(nowLocal()); setHint(null); }
    } catch { setHint(null); }
    const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
    const im = new Image(); im.src = dataUrl; await new Promise((r) => (im.onload = r));
    const max = 1280, s = Math.min(1, max / Math.max(im.width, im.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
    cv.getContext("2d")!.drawImage(im, 0, 0, cv.width, cv.height);
    setImg(cv.toDataURL("image/jpeg", 0.85));
    nav.go("#food/new");
  };

  const estimate = async () => {
    setBusy("est"); setMsg(null);
    try {
      const body: any = { step: "estimate" };
      if (mode === "photo" && img) { const m = img.match(/^data:(image\/\w+);base64,(.+)$/)!; body.image_base64 = m[2]; body.mime_type = m[1]; }
      else body.text_description = text;
      const r = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "ไม่สำเร็จ"); return; }
      const e: Estimate = j.result; setEst(e);
      setFields({ description: e.food_identified ?? text, calories: e.calories_estimate == null ? "" : String(Math.round(e.calories_estimate)), carb_g: e.macros?.carb_g == null ? "" : String(Math.round(e.macros.carb_g)), protein_g: e.macros?.protein_g == null ? "" : String(Math.round(e.macros.protein_g)), fat_g: e.macros?.fat_g == null ? "" : String(Math.round(e.macros.fat_g)) });
    } catch { setMsg("วิเคราะห์ไม่สำเร็จ — ลองใหม่หรือใส่ตัวเลขเอง"); } finally { setBusy(null); }
  };
  // photo lands → estimate right away (one less tap); text waits for the button
  useEffect(() => { if (isNew && mode === "photo" && img && !est && !busy && !msg) void estimate(); }, [img]); // eslint-disable-line react-hooks/exhaustive-deps

  const manual = () => { setEst({ food_identified: text || "มื้ออาหาร" }); setFields({ description: text || "", calories: "", carb_g: "", protein_g: "", fat_g: "" }); };

  const save = async () => {
    if (!eatenAt) { setMsg("เลือกวันเวลาที่กินก่อน"); return; }
    setBusy("save"); setMsg(null);
    try {
      const n = (v: string) => (v.trim() === "" ? null : Number(v));
      const r = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        step: "save", confirmed: true, eaten_at: eatenAt.replace("T", " "), description: fields.description, items: est?.food_components ?? [],
        calories: n(fields.calories), carb_g: n(fields.carb_g), protein_g: n(fields.protein_g), fat_g: n(fields.fat_g),
        glucose_impact_score: est?.glucose_impact?.score ?? null, health_score: est?.health_score?.score ?? null,
        source: mode === "text" ? "text" : hint ? "photo_backfill" : "photo", estimated_by: est?.calories_estimate == null ? "manual" : "gemini", raw_analysis: est,
      }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "บันทึกไม่สำเร็จ"); return; }
      reset(); await reload(); nav.go("#food");
    } catch { setMsg("บันทึกไม่สำเร็จ"); } finally { setBusy(null); }
  };

  const today = summary.days.find((d) => d.date === data.today) ?? null;
  const t = data.food.targets;
  const byDay = useMemo(() => { const m = new Map<string, StoredFoodEntry[]>(); for (const e of entries) { const d = bkkDate(e.eaten_at); (m.get(d) ?? m.set(d, []).get(d)!).push(e); } return [...m.entries()].sort(([a], [b]) => b.localeCompare(a)); }, [entries]);
  const input = "mt-1 w-full rounded-xl border border-ink-10 bg-white/80 px-3 py-2.5 font-head text-[15px] font-bold text-ink focus:border-wellness focus:outline-none";

  /* ── S3a confirm ── */
  if (isNew) {
    return (
      <div className="flex flex-col gap-2.5">
        <TopBar title="ตรวจก่อนบันทึก" onBack={() => { reset(); nav.back(); }} right={est && est.calories_estimate != null ? <Chip tone="rose">AI ประเมิน</Chip> : undefined} />
        {mode === "photo" && img ? <img src={img} alt="" className="h-[170px] w-full rounded-[18px] object-cover" /> : (
          <Card className="p-4">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="เช่น ข้าวมันไก่ 1 จาน กาแฟเย็นหวานน้อย" className="w-full rounded-xl border border-ink-10 bg-white/80 px-3 py-2.5 font-thai text-[15px] focus:border-wellness focus:outline-none" />
            {!est && <div className="mt-2 grid grid-cols-2 gap-2"><PrimaryBtn tone="rose" disabled={!!busy || text.trim().length < 3} onClick={estimate}>{busy === "est" ? "กำลังวิเคราะห์…" : "ให้ AI ประเมิน"}</PrimaryBtn><PrimaryBtn tone="ghost" disabled={!!busy || text.trim().length < 2} onClick={manual}>ใส่ตัวเลขเอง</PrimaryBtn></div>}
          </Card>
        )}
        {busy === "est" && <Card className="p-4"><Sub aria-busy="true">กำลังอ่านรูปและประเมินมื้อนี้… (ใช้โควตา {data.food.ai_used_today + 1}/{data.food.ai_cap} ของวันนี้)</Sub></Card>}
        {est && (
          <Card className="p-4">
            <label className="block"><Sub>ชื่อมื้อ</Sub><input value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} className={`${input} !font-thai !font-semibold`} placeholder="ชื่อมื้อ" /></label>
            <label className="mt-2.5 block"><Sub>กินเมื่อไร {hint && <span className="text-[#7A5410]">· {hint}</span>}</Sub><input type="datetime-local" value={eatenAt} max={nowLocal()} onChange={(e) => { setEatenAt(e.target.value); setHint(null); }} className={`${input} ${eatenAt ? "" : "!border-status-danger"}`} /></label>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {([["calories", "kcal"], ["carb_g", "คาร์บ g"], ["protein_g", "โปรตีน g"], ["fat_g", "ไขมัน g"]] as const).map(([k, l]) => (
                <label key={k} className="block text-center"><input type="number" inputMode="decimal" value={(fields as any)[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} className={`${input} text-center`} /><Sub className="mt-1 text-[11px]">{l}</Sub></label>
              ))}
            </div>
            <Sub className="mt-2.5 text-[12px]">แก้ตัวเลขได้ทุกช่อง — ระบบไม่บันทึกจนกว่าคุณจะกดยืนยัน</Sub>
          </Card>
        )}
        {est && (est.glucose_impact || est.health_score) && (
          <Card className="px-4 py-1">
            {est.glucose_impact && <Row first left="ผลต่อน้ำตาล (AI ประมาณ)" right={<Chip tone={est.glucose_impact.score <= 4 ? "green" : est.glucose_impact.score <= 7 ? "gold" : "rose"}>{est.glucose_impact.score}/10{est.glucose_impact.label ? ` · ${est.glucose_impact.label}` : ""}</Chip>} />}
            {est.health_score && <Row first={!est.glucose_impact} left="คุณภาพมื้อ (AI ประมาณ)" right={<Chip tone={est.health_score.score >= 7 ? "green" : est.health_score.score >= 4 ? "gold" : "rose"}>{est.health_score.score}/10</Chip>} />}
          </Card>
        )}
        {msg && <Sub className="px-2">{msg}</Sub>}
        {est && <PrimaryBtn disabled={!!busy || !fields.description.trim() || !eatenAt} onClick={save}><Check className="h-4 w-4" />{busy === "save" ? "กำลังบันทึก…" : "ยืนยันและบันทึกมื้อนี้"}</PrimaryBtn>}
        {!est && mode === "photo" && !busy && msg && <div className="grid grid-cols-2 gap-2"><PrimaryBtn tone="ghost" onClick={estimate}>ลองอีกครั้ง</PrimaryBtn><PrimaryBtn tone="ghost" onClick={() => { setMode("text"); setMsg(null); }}>พิมพ์เอง</PrimaryBtn></div>}
      </div>
    );
  }

  /* ── S3 home ── */
  return (
    <div className="flex flex-col gap-2.5">
      <TopBar title="อาหาร" right={<Chip tone="muted">วันนี้ · {fmtDateTh(data.today, data.today)}</Chip>} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={(e) => pick(e, false)} className="hidden" />
      <input ref={albumRef} type="file" accept="image/*" onChange={(e) => pick(e, true)} className="hidden" />
      <Card solid className="px-4 py-5 text-center">
        <button type="button" onClick={() => camRef.current?.click()} className="mx-auto grid h-[58px] w-[58px] place-items-center rounded-full bg-white/20 text-white" aria-label="ถ่ายรูปมื้อนี้"><Camera className="h-7 w-7" /></button>
        <button type="button" onClick={() => camRef.current?.click()} className="mt-2.5 block w-full font-head text-[17px] font-extrabold">ถ่ายรูปมื้อนี้</button>
        <div className="mt-1 flex items-center justify-center gap-4 font-thai text-[13.5px] text-white/85">
          <button type="button" onClick={() => albumRef.current?.click()} className="inline-flex items-center gap-1 underline underline-offset-2"><Images className="h-3.5 w-3.5" />เลือกจากอัลบั้ม</button>
          <button type="button" onClick={() => { setMode("text"); setEst(null); setImg(null); nav.go("#food/new"); }} className="inline-flex items-center gap-1 underline underline-offset-2"><PencilLine className="h-3.5 w-3.5" />พิมพ์เอง</button>
        </div>
      </Card>

      <Card className="px-4 py-3">
        <div className="flex items-center justify-between"><Sub>วันนี้กินไปแล้ว{today ? ` · ${today.entries} มื้อ` : ""}</Sub>{t && today && today.protein_g < t.protein_g && <Chip tone="gold">โปรตีนขาด {fmtNum(Math.round(t.protein_g - today.protein_g), 0)} g</Chip>}</div>
        {!today ? <Sub className="mt-1.5">ยังไม่มีมื้อของวันนี้ — ถ่ายรูปมื้อแรกได้เลย</Sub> : (
          <div className="mt-2 flex items-center gap-4">
            <CpfRing carb={today.carb_g} protein={today.protein_g} fat={today.fat_g} kcal={today.calories} />
            <div className="grid flex-1 grid-cols-3 text-center">
              <div><Val value={fmtNum(Math.round(today.carb_g), 0)} unit={t ? `/${fmtNum(Math.round(t.carb_g), 0)}` : "g"} /><Sub className="text-[11.5px]"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#C9922B]" />คาร์บ g</Sub></div>
              <div><Val value={fmtNum(Math.round(today.protein_g), 0)} unit={t ? `/${fmtNum(Math.round(t.protein_g), 0)}` : "g"} className={t && today.protein_g < t.protein_g ? "!text-[#B4413C]" : ""} /><Sub className="text-[11.5px]"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-wellness" />โปรตีน g</Sub></div>
              <div><Val value={fmtNum(Math.round(today.fat_g), 0)} unit={t ? `/${fmtNum(Math.round(t.fat_g), 0)}` : "g"} /><Sub className="text-[11.5px]"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose" />ไขมัน g</Sub></div>
            </div>
          </div>
        )}
        {t ? <Sub className="mt-2 text-[12px]">เป้าจากแผน 90 วัน · {fmtNum(Math.round(t.kcal), 0)} kcal/วัน</Sub> : <Sub className="mt-2 text-[12px]">ยังไม่มีเป้าจากแผน — โค้ชจะตั้งให้เมื่อยืนยันแผน</Sub>}
      </Card>

      {byDay.length === 0 ? <Card className="p-4"><Empty>ยังไม่มีมื้อที่บันทึกใน 7 วันนี้</Empty></Card> : (showWeek ? byDay : byDay.slice(0, 2)).map(([d, list]) => (
        <Card key={d} className="px-4 pb-1 pt-3">
          <Tag>{d === data.today ? "วันนี้" : fmtDateTh(d, data.today)} · {list.length} มื้อ</Tag>
          {list.map((e, i) => <EntryRow key={e.id} e={e} first={i === 0} />)}
        </Card>
      ))}
      {byDay.length > 2 && <button type="button" onClick={() => setShowWeek((s) => !s)} className="inline-flex items-center justify-center gap-1 py-1 font-thai text-[13.5px] font-semibold text-wellness">{showWeek ? "ย่อเหลือ 2 วัน" : `ดูทั้ง ${byDay.length} วัน`} <ChevronRight className={`h-4 w-4 transition ${showWeek ? "rotate-90" : ""}`} /></button>}
      {summary.entries > 0 && <Sub className="px-2 text-center text-[12px]">7 วัน: บันทึก {summary.days_logged} วัน · เฉลี่ย {fmtNum(summary.avg_calories, 0)} kcal · โปรตีน {fmtNum(summary.avg_protein_g, 0)} g ต่อวันที่บันทึก</Sub>}
    </div>
  );
}

function EntryRow({ e, first }: { e: StoredFoodEntry; first: boolean }) {
  const [open, setOpen] = useState(false);
  const src = e.source === "text" ? "พิมพ์" : e.source === "photo_backfill" ? "จากอัลบั้ม" : e.source === "api" ? "ผ่าน AI ของคุณ" : "ถ่ายรูป";
  const by = e.estimated_by === "manual" ? "ใส่เอง" : "AI ประเมิน · ยืนยันแล้ว";
  return (
    <>
      <Row first={first} expanded={open} onClick={() => setOpen((o) => !o)}
        left={<span className="min-w-0"><span className="block truncate font-thai text-[14.5px] font-medium">{e.description}</span><Sub className="text-[12px]">{e.time_known ? fmtTimeTh(e.eaten_at) : "ไม่ระบุเวลา"} · {src} · {by}</Sub></span>}
        right={<span className="flex items-center gap-1.5">{e.calories != null && <Val value={fmtNum(Math.round(e.calories), 0)} unit="kcal" />}{e.glucose_impact_score != null && <Chip tone={e.glucose_impact_score <= 4 ? "green" : e.glucose_impact_score <= 7 ? "gold" : "rose"}>น้ำตาล {e.glucose_impact_score}</Chip>}</span>} />
      {open && (
        <div className="pb-2.5 pl-1 font-thai text-[13px] text-ink-60">
          {e.items.length > 0 && <div>ส่วนประกอบ: {e.items.join(", ")}</div>}
          <div className="mt-0.5">คาร์บ {fmtNum(e.carb_g, 0)} g · โปรตีน {fmtNum(e.protein_g, 0)} g · ไขมัน {fmtNum(e.fat_g, 0)} g{e.fiber_g != null ? ` · ใยอาหาร ${fmtNum(e.fiber_g, 0)} g` : ""}{e.health_score != null ? ` · คุณภาพมื้อ ${e.health_score}/10` : ""}</div>
        </div>
      )}
    </>
  );
}
