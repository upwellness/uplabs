"use client";

/**
 * UP Labs v2 · Plate Planner → คู่มือ portion (SPEC §7.9)
 * ───────────────────────────────────────────────────────
 * A customer-facing "how much is one serving" reference. Static content (no data fetch),
 * 4 macro tabs (โปรตีน / คาร์บ / ไขมันดี / ผัก) + a "จานสมดุล" plate-method summary.
 * Uses hand/utensil anchors so it's usable when eating out without a scale.
 * Macro colors unified with the rest of the app (carb=rose · protein=wellness · fat=amber).
 * Numbers are approximate cooked-portion values (USDA + กรมอนามัย, ±10–15%).
 */

import { useState } from "react";
import Link from "next/link";
import { Hand, Drumstick, Wheat, Droplets, Salad, Star, AlertTriangle, UtensilsCrossed } from "lucide-react";
import { Shell } from "../../_components/Shell";
import { Card, IconChip } from "@/lib/v2/ui";

type Food = { name: string; portion: string; val: string; star?: boolean; warn?: boolean };
type TabDef = {
  key: string;
  label: string;
  color: string;
  hand: string;
  handSub: string;
  unit: string;          // "" → render val as a pill (used by ผัก), else big number + unit
  foods: Food[];
  tip: string;
};

const VEG = "#4C7A2E";

const TABS: TabDef[] = [
  {
    key: "protein", label: "โปรตีน", color: "#396755",
    hand: "1 ฝ่ามือ = เนื้อสุก ~100 ก. = โปรตีน 25–30 ก.",
    handSub: "ผู้ชาย 1.5–2 ฝ่ามือ/มื้อ · ผู้หญิง 1 ฝ่ามือ/มื้อ · ไม่รวมนิ้ว หนาเท่าฝ่ามือ",
    unit: "ก.",
    foods: [
      { name: "อกไก่", portion: "1 ฝ่ามือ · ไม่เอาหนัง", val: "31", star: true },
      { name: "ปลา (นิล · กะพง · แซลมอน)", portion: "1 ฝ่ามือ", val: "26" },
      { name: "หมู / เนื้อ ไม่ติดมัน", portion: "1 ฝ่ามือ · สันใน/สันนอก", val: "27" },
      { name: "กุ้ง", portion: "100 ก. (~6–8 ตัวกลาง)", val: "24" },
      { name: "ไข่ต้ม", portion: "2 ฟอง · จำง่าย 1 ฟอง ≈ 7 ก.", val: "13" },
      { name: "ทูน่ากระป๋อง (ในน้ำแร่)", portion: "1 กระป๋อง สะเด็ดน้ำ", val: "22" },
      { name: "กรีกโยเกิร์ต", portion: "1 ถ้วย (~120 ก.)", val: "12" },
      { name: "เต้าหู้ / ถั่วแระ edamame", portion: "100 ก. / 1 ถ้วย", val: "13" },
    ],
    tip: "เล็ง ~30 ก./มื้อ — ได้ leucine พอกระตุ้นการสร้างกล้ามเนื้อ (แนวทาง Dr. Lyon)",
  },
  {
    key: "carb", label: "คาร์บ", color: "#8C4C4C",
    hand: "1 กำปั้น ≈ 1 ทัพพี",
    handSub: "คุม ~1 กำปั้น/มื้อ · กินผัก-โปรตีนก่อนคาร์บ ช่วยลดน้ำตาลพุ่ง",
    unit: "ก.",
    foods: [
      { name: "ข้าวกล้อง", portion: "1 ทัพพี (~60 ก.) · ไฟเบอร์สูง", val: "18", star: true },
      { name: "มันหวาน / ฟักทอง", portion: "1 กำปั้น · ไฟเบอร์ + วิตามิน", val: "22", star: true },
      { name: "โอ๊ต", portion: "½ ถ้วยแห้ง · เบต้ากลูแคน", val: "27", star: true },
      { name: "ข้าวสวย", portion: "1 ทัพพี", val: "18" },
      { name: "ขนมปังโฮลวีท", portion: "1 แผ่น", val: "13" },
      { name: "เส้นก๋วยเตี๋ยว", portion: "1 ทัพพี (สุก)", val: "20" },
      { name: "ผลไม้", portion: "1 กำปั้น / จานเล็ก", val: "15" },
      { name: "ข้าวเหนียว", portion: "1 ปั้น (~60 ก.) · สูง", val: "38", warn: true },
    ],
    tip: "เลือกคาร์บเชิงซ้อน + ไฟเบอร์ (ข้าวกล้อง · มันหวาน · โอ๊ต) — อิ่มนาน น้ำตาลนิ่งกว่า",
  },
  {
    key: "fat", label: "ไขมันดี", color: "#C47A2A",
    hand: "1 หัวแม่มือ ≈ 1 ช้อนโต๊ะ",
    handSub: "คุม 1–2 หัวแม่มือ/มื้อ · แคลสูง (9 kcal/ก.) แต่จำเป็นต่อฮอร์โมน",
    unit: "ก.",
    foods: [
      { name: "อะโวคาโด", portion: "½ ลูก · ไฟเบอร์ + ไขมันดี", val: "15", star: true },
      { name: "เมล็ดเจีย / แฟลกซ์", portion: "1 ช้อนโต๊ะ · โอเมกา-3", val: "5", star: true },
      { name: "แซลมอน / ปลาทู", portion: "1 ฝ่ามือ · โอเมกา-3", val: "10", star: true },
      { name: "ถั่ว / อัลมอนด์", portion: "1 กำมือ (~30 ก.)", val: "14" },
      { name: "น้ำมันมะกอก / รำข้าว", portion: "1 ช้อนโต๊ะ", val: "14" },
      { name: "เนยถั่ว (ไม่เติมน้ำตาล)", portion: "1 ช้อนโต๊ะ", val: "8" },
      { name: "ไข่แดง", portion: "1 ฟอง · + โคลีน", val: "5" },
    ],
    tip: "เลี่ยงไขมันทรานส์ — ของทอดซ้ำ · เบเกอรี่ · ครีมเทียม · มาการีน",
  },
  {
    key: "veg", label: "ผัก", color: VEG,
    hand: "2 กำปั้น / ครึ่งจาน ทุกมื้อ",
    handSub: "กินได้เยอะ · หลากสี · เป้าหมาย ~400 ก./วัน (WHO ≥ 5 หน่วย)",
    unit: "",
    foods: [
      { name: "ผักใบเขียว (คะน้า · ผักบุ้ง · บรอกโคลี)", portion: "ครึ่งจาน", val: "ไม่อั้น", star: true },
      { name: "แตงกวา · มะเขือเทศ · ผักสลัด", portion: "ตามใจ", val: "แคลต่ำ" },
      { name: "เห็ดทุกชนิด", portion: "1 จาน", val: "ไฟเบอร์" },
      { name: "ถั่วฝักยาว · ถั่วแขก", portion: "ครึ่งจาน", val: "ไฟเบอร์" },
      { name: "ฟักทอง · แครอท · ข้าวโพด", portion: "คุมหน่อย", val: "นับเป็นคาร์บ", warn: true },
    ],
    tip: "หลากสี = สารต้านอนุมูลอิสระ · ผักแป้งสูง (ฟักทอง/ข้าวโพด/มันฝรั่ง) นับรวมโควตาคาร์บ",
  },
];

const TAB_ICON: Record<string, typeof Hand> = { protein: Drumstick, carb: Wheat, fat: Droplets, veg: Salad };

function tint(hex: string, alpha = "14") {
  return `${hex}${alpha}`;
}

export default function PortionGuidePage() {
  const [active, setActive] = useState("protein");
  const tab = TABS.find((t) => t.key === active)!;

  return (
    <Shell
      breadcrumb={[
        { label: "หน้าแรก", href: "/v2" },
        { label: "Plate Planner", href: "/v2/plate-planner" },
        { label: "คู่มือ portion" },
      ]}
    >
      {/* Header */}
      <div className="mb-5 flex items-start gap-3">
        <IconChip icon={Hand} tone="wellness" size={20} className="mt-0.5 h-10 w-10" />
        <div>
          <h1 className="font-head text-[23px] font-extrabold tracking-tight text-ink">
            คู่มือ portion <span className="font-semibold text-ink-40">· เลือกอาหารด้วยมือ</span>
          </h1>
          <p className="mt-1 max-w-2xl font-thai text-[13px] leading-[1.6] text-ink-60">
            วัดด้วยมือ ไม่ต้องพกตาชั่ง — เลือกง่าย จำง่าย ใช้ได้เวลากินนอกบ้าน
          </p>
        </div>
      </div>

      {/* จานสมดุล — plate method */}
      <Card className="mb-5 p-4 lg:p-5">
        <div className="mb-3 flex items-center gap-2">
          <UtensilsCrossed size={16} className="text-wellness" aria-hidden />
          <span className="font-head text-[14px] font-extrabold text-ink">จานสมดุล 1 มื้อ</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { c: VEG, big: "ครึ่งจาน", s: "ผัก" },
            { c: "#396755", big: "¼ จาน", s: "โปรตีน · 1 ฝ่ามือ" },
            { c: "#8C4C4C", big: "¼ จาน", s: "คาร์บเชิงซ้อน · 1 กำปั้น" },
            { c: "#C47A2A", big: "+ นิดหน่อย", s: "ไขมันดี · 1 หัวแม่มือ" },
          ].map((x) => (
            <div key={x.s} className="rounded-xl px-3 py-2.5" style={{ background: tint(x.c) }}>
              <div className="font-head text-[15px] font-extrabold" style={{ color: x.c }}>{x.big}</div>
              <div className="mt-0.5 font-thai text-[12px] leading-snug text-ink-60">{x.s}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div role="tablist" aria-label="เลือกหมวดอาหาร" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = TAB_ICON[t.key];
          const on = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 font-head text-[14px] font-bold transition-colors"
              style={
                on
                  ? { background: t.color, borderColor: t.color, color: "#fff" }
                  : { background: "#fff", borderColor: "var(--ink-10, #DDD9DF)", color: "#5C5660" }
              }
            >
              <Icon size={16} aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div role="tabpanel" aria-label={tab.label}>
        {/* Hand anchor banner */}
        <div className="rounded-2xl px-4 py-3.5" style={{ background: tint(tab.color) }}>
          <div className="flex items-center gap-2">
            <Hand size={17} style={{ color: tab.color }} aria-hidden />
            <span className="font-head text-[14px] font-extrabold" style={{ color: tab.color }}>{tab.hand}</span>
          </div>
          <p className="mt-1 font-thai text-[12px] leading-[1.55]" style={{ color: tab.color, opacity: 0.85 }}>
            {tab.handSub}
          </p>
        </div>

        {/* Food rows */}
        <Card className="mt-3 overflow-hidden p-0">
          {tab.foods.map((f, i) => (
            <div
              key={f.name}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderTop: i === 0 ? "none" : "0.5px solid #DDD9DF" }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-thai text-[15px] font-medium text-ink">
                  <span className="truncate">{f.name}</span>
                  {f.star && <Star size={13} className="shrink-0 fill-current" style={{ color: tab.color }} aria-label="แนะนำ" />}
                  {f.warn && <AlertTriangle size={13} className="shrink-0" style={{ color: "#C47A2A" }} aria-label="กินแต่พอดี" />}
                </div>
                <div className="mt-0.5 font-thai text-[12px] leading-snug text-ink-60">{f.portion}</div>
              </div>
              <div className="shrink-0 text-right">
                {tab.unit ? (
                  <>
                    <span className="font-head text-[20px] font-extrabold" style={{ color: tab.color }}>{f.val}</span>
                    <span className="font-thai text-[12px] text-ink-60"> {tab.unit}</span>
                  </>
                ) : (
                  <span
                    className="rounded-full px-2.5 py-1 font-head text-[12px] font-bold"
                    style={{ background: tint(tab.color, "1f"), color: tab.color }}
                  >
                    {f.val}
                  </span>
                )}
              </div>
            </div>
          ))}
        </Card>

        {/* Tip */}
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface px-3.5 py-2.5">
          <Star size={14} className="mt-0.5 shrink-0" style={{ color: tab.color }} aria-hidden />
          <p className="font-thai text-[12.5px] leading-[1.55] text-ink-80">{tab.tip}</p>
        </div>
      </div>

      {/* Footer note + back */}
      <p className="mt-5 font-thai text-[11px] leading-relaxed text-ink-40">
        ค่าประมาณ (เนื้อสุก · ต่อ portion) · อ้างอิง USDA FoodData Central + กองโภชนาการ กรมอนามัย · จริงต่างได้ ±10–15%
      </p>
      <Link
        href="/v2/plate-planner"
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ink-10 bg-white px-4 py-2 font-head text-[13px] font-bold text-ink-60 transition-colors hover:bg-surface"
      >
        <UtensilsCrossed size={15} aria-hidden /> กลับไปวางแผนมื้ออาหาร
      </Link>
    </Shell>
  );
}
