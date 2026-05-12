export const dynamic = "force-dynamic";

export default function HealthPage() {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasSite = !!process.env.NEXT_PUBLIC_SITE_URL;

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-10">
      <div className="w-full max-w-lg rounded-3xl border border-ink-10 bg-white p-10">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose">Setup Required</div>
        <h1 className="mt-2 font-head text-2xl font-extrabold tracking-tight text-ink">UPLABS — Configuration Check</h1>
        <p className="mt-3 font-thai text-sm text-ink-60">
          ระบบยังไม่พร้อมใช้งานเพราะ env vars บางตัวยังไม่ได้ตั้ง
          ตั้งค่าใน Vercel → Settings → Environment Variables (Production scope) แล้ว redeploy
        </p>

        <ul className="mt-6 space-y-2 text-sm">
          <Row ok={hasUrl}     name="NEXT_PUBLIC_SUPABASE_URL" />
          <Row ok={hasAnon}    name="NEXT_PUBLIC_SUPABASE_ANON_KEY" />
          <Row ok={hasService} name="SUPABASE_SERVICE_ROLE_KEY" required={false} hint="needed for /admin only" />
          <Row ok={hasSite}    name="NEXT_PUBLIC_SITE_URL" required={false} hint="for password-reset email link" />
        </ul>

        <div className="mt-6 rounded-xl bg-ink p-4 font-mono text-[12px] text-white/80 leading-relaxed">
          NEXT_PUBLIC_SUPABASE_URL=https://&lt;project&gt;.supabase.co<br />
          NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...<br />
          SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...<br />
          NEXT_PUBLIC_SITE_URL=https://uplabs-sys.vercel.app
        </div>
      </div>
    </main>
  );
}

function Row({ ok, name, required = true, hint }: { ok: boolean; name: string; required?: boolean; hint?: string }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-ink-10 px-4 py-3">
      <div>
        <span className="font-mono text-[13px] text-ink">{name}</span>
        {hint && <span className="ml-2 font-thai text-[11px] text-ink-40">— {hint}</span>}
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
        ok
          ? "bg-status-bg-optimal text-status-optimal"
          : required ? "bg-status-bg-danger text-status-danger" : "bg-status-bg-caution text-status-caution"
      }`}>
        {ok ? "set" : required ? "missing" : "optional"}
      </span>
    </li>
  );
}
