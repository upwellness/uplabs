import { customerByPortalToken, markPortalOpened } from "@/lib/health-design/portal";
import { loadPortalData } from "@/lib/health-design/portal-data";
import { Portal } from "./_m/Portal";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * /my/<token> — the customer's own page as a phone app (SPEC-Mobile-Portal.md).
 * Token-gated (no accounts yet); everything the screens need is loaded here once
 * and handed to the client shell. Nothing on this page diagnoses.
 */
export default async function PortalPage({ params }: { params: { token: string } }) {
  const c = await customerByPortalToken(params.token);
  if (!c) {
    return (
      <main className="grid min-h-[100dvh] place-items-center px-6 text-center">
        <div className="aurora-bg" aria-hidden="true"><div className="aurora-orb-3" /></div>
        <div className="liquid max-w-sm rounded-[22px] p-6">
          <div className="font-head text-[11px] font-bold uppercase tracking-[0.14em] text-rose">UP Health Design</div>
          <h1 className="mt-2 font-head text-[20px] font-extrabold text-ink">ลิงก์นี้ใช้ไม่ได้แล้ว</h1>
          <p className="mt-2 font-thai text-[15px] leading-relaxed text-ink-60">ลิงก์อาจถูกออกใหม่หรือพิมพ์ไม่ครบ — ขอลิงก์ใหม่จากโค้ชของคุณได้เลยค่ะ</p>
        </div>
      </main>
    );
  }
  await markPortalOpened(c.id);
  const data = await loadPortalData(c);
  return <Portal data={data} token={params.token} />;
}
