import React, { useEffect, useRef, useState } from "react";
import { HEARING_FREQS, hearingAge, fmt } from "../logic.js";
import { ToolShell, Card, Tile, StatusPill, PrimaryButton, Disclaimer, BigValue } from "../ui.jsx";

/* WebAudio tone player — a single oscillator + gain, ramped to avoid clicks */
function useTone() {
  const ctxRef = useRef(null);
  const nodeRef = useRef(null);
  const stop = () => {
    if (nodeRef.current) {
      const { osc, gain, ctx } = nodeRef.current;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.06);
      osc.stop(t + 0.08);
      nodeRef.current = null;
    }
  };
  const play = (hz, vol = 0.16) => {
    stop();
    let ctx = ctxRef.current;
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); ctxRef.current = ctx; }
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(vol, t + 0.05);
    osc.start();
    nodeRef.current = { osc, gain, ctx };
  };
  useEffect(() => () => stop(), []);
  return { play, stop };
}

const kHz = (hz) => (hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1);

export default function Hearing({ onBack }) {
  const { play, stop } = useTone();
  const [stage, setStage] = useState("intro"); /* intro | test | done */
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [maxHeard, setMaxHeard] = useState(null);
  const [firstFail, setFirstFail] = useState(false);

  const freq = HEARING_FREQS[idx];

  const begin = () => { setStage("test"); setIdx(0); setMaxHeard(null); setFirstFail(false); };

  const toggle = () => {
    if (playing) { stop(); setPlaying(false); }
    else { play(freq); setPlaying(true); }
  };

  const answer = (heard) => {
    stop(); setPlaying(false);
    if (heard) setMaxHeard(freq);
    const next = idx + 1;
    /* stop early after the first "ไม่ได้ยิน" once we're past 8kHz, to keep it quick */
    if (next >= HEARING_FREQS.length) { setStage("done"); return; }
    if (!heard) {
      if (firstFail) { setStage("done"); return; }
      setFirstFail(true);
    }
    setIdx(next);
  };

  const result = hearingAge(maxHeard);

  return (
    <ToolShell onBack={() => { stop(); onBack(); }} kicker="เครื่องมือ 2" title="ทดสอบอายุหู"
      accentIcon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 3-2 4-3 6s-1 4-4 4a3 3 0 0 1-3-3" /><path d="M9 8a3 3 0 0 1 5 2" /></svg>}>

      {stage === "intro" && (
        <Card>
          <p className="text-[15px] leading-relaxed text-ink2">
            หูของเราได้ยินเสียงแหลม (ความถี่สูง) ได้ลดลงตามอายุอย่างเป็นธรรมชาติ
            แบบทดสอบนี้จะเล่นเสียงจากความถี่ต่ำไปสูงเรื่อย ๆ แล้วให้คุณบอกว่ายัง “ได้ยิน” อยู่ไหม
            ความถี่สูงสุดที่คุณได้ยิน จะบอก “อายุหู” โดยประมาณ
          </p>
          <div className="mt-4 grid gap-2">
            {[
              ["🎧", "ใส่หูฟัง", "ลำโพงมือถือ/โน้ตบุ๊กมักเล่นเสียงแหลมสูงไม่ครบ ผลจะเพี้ยน"],
              ["🔉", "เปิดเสียงระดับกลาง", "อย่าเปิดดังเกินไป เริ่มจากเบา ๆ แล้วค่อยเพิ่ม"],
              ["🤫", "หาที่เงียบ ๆ", "เสียงรบกวนรอบตัวทำให้ได้ยินเสียงทดสอบยากขึ้น"],
            ].map(([e, t, d]) => (
              <div key={t} className="flex gap-3 rounded-xl bg-surface2 px-4 py-3">
                <span className="text-xl" aria-hidden="true">{e}</span>
                <span><span className="block text-[14.5px] font-semibold text-ink">{t}</span><span className="block text-[13px] text-ink2">{d}</span></span>
              </div>
            ))}
          </div>
          <PrimaryButton onClick={begin} className="mt-5 w-full">เริ่มทดสอบ</PrimaryButton>
        </Card>
      )}

      {stage === "test" && (
        <Card>
          <div className="mb-4 flex items-center justify-between text-[13px] text-mut">
            <span className="font-semibold uppercase tracking-wide">ขั้นที่ {idx + 1} / {HEARING_FREQS.length}</span>
            <span className="tabular-nums">{kHz(freq)} kHz</span>
          </div>
          <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full transition-all" style={{ width: `${((idx + 1) / HEARING_FREQS.length) * 100}%`, background: "var(--accent)" }} />
          </div>

          <div className="my-7 flex flex-col items-center">
            <button type="button" onClick={toggle}
              className="relative grid h-40 w-40 place-items-center rounded-full transition-transform active:scale-95"
              style={{ background: playing ? "var(--accent)" : "var(--accent-soft)", color: playing ? "var(--on-accent)" : "var(--accent-strong)" }}
              aria-label={playing ? "หยุดเสียง" : "เล่นเสียง"}>
              {playing && <span className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 0 var(--accent)", animation: "ring 1.4s ease-out infinite" }} aria-hidden="true" />}
              {playing
                ? <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                : <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
            </button>
            <p className="mt-4 text-[14px] text-ink2">{playing ? "กำลังเล่นเสียง… ตั้งใจฟัง" : "แตะเพื่อเล่นเสียงความถี่นี้"}</p>
          </div>

          <p className="mb-2 text-center text-[15px] font-semibold text-ink">คุณได้ยินเสียงนี้ไหม?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => answer(true)}
              className="rounded-xl border-2 border-line px-4 py-3.5 font-display text-[16px] font-semibold text-ink transition-colors hover:border-accent hover:bg-accent-soft">
              ได้ยิน 👂
            </button>
            <button type="button" onClick={() => answer(false)}
              className="rounded-xl border-2 border-line px-4 py-3.5 font-display text-[16px] font-semibold text-ink2 transition-colors hover:border-mut">
              ไม่ได้ยิน
            </button>
          </div>
        </Card>
      )}

      {stage === "done" && (
        <div>
          <Tile eyebrow="อายุหูโดยประมาณ" status={result.status} statusText={maxHeard ? "" : "ลองใหม่"} delay={0} wide>
            {maxHeard ? (
              <>
                <div className="font-display text-[32px] font-bold leading-tight text-ink">{result.age}</div>
                <p className="mt-1 text-[14px] text-ink2">ได้ยินสูงสุดที่ <span className="font-semibold tabular-nums">{kHz(maxHeard)} kHz</span></p>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink2">{result.note}</p>
              </>
            ) : (
              <p className="text-[14px] text-ink2">ดูเหมือนจะไม่ได้ยินตั้งแต่ความถี่แรก — ลองเพิ่มระดับเสียง ใส่หูฟัง แล้วทดสอบใหม่อีกครั้ง</p>
            )}
          </Tile>
          <div className="mt-3 flex gap-2">
            <PrimaryButton onClick={() => { setStage("intro"); }} className="flex-1">ทดสอบใหม่</PrimaryButton>
          </div>
          <Disclaimer>แบบทดสอบนี้ทำเพื่อความสนุกและสร้างความตระหนัก ไม่ใช่การตรวจการได้ยินทางการแพทย์ — ผลขึ้นกับหูฟัง ระดับเสียง และสภาพแวดล้อม หากสงสัยปัญหาการได้ยิน ควรพบแพทย์หู คอ จมูก หรือนักแก้ไขการได้ยิน</Disclaimer>
        </div>
      )}
    </ToolShell>
  );
}
