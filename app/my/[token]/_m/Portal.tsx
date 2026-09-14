"use client";

/**
 * The customer portal app shell (SPEC-Mobile-Portal.md §5): 4 tabs, hash router,
 * bottom sheets for L2 (metric) and L3 (AI explain). All data arrives once from the
 * server as `PortalData`; the only network calls are the food / cgm / explain / event
 * routes under /api/my/<token>.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Home as HomeIcon, HeartPulse, Camera, ClipboardCheck } from "lucide-react";
import type { PortalData } from "@/lib/health-design/portal-data";
import { parseHash, toHash, type NavState, type Page } from "@/lib/health-design/portal-nav";
import { HomeScreen } from "./Home";
import { HealthScreen } from "./Health";
import { LabsScreen, BcaScreen, CgmScreen, WearableScreen } from "./Sources";
import { FoodScreen } from "./Food";
import { PlanScreen } from "./Plan";
import { MeScreen } from "./Me";
import { MetricSheet } from "./MetricSheet";
import { ExplainSheet } from "./ExplainSheet";

export interface Nav { state: NavState; go: (hash: string) => void; back: () => void; token: string }

const TABS: { tab: NavState["tab"]; label: string; Icon: typeof HomeIcon; hash: string }[] = [
  { tab: "home", label: "หน้าแรก", Icon: HomeIcon, hash: "#home" },
  { tab: "health", label: "สุขภาพ", Icon: HeartPulse, hash: "#health" },
  { tab: "food", label: "อาหาร", Icon: Camera, hash: "#food" },
  { tab: "plan", label: "แผน", Icon: ClipboardCheck, hash: "#plan" },
];

const SCALE_KEY = "uplabs_portal_scale";

export function Portal({ data, token }: { data: PortalData; token: string }) {
  const [state, setState] = useState<NavState>(() => parseHash(typeof window === "undefined" ? "" : window.location.hash));
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const sync = () => setState(parseHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    try { const s = Number(localStorage.getItem(SCALE_KEY)); if (s === 1 || s === 1.12 || s === 1.25) setScale(s); } catch { /* ignore */ }
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const go = useCallback((hash: string) => { if (window.location.hash !== hash) window.location.hash = hash; else setState(parseHash(hash)); }, []);
  const back = useCallback(() => { if (window.history.length > 1) window.history.back(); else go("#home"); }, [go]);
  const setFont = (s: number) => { setScale(s); try { localStorage.setItem(SCALE_KEY, String(s)); } catch { /* ignore */ } };
  const nav: Nav = useMemo(() => ({ state, go, back, token }), [state, go, back, token]);

  // scroll to top when the page (not the sheet layer) changes
  useEffect(() => { window.scrollTo({ top: 0 }); }, [state.page, state.tab]);

  const page: Page = state.page;
  const sheetMetric = state.metric;
  const sheetAi = state.ai;

  return (
    <div className="relative min-h-[100dvh] pb-[92px]" style={{ fontSize: `${scale * 100}%` }}>
      <div className="aurora-bg" aria-hidden="true"><div className="aurora-orb-3" /></div>
      <main className="mx-auto w-full max-w-[430px] px-3.5 pt-3">
        {page === "home" && <HomeScreen data={data} nav={nav} />}
        {page === "health" && <HealthScreen data={data} nav={nav} />}
        {page === "src-labs" && <LabsScreen data={data} nav={nav} />}
        {page === "src-bca" && <BcaScreen data={data} nav={nav} />}
        {page === "src-cgm" && <CgmScreen data={data} nav={nav} />}
        {page === "src-wearable" && <WearableScreen data={data} nav={nav} />}
        {(page === "food" || page === "food-new") && <FoodScreen data={data} nav={nav} />}
        {page === "plan" && <PlanScreen data={data} nav={nav} />}
        {page === "me" && <MeScreen data={data} nav={nav} scale={scale} setScale={setFont} />}
      </main>

      {/* bottom tab bar — glass, active tab is a white pill */}
      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(10px,env(safe-area-inset-bottom))]" aria-label="เมนูหลัก">
        <div className="liquid-header mx-auto flex max-w-[430px] gap-1.5 rounded-[26px] border border-white/70 p-1.5">
          {TABS.map(({ tab, label, Icon, hash }) => {
            const on = state.tab === tab;
            return (
              <a key={tab} href={hash} onClick={(e) => { e.preventDefault(); go(hash); }} aria-current={on ? "page" : undefined}
                className={`flex min-h-[50px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] font-head text-[10.5px] font-bold transition ${on ? "bg-white/80 text-wellness shadow-[0_4px_14px_rgba(31,30,27,0.08)]" : "text-ink-60"}`}>
                <Icon className="h-5 w-5" strokeWidth={2} />{label}
              </a>
            );
          })}
        </div>
      </nav>

      {sheetMetric && <MetricSheet data={data} nav={nav} metric={sheetMetric} domain={state.domain} />}
      {sheetAi && <ExplainSheet data={data} nav={nav} target={state.page === "home" ? { kind: "overview" } : state.metric ? { kind: "metric", domain: state.domain, metric: state.metric } : state.domain ? { kind: "domain", domain: state.domain } : { kind: "overview" }} />}
    </div>
  );
}

/** Shared bottom-sheet chrome — dim backdrop, drag handle, close = browser back. */
export function Sheet({ children, onClose, label, z = 40 }: { children: React.ReactNode; onClose: () => void; label: string; z?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: z }} role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
      <div className="relative max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] border-t border-white/70 bg-white/90 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_40px_rgba(20,40,30,0.25)] backdrop-blur-xl">
        <div aria-hidden className="mx-auto mb-2.5 h-[5px] w-11 rounded-full bg-ink-10" />
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex min-h-[40px] items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {onBack && <button type="button" onClick={onBack} aria-label="ย้อนกลับ" className="grid h-9 w-9 place-items-center rounded-full bg-white/60 text-wellness"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>}
        <h1 className="font-head text-[20px] font-extrabold tracking-tight text-ink">{title}</h1>
      </div>
      {right}
    </div>
  );
}
