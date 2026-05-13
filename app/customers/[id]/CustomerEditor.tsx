"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Customer {
  id: string;
  name: string;
  gender: string | null;
  birth_year: number | null;
  height: number | null;
}

export function CustomerEditor({ customer }: { customer: Customer }) {
  const [edit, setEdit] = useState(false);
  const [name, setName]           = useState(customer.name);
  const [gender, setGender]       = useState(customer.gender ?? "");
  const [birthYear, setBirthYear] = useState(customer.birth_year?.toString() ?? "");
  const [height, setHeight]       = useState(customer.height?.toString() ?? "");
  const [saving, setSaving]       = useState(false);
  const router = useRouter();

  const initials = customer.name.replace(/^(คุณ|นาย|นาง|น\.ส\.)\s?/, "").slice(0, 2).toUpperCase();
  const age = customer.birth_year ? new Date().getFullYear() - customer.birth_year : null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, gender, birth_year: birthYear, height }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "save failed");
      setEdit(false);
      router.refresh();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (edit) {
    return (
      <div className="space-y-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Edit Customer</div>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-ink-10 bg-white px-4 py-3 font-head text-[24px] font-bold focus:border-rose focus:outline-none" />
        <div className="grid grid-cols-3 gap-3">
          <select value={gender} onChange={(e) => setGender(e.target.value)}
            className="rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none">
            <option value="">เลือกเพศ</option>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
          </select>
          <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="ปีเกิด"
            className="rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none" />
          <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="ส่วนสูง (cm)"
            className="rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none" />
        </div>
        <div className="flex gap-2">
          <Button variant="rose" size="sm" onClick={save} disabled={saving}>{saving ? "..." : "บันทึก"}</Button>
          <Button variant="ghost" size="sm" onClick={() => setEdit(false)}>ยกเลิก</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-rose text-[20px] font-bold text-white">
          {initials}
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Customer · {customer.id.slice(0, 8)}</div>
          <h1 className="mt-1 font-head text-[28px] font-extrabold tracking-tight text-ink">{customer.name}</h1>
          <div className="mt-2 flex items-center gap-3 font-thai text-sm text-ink-60">
            <span>{customer.gender === "male" ? "ชาย" : customer.gender === "female" ? "หญิง" : "—"}</span>
            {age && <><Dot /><span>{age} ปี (เกิด {customer.birth_year})</span></>}
            {customer.height && <><Dot /><span>{customer.height} cm</span></>}
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => setEdit(true)}>✏️ แก้ไข</Button>
    </div>
  );
}

function Dot() { return <span className="h-1 w-1 rounded-full bg-ink-20" />; }
