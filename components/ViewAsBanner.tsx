"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { stopViewAs } from "@/lib/auth/view-as";

export function ViewAsBanner({ label, adminLabel }: { label: string; adminLabel: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const exit = () => start(async () => {
    await stopViewAs();
    router.push("/v2/admin/users");
    router.refresh();
  });

  return (
    <div className="sticky top-0 z-[999] flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-center text-[13px] font-semibold text-ink">
      <span>
        👁 View-As (ดูอย่างเดียว) — กำลังดูมุมมองของ <strong>{label}</strong> · โดย admin {adminLabel}
      </span>
      <button
        onClick={exit}
        disabled={pending}
        className="rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
      >
        {pending ? "กำลังออก..." : "ออกจากโหมดนี้"}
      </button>
    </div>
  );
}
