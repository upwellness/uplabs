/**
 * UP Wellness Ops · App Registry — single source of truth.
 * Used by upmenu, admin (to grant per-user access), and BFF.
 */
import type { Role } from "./auth/roles";

export type AppAudience = "customer" | "business" | "internal" | "content";

export interface AppMeta {
  slug: string;
  name: string;
  description: string;
  icon: string;
  audience: AppAudience;
  href: string;
  status: "live" | "beta" | "soon";
  /** Roles allowed by default. Per-user grants can override. */
  allowedRoles: Role[];
}

export const APPS: AppMeta[] = [
  // ── Customer (lead-facing · ส่งให้ prospect ได้) ──
  { slug: "healthcheck",  name: "Health Check",    description: "ประเมินสุขภาพ + Lead Capture · ส่งลิงก์ให้คน · เก็บ lead อัตโนมัติ",  icon: "🏥", audience: "customer", href: "/healthcheck",  status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "metaflexquiz", name: "MetaFlex Quiz",   description: "วัด Metabolic Flexibility · Lead capture · share ลิงก์ให้คน",  icon: "🔥", audience: "customer", href: "/healthcheck?quiz=metaflex", status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "cards",        name: "Nutrilite Cards", description: "45 SKUs · ดู spec + target + opener · กด ⬇ SAVE ดาวน์โหลดการ์ดเป็นรูปส่งลูกค้าทาง LINE ได้ทันที", icon: "📇", audience: "customer", href: "https://personal-eight-taupe.vercel.app/nutrilite_marketing_cards.html", status: "live", allowedRoles: ["abo", "admin"] },

  // ── Business ──
  { slug: "customers",    name: "Customer Profiles",description: "จัดการลูกค้า · link BCA + CGM + Wearable · master profile",    icon: "👥", audience: "business", href: "/customers",   status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "bca",          name: "BCA Tracker",     description: "ติดตาม Body Composition ของลูกค้าแบบต่อเนื่อง",     icon: "📊", audience: "business", href: "/bca",          status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "cgm",          name: "CGM Analyzer",    description: "วิเคราะห์ glucose monitoring patterns",            icon: "📈", audience: "business", href: "/cgm",          status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "pulse",        name: "UP Pulse",        description: "Wearable biomarker → Nutrient → Nutrilite mapping",icon: "📱", audience: "business", href: "/pulse",        status: "beta", allowedRoles: ["abo", "admin"] },
  { slug: "nutriscan",    name: "NutriScan AI",    description: "AI วิเคราะห์โภชนาการจากรูปภาพ/ข้อความ · macros + glucose impact + Nutrilite SKU",                     icon: "🥗", audience: "business", href: "/nutriscan",    status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "foodlog",      name: "Food Log",        description: "บันทึกอาหารรายวัน · ดู C:P:F % พลังงาน · ของตัวเองหรือลูกค้า",                                                  icon: "📅", audience: "business", href: "/nutriscan/log", status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "designer",     name: "Program Designer",description: "ออกแบบ Full Course เฉพาะบุคคล · wizard 5 step · คำนวณ unit + PV + cashback · save HD image",                icon: "🎨", audience: "business", href: "/designer",     status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "prospects",    name: "Prospect List",   description: "★ memory-dump 100 ชื่อ · tier A/B/C · convert → CheckForm คลิกเดียว · เริ่มต้นที่นี่",  icon: "🎯", audience: "business", href: "/prospects",    status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "checkform",    name: "Check FORM",      description: "วิเคราะห์ prospect ด้วย F·O·R·M · มี dialog แนะนำ + คะแนน + next action",  icon: "📋", audience: "business", href: "/checkform",    status: "live", allowedRoles: ["abo", "admin"] },

  // ── Internal ──
  { slug: "dose",         name: "Master Dose",     description: "เปรียบ Nutrilite dosage ทุก tier",                  icon: "💊", audience: "internal", href: "/dose",         status: "soon", allowedRoles: ["admin"] },
  { slug: "dosecalc",     name: "Dose Calculator", description: "คำนวณ dose ส่วนตัว",                               icon: "🧮", audience: "internal", href: "/dosecalc",     status: "soon", allowedRoles: ["admin"] },
  { slug: "pharmamate",   name: "PharmaMate AI",   description: "AI ผู้ช่วยเภสัชกร",                                icon: "⚕️", audience: "internal", href: "/pharmamate",   status: "soon", allowedRoles: ["admin"] },
  { slug: "sallynote",    name: "Pharmacist Note", description: "คู่มือโรคทั่วไป + คำแนะนำ",                          icon: "📓", audience: "internal", href: "/sallynote",    status: "soon", allowedRoles: ["admin"] },

  // ── Content ──
  { slug: "start",        name: "UP Labs Start",   description: "แผนลดน้ำหนัก 14 วัน",                              icon: "🚀", audience: "content", href: "/start",         status: "soon", allowedRoles: ["member", "abo", "admin", "other"] },
  { slug: "faqs",         name: "FAQs",            description: "คำถามที่พบบ่อยของ UP Labs",                         icon: "❓", audience: "content", href: "/faqs",          status: "soon", allowedRoles: ["member", "abo", "admin", "other"] },
  { slug: "longevity",    name: "Longevity Key",   description: "Infographic สุขภาพ longevity",                     icon: "🔑", audience: "content", href: "/longevity",     status: "soon", allowedRoles: ["member", "abo", "admin", "other"] },
];

export function appsByAudience(audience: AppAudience) {
  return APPS.filter((a) => a.audience === audience);
}

export function findApp(slug: string) {
  return APPS.find((a) => a.slug === slug);
}
