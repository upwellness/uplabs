"use client";

import { useEffect, useRef, useState } from "react";
import type { CGMProfile } from "@/lib/types-cgm";

interface ProfilePickerProps {
  current: CGMProfile | null;
  onChange: (p: CGMProfile) => void;
}

export function ProfilePicker({ current, onChange }: ProfilePickerProps) {
  const [open,     setOpen]     = useState(false);
  const [profiles, setProfiles] = useState<CGMProfile[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = async () => {
    setOpen((v) => !v);
    if (profiles.length > 0) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/cgm/profiles");
      const json = await res.json();
      setProfiles(json.profiles ?? []);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search
    ? profiles.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : profiles;

  const initials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2.5 rounded-full border border-ink-10 bg-white px-4 py-2 transition-all hover:border-ink-20 active:scale-[0.98]"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose text-[11px] font-bold text-white">
          {current ? initials(current.name) : "—"}
        </div>
        <div className="text-left">
          {current ? (
            <>
              <div className="font-thai text-sm font-semibold leading-none text-ink">{current.name}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-40">
                {current.readings_count.toLocaleString()} readings
              </div>
            </>
          ) : (
            <div className="font-thai text-sm font-semibold text-ink-40">เลือก Profile</div>
          )}
        </div>
        <span className={`ml-1 text-ink-40 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-xl">
          <div className="border-b border-ink-5 p-3">
            <input
              autoFocus
              type="text"
              placeholder="ค้นหา profile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg bg-surface px-3 py-2 text-sm outline-none placeholder:text-ink-30"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center font-mono text-xs text-ink-40">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center font-mono text-xs text-ink-40">ไม่พบ profile</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => { onChange(p); setOpen(false); setSearch(""); }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${current?.name === p.name ? "bg-rose-ultra" : ""}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose text-[11px] font-bold text-white">
                    {initials(p.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-thai text-sm font-semibold text-ink">{p.name}</div>
                    <div className="font-mono text-[10px] text-ink-40">
                      {p.readings_count.toLocaleString()} readings · last {p.last_reading ? new Date(p.last_reading).toLocaleDateString("th-TH") : "—"}
                    </div>
                  </div>
                  {current?.name === p.name && <span className="text-rose">✓</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
