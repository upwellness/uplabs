import { bcaByToken } from "@/lib/bca-reveal/store";
import { Reveal } from "./Reveal";

export const dynamic = "force-dynamic";

/** Public, token-gated result page for one BCA scan — the link a coach sends a new customer right after weighing. */
export default async function BcaRevealPage({ params }: { params: { token: string } }) {
  const scan = await bcaByToken(params.token);
  if (!scan) {
    return (
      <main className="grid min-h-[100dvh] place-items-center px-6 text-center">
        <div className="aurora-bg" aria-hidden="true"><div className="aurora-orb-3" /></div>
        <div className="liquid max-w-sm rounded-[22px] p-6">
          <div className="font-head text-[11px] font-bold uppercase tracking-[0.14em] text-wellness">UP Wellness</div>
          <h1 className="mt-2 font-head text-[20px] font-extrabold text-ink">ลิงก์นี้ใช้ไม่ได้แล้ว</h1>
          <p className="mt-2 font-thai text-[15px] leading-relaxed text-ink-60">ขอลิงก์ผลตรวจใหม่จากโค้ชที่ชั่งให้คุณได้เลยค่ะ</p>
        </div>
      </main>
    );
  }
  return <Reveal scan={scan} />;
}
