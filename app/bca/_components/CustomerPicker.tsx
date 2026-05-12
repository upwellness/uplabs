"use client";

import { useEffect, useRef, useState } from "react";
import type { Customer } from "@/lib/types";

interface CustomerPickerProps {
  current: Customer | null;
  onChange: (c: Customer) => void;
}

export function CustomerPicker({ current, onChange }: CustomerPickerProps) {
  const [open, setOpen]           = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch on first open
  const handleOpen = async () => {
    setOpen((v) => !v);
    if (customers.length > 0) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/customers");
      const json = await res.json();
      setCustomers(json.customers ?? []);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search
    ? customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : customers;

  const initials = (name: string) => name.replace(/คุณ\s?|นาย\s?|นาง\s?|น\.ส\.\s?/g, "").slice(0, 2);

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
                {current.gender === "male" ? "M" : "F"} · {current.birth_year ? new Date().getFullYear() - current.birth_year : "—"}y · {current.height}cm
              </div>
            </>
          ) : (
            <div className="font-thai text-sm font-semibold text-ink-40">เลือกลูกค้า</div>
          )}
        </div>
        <span className={`ml-1 text-ink-40 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-xl">
          <div className="border-b border-ink-5 p-3">
            <input
              autoFocus
              type="text"
              placeholder="ค้นหาชื่อ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg bg-surface px-3 py-2 text-sm outline-none placeholder:text-ink-30"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center font-mono text-xs text-ink-40">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center font-mono text-xs text-ink-40">ไม่พบลูกค้า</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${current?.id === c.id ? "bg-rose-ultra" : ""}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose text-[11px] font-bold text-white">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-thai text-sm font-semibold text-ink">{c.name}</div>
                    <div className="font-mono text-[10px] text-ink-40">
                      {c.gender === "male" ? "ชาย" : "หญิง"} · {c.birth_year ? new Date().getFullYear() - c.birth_year : "—"}ปี · {c.height ?? "—"}cm
                    </div>
                  </div>
                  {current?.id === c.id && <span className="ml-auto text-rose">✓</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
