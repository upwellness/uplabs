"use client";

/**
 * Customer-side inputs on /my/<token>: log a meal (photo / album / text) with the
 * same confirm-before-save step the coach app uses, and upload an Ottai CGM file.
 */
import { useEffect, useState } from "react";
import { exifDateTime } from "@/lib/food/entries";

interface Entry { id: string; description: string; eaten_at: string; time_known: boolean; calories: number | null; protein_g: number | null }
interface Estimate { food_identified: string; calories_estimate?: number; macros?: { carb_g: number; protein_g: number; fat_g: number; fiber_g: number }; glucose_impact?: { score: number }; health_score?: { score: number }; food_components?: string[]; error?: string }

const p2 = (n: number) => String(n).padStart(2, "0");
const nowLocal = () => { const d = new Date(); d.setSeconds(0, 0); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };

export function PortalTools({ token }: { token: string }) {
  const base = `/api/my/${token}`;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [img, setImg] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [eatenAt, setEatenAt] = useState(nowLocal());
  const [hint, setHint] = useState<string | null>(null);
  const [est, setEst] = useState<Estimate | null>(null);
  const [fields, setFields] = useState({ description: "", calories: "", carb_g: "", protein_g: "", fat_g: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [cgmMsg, setCgmMsg] = useState<string | null>(null);

  const load = async () => {
    try { const r = await fetch(`${base}/food`, { cache: "no-store" }); const j = await r.json(); setEntries(j.entries ?? []); setSummary(j.summary ?? null); } catch { /* ignore */ }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const exif = exifDateTime(new Uint8Array(await f.arrayBuffer()));
      if (exif) { setEatenAt(exif.replace(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}).*$/, "$1-$2-$3T$4:$5")); setHint("📷 เวลาจากรูป — แก้ได้ถ้าไม่ตรง"); }
      else if (Date.now() - f.lastModified > 24 * 3600_000) { setEatenAt(""); setHint("รูปเก่าไม่มีเวลาถ่าย — เลือกวันเวลาที่กิน"); }
      else { setEatenAt(nowLocal()); setHint(null); }
    } catch { setHint(null); }
    const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
    // shrink for upload
    const im = new Image(); im.src = dataUrl; await new Promise((r) => (im.onload = r));
    const max = 1280, s = Math.min(1, max / Math.max(im.width, im.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
    cv.getContext("2d")!.drawImage(im, 0, 0, cv.width, cv.height);
    setImg(cv.toDataURL("image/jpeg", 0.85)); setEst(null); setMsg(null);
  };

  const estimate = async () => {
    setBusy("est"); setMsg(null);
    try {
      const body: any = { step: "estimate" };
      if (mode === "photo" && img) { const m = img.match(/^data:(image\/\w+);base64,(.+)$/)!; body.image_base64 = m[2]; body.mime_type = m[1]; }
      else body.text_description = text;
      const r = await fetch(`${base}/food`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "ไม่สำเร็จ"); return; }
      const e: Estimate = j.result; setEst(e);
      setFields({ description: e.food_identified ?? text, calories: e.calories_estimate == null ? "" : String(e.calories_estimate), carb_g: e.macros?.carb_g == null ? "" : String(e.macros.carb_g), protein_g: e.macros?.protein_g == null ? "" : String(e.macros.protein_g), fat_g: e.macros?.fat_g == null ? "" : String(e.macros.fat_g) });
    } catch { setMsg("ไม่สำเร็จ"); } finally { setBusy(null); }
  };
  const manual = () => { setEst({ food_identified: text || "มื้ออาหาร" }); setFields({ description: text || "", calories: "", carb_g: "", protein_g: "", fat_g: "" }); };

  const save = async () => {
    if (!eatenAt) { setMsg("เลือกวันเวลาที่กินก่อน"); return; }
    setBusy("save"); setMsg(null);
    try {
      const n = (v: string) => (v.trim() === "" ? null : Number(v));
      const r = await fetch(`${base}/food`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        step: "save", confirmed: true, eaten_at: eatenAt.replace("T", " "), description: fields.description, items: est?.food_components ?? [],
        calories: n(fields.calories), carb_g: n(fields.carb_g), protein_g: n(fields.protein_g), fat_g: n(fields.fat_g),
        glucose_impact_score: est?.glucose_impact?.score ?? null, health_score: est?.health_score?.score ?? null,
        source: mode === "text" ? "text" : hint ? "photo_backfill" : "photo", estimated_by: est?.calories_estimate == null ? "manual" : "gemini", raw_analysis: est,
      }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error ?? "บันทึกไม่สำเร็จ"); return; }
      setMsg("บันทึกแล้ว ✓"); setEst(null); setImg(null); setText(""); setEatenAt(nowLocal()); setHint(null); await load();
    } catch { setMsg("บันทึกไม่สำเร็จ"); } finally { setBusy(null); }
  };

  const uploadCgm = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy("cgm"); setCgmMsg(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch(`${base}/cgm`, { method: "POST", body: fd }); const j = await r.json();
      setCgmMsg(r.ok ? `${j.message} — ${j.parsed?.count ?? ""} ค่า ${j.parsed?.first?.slice(0, 10) ?? ""} → ${j.parsed?.last?.slice(0, 10) ?? ""}` : (j.error ?? "อัปโหลดไม่สำเร็จ"));
    } catch { setCgmMsg("อัปโหลดไม่สำเร็จ"); } finally { setBusy(null); e.target.value = ""; }
  };

  const input = "mt-1 w-full rounded-xl border border-ink-10 bg-white px-3 py-2 text-sm focus:border-rose focus:outline-none";
  return (
    <>
      <section className="mt-6">
        <h2 className="mb-2 font-head text-[15px] font-bold text-ink">บันทึกอาหาร</h2>
        {summary && <p className="font-thai text-[12px] text-ink-60">7 วันล่าสุด: บันทึก {summary.days_logged} วัน · เฉลี่ย {summary.avg_calories ?? "—"} kcal · โปรตีน {summary.avg_protein_g ?? "—"} g ต่อวันที่บันทึก</p>}
        <div className="mt-2 flex gap-1 rounded-full bg-surface p-1 w-fit">
          {(["photo", "text"] as const).map((m) => <button key={m} type="button" onClick={() => { setMode(m); setEst(null); }} className={`rounded-full px-3 py-1 font-thai text-[12px] ${mode === m ? "bg-rose text-white" : "text-ink-60"}`}>{m === "photo" ? "📷 รูป" : "✍️ พิมพ์"}</button>)}
        </div>
        {mode === "photo" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="cursor-pointer rounded-2xl border-2 border-dashed border-ink-10 p-4 text-center font-thai text-[12px] text-ink"><input type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />📷 ถ่ายตอนนี้</label>
            <label className="cursor-pointer rounded-2xl border-2 border-dashed border-ink-10 p-4 text-center font-thai text-[12px] text-ink"><input type="file" accept="image/*" onChange={pick} className="hidden" />🖼️ เลือกจากอัลบั้ม</label>
            {img && <img src={img} alt="" className="col-span-2 h-48 w-full rounded-2xl object-cover" />}
          </div>
        ) : (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="เช่น ข้าวมันไก่ 1 จาน กาแฟเย็นหวานน้อย" className={`${input} font-thai`} />
        )}
        <label className="mt-3 block"><span className="font-thai text-[11px] font-semibold text-ink-60">กินเมื่อไร</span>
          <input type="datetime-local" value={eatenAt} max={nowLocal()} onChange={(e) => { setEatenAt(e.target.value); setHint(null); }} className={`${input} ${eatenAt ? "" : "border-status-danger"}`} />
          {hint && <div className="mt-1 font-thai text-[11px] text-ink-60">{hint}</div>}
        </label>
        {!est ? (
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={!!busy || (mode === "photo" ? !img : text.trim().length < 3)} onClick={estimate} className="rounded-xl bg-rose px-4 py-2 font-thai text-sm font-semibold text-white disabled:opacity-50">{busy === "est" ? "กำลังวิเคราะห์…" : "ให้ AI ประมาณให้"}</button>
            {mode === "text" && <button type="button" disabled={!!busy || text.trim().length < 2} onClick={manual} className="rounded-xl border border-ink-10 px-4 py-2 font-thai text-sm text-ink disabled:opacity-50">ใส่ตัวเลขเอง</button>}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-rose/30 bg-rose-ultra p-4">
            <div className="font-thai text-[11px] font-semibold text-rose">🤖 ตัวเลขประมาณ — ตรวจแล้วกดบันทึก (แก้ได้ทุกช่อง)</div>
            <input value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} className={`${input} font-thai`} placeholder="ชื่อมื้อ" />
            <div className="mt-2 grid grid-cols-4 gap-2">
              {([["calories", "kcal"], ["carb_g", "คาร์บ g"], ["protein_g", "โปรตีน g"], ["fat_g", "ไขมัน g"]] as const).map(([k, l]) => (
                <label key={k} className="block"><span className="font-thai text-[10px] text-ink-60">{l}</span><input type="number" inputMode="decimal" value={(fields as any)[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} className={input} /></label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={!!busy || !fields.description.trim() || !eatenAt} onClick={save} className="rounded-xl bg-rose px-4 py-2 font-thai text-sm font-semibold text-white disabled:opacity-50">{busy === "save" ? "กำลังบันทึก…" : "ยืนยันและบันทึก"}</button>
              <button type="button" disabled={!!busy} onClick={() => setEst(null)} className="rounded-xl border border-ink-10 px-4 py-2 font-thai text-sm text-ink">ยกเลิก</button>
            </div>
          </div>
        )}
        {msg && <p className="mt-2 font-thai text-[12px] text-ink-60">{msg}</p>}
        {entries.length > 0 && (
          <ul className="mt-3 space-y-1">
            {entries.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-2 font-thai text-[12px] text-ink">
                <span>{e.description}</span>
                <span className="shrink-0 text-ink-40">{new Date(e.eaten_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}{e.time_known ? ` ${new Date(e.eaten_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : ""} · {e.calories ?? "—"} kcal</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-head text-[15px] font-bold text-ink">ส่งไฟล์เซ็นเซอร์น้ำตาล (CGM)</h2>
        <p className="font-thai text-[12px] text-ink-60">ในแอป Ottai กด Export → ได้ไฟล์ .xlsx → เลือกไฟล์นั้นที่นี่ · อัปโหลดซ้ำได้ ค่าที่มีแล้วจะถูกข้าม</p>
        <label className="mt-2 inline-block cursor-pointer rounded-xl border border-ink-10 px-4 py-2 font-thai text-sm text-ink"><input type="file" accept=".xlsx,.xls,.csv" onChange={uploadCgm} className="hidden" disabled={busy === "cgm"} />{busy === "cgm" ? "กำลังอัปโหลด…" : "📂 เลือกไฟล์ Ottai"}</label>
        {cgmMsg && <p className="mt-2 font-thai text-[12px] text-ink-60">{cgmMsg}</p>}
      </section>
    </>
  );
}
