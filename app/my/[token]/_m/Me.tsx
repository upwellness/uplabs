"use client";

/** S6 · ฉัน — who this link belongs to, the coach, text size, what the system keeps. */
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import type { PortalData } from "@/lib/health-design/portal-data";
import { Card, Sub, Row } from "./ui";
import { TopBar, type Nav } from "./Portal";

export function MeScreen({ data, nav, scale, setScale }: { data: PortalData; nav: Nav; scale: number; setScale: (s: number) => void }) {
  const [showHome, setShowHome] = useState(false);
  const [showData, setShowData] = useState(false);
  const c = data.customer;
  const isIos = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
  return (
    <div className="flex flex-col gap-2.5">
      <TopBar title="ฉัน" onBack={nav.back} />
      <Card className="p-4"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-wellness/10 font-head text-[18px] font-extrabold text-wellness">{c.initial}</span><div><div className="font-head text-[16px] font-bold text-ink">คุณ{c.first_name}</div><Sub>{[c.gender === "male" ? "ชาย" : c.gender === "female" ? "หญิง" : null, c.age != null ? `${c.age} ปี` : null, c.height_cm ? `${c.height_cm} ซม.` : null].filter(Boolean).join(" · ") || "—"}</Sub></div></div></Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div><div className="font-head text-[15px] font-bold text-ink">โค้ชของคุณ</div><Sub>{c.coach_name ?? "UP Wellness"}{c.has_line_group ? " · คุยกันในกลุ่ม LINE ของคุณ" : ""}</Sub></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-wellness px-3.5 py-2 font-head text-[13px] font-bold text-white"><MessageCircle className="h-4 w-4" />LINE</span>
        </div>
        <Sub className="mt-2 text-[12.5px]">{c.has_line_group ? "ถามได้ในกลุ่ม LINE ที่โค้ชสร้างให้ — โค้ชเห็นหน้านี้เหมือนคุณ บอกได้เลยว่าอยากคุยเรื่องค่าไหน" : "ทักโค้ชทาง LINE ที่คุยกันอยู่ — โค้ชเห็นหน้านี้เหมือนคุณ บอกได้เลยว่าอยากคุยเรื่องค่าไหน"}</Sub>
      </Card>

      <Card className="border-rose/20 bg-rose/10 p-4">
        <div className="font-head text-[15px] font-bold text-rose-deep">ลิงก์นี้เป็นของคุณคนเดียว</div>
        <p className="mt-1 font-thai text-[13.5px] leading-relaxed text-ink-80">ใครมีลิงก์ก็เปิดได้ — อย่าส่งต่อ ถ้าหลุดบอกโค้ชให้ออกลิงก์ใหม่ ลิงก์เดิมจะใช้ไม่ได้ทันที</p>
      </Card>

      <Card className="px-4 py-1">
        <Row first left="ขนาดตัวอักษร" right={<span className="flex gap-1">{[[1, "ปกติ"], [1.12, "ใหญ่"], [1.25, "ใหญ่มาก"]].map(([s, l]) => <button key={String(s)} type="button" onClick={() => setScale(Number(s))} className={`rounded-full px-2.5 py-1 font-head text-[12px] font-bold ${scale === s ? "bg-wellness text-white" : "bg-ink-5 text-ink-60"}`}>{l}</button>)}</span>} />
        <Row expanded={showHome} onClick={() => setShowHome((s) => !s)} left="เพิ่มลงหน้าจอหลัก" />
        {showHome && <Sub className="pb-3 leading-relaxed">{isIos ? "Safari → ปุ่มแชร์ (สี่เหลี่ยมมีลูกศร) → เลื่อนหา “เพิ่มไปยังหน้าจอโฮม” → เพิ่ม" : "Chrome → เมนู ⋮ มุมขวาบน → “เพิ่มไปยังหน้าจอหลัก” หรือ “ติดตั้งแอป” → เพิ่ม"} — จะได้ไอคอนเปิดหน้านี้ได้ทันทีโดยไม่ต้องหาลิงก์</Sub>}
        <Row expanded={showData} onClick={() => setShowData((s) => !s)} left="ระบบเก็บอะไรของฉัน" />
        {showData && <Sub className="pb-3 leading-relaxed">ผลเลือด · ค่าจากเครื่อง BCA · ค่าจากเซ็นเซอร์น้ำตาล · ค่าจากนาฬิกาที่คุณเชื่อม · รูปและข้อความอาหารที่คุณบันทึก · ผลประเมินและแผน · การเปิดหน้านี้และเรื่องที่คุณกดให้ AI อธิบาย — โค้ชและทีม UP Wellness เห็น · ไม่ส่งต่อให้บุคคลอื่น · ขอให้ลบได้ผ่านโค้ช</Sub>}
      </Card>
      <Sub className="px-2 text-center text-[11.5px]">UP Wellness · Health Design · หน้านี้ใช้เพื่อการดูแลเชิงป้องกัน ไม่ใช่การวินิจฉัย</Sub>
    </div>
  );
}
