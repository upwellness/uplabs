"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface CgmLinkManagerProps {
  customerId: string;
  linked:     string[];
  allProfiles: string[];
}

export function CgmLinkManager({ customerId, linked, allProfiles }: CgmLinkManagerProps) {
  const [current, setCurrent] = useState<string[]>(linked);
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const router = useRouter();

  const available = useMemo(
    () => allProfiles.filter((p) => !current.includes(p) && p.toLowerCase().includes(search.toLowerCase())),
    [allProfiles, current, search],
  );

  const add = (p: string) => setCurrent((c) => c.includes(p) ? c : [...c, p]);
  const remove = (p: string) => setCurrent((c) => c.filter((x) => x !== p));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/pulse/customers/${customerId}/cgm-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_names: current }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "save failed");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-10 bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-40">CGM Profile Links</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {current.length === 0 ? (
              <span className="font-thai text-[12px] text-ink-40">ยังไม่ได้ link CGM profile</span>
            ) : (
              current.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-rose-ultra px-2.5 py-0.5 font-mono text-[11px] text-rose">
                  {p}
                </span>
              ))
            )}
          </div>
        </div>
        <Button size="sm" variant={open ? "ghost" : "outline"} onClick={() => setOpen(!open)}>
          {open ? "ปิด" : current.length > 0 ? "✏️ แก้ไข" : "+ Link CGM"}
        </Button>
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-ink-10 bg-white p-4">
          {/* Currently linked */}
          {current.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-40">Linked profiles</div>
              <div className="flex flex-wrap gap-1.5">
                {current.map((p) => (
                  <button
                    key={p}
                    onClick={() => remove(p)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-ultra px-3 py-1 font-mono text-[11px] text-rose hover:bg-rose hover:text-white"
                  >
                    {p} <span>✕</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search + add */}
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-40">
            เพิ่ม CGM profile ({allProfiles.length} ทั้งหมดในระบบ)
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา profile_name..."
            className="w-full rounded-lg border border-ink-10 bg-surface px-3 py-2 text-sm outline-none focus:border-rose"
          />
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-ink-5 bg-surface">
            {available.length === 0 ? (
              <div className="px-4 py-6 text-center font-thai text-xs text-ink-40">
                {search ? "ไม่พบ" : "ไม่มี profile ใหม่ที่จะ link"}
              </div>
            ) : (
              available.slice(0, 50).map((p) => (
                <button
                  key={p}
                  onClick={() => { add(p); setSearch(""); }}
                  className="block w-full px-4 py-2 text-left font-mono text-[12px] hover:bg-rose-ultra"
                >
                  + {p}
                </button>
              ))
            )}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setCurrent(linked); setOpen(false); }}>
              ยกเลิก
            </Button>
            <Button size="sm" variant="rose" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "บันทึก"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
