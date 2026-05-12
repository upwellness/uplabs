"use client";

import type { Customer } from "@/lib/types";

interface CustomerPickerProps {
  current: Customer;
  onChange: (c: Customer) => void;
}

export function CustomerPicker({ current }: CustomerPickerProps) {
  return (
    <button
      type="button"
      className="flex items-center gap-2.5 rounded-full border border-ink-10 bg-white px-4 py-2 transition-all hover:border-ink-20"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose text-[11px] font-bold text-white">
        {current.name.slice(0, 2)}
      </div>
      <div className="text-left">
        <div className="font-thai text-sm font-semibold leading-none text-ink">{current.name}</div>
        <div className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-ink-40">
          {current.gender === "male" ? "M" : "F"} · {current.birth_year ? new Date().getFullYear() - current.birth_year : "—"}y · {current.height}cm
        </div>
      </div>
      <span className="ml-1 text-ink-40">▾</span>
    </button>
  );
}
