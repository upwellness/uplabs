"use client";
import dynamic from "next/dynamic";

/**
 * Client-only loader for the Plate Planner.
 * PlatePlanner ใช้ browser API เยอะ (localStorage / IndexedDB / matchMedia / crypto.subtle)
 * → โหลดแบบ ssr:false ตัด server-render ทิ้ง (กัน SSR crash บน serverless · เป็น pattern ที่ถูกต้องของ component ฝั่ง client ล้วน)
 */
const PlatePlanner = dynamic(() => import("./PlatePlanner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center px-6 py-20 font-thai text-sm text-ink-40">
      กำลังโหลด Plate Planner…
    </div>
  ),
});

export default function PlatePlannerClient(props: { initialW?: number; initialH?: number }) {
  return <PlatePlanner {...props} />;
}
