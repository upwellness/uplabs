/**
 * UPLABS App Registry
 * ───────────────────
 * Central source-of-truth for every app in the ecosystem.
 * Used by upmenu and BFF to render/route apps consistently.
 */

export type AppAudience = "customer" | "business" | "internal" | "content";

export interface AppMeta {
  slug: string;
  name: string;
  description: string;
  icon: string;
  audience: AppAudience;
  href: string;
  status: "live" | "beta" | "soon";
}

export const APPS: AppMeta[] = [
  // ── Customer ──
  { slug: "healthcheck",  name: "Health Check",    description: "ประเมินสุขภาพ metabolic ครบชุด อิงเกณฑ์ WHO & AHA",  icon: "🏥", audience: "customer", href: "/healthcheck", status: "soon" },
  { slug: "metaflexquiz", name: "MetaFlex Quiz",   description: "วัดความยืดหยุ่นระบบเผาผลาญ",                        icon: "🔥", audience: "customer", href: "/metaflexquiz", status: "soon" },

  // ── Business ──
  { slug: "bca",          name: "BCA Tracker",     description: "ติดตาม Body Composition ของลูกค้าแบบต่อเนื่อง",     icon: "📊", audience: "business", href: "/bca",         status: "live" },
  { slug: "cgm",          name: "CGM Analyzer",    description: "วิเคราะห์ glucose monitoring patterns",            icon: "📈", audience: "business", href: "/cgm",         status: "soon" },
  { slug: "nutriscan",    name: "NutriScan AI",    description: "AI วิเคราะห์โภชนาการจากรูปภาพ",                     icon: "🥗", audience: "business", href: "/nutriscan",   status: "soon" },
  { slug: "designer",     name: "Program Designer",description: "ออกแบบโปรแกรม wellness เฉพาะบุคคล",                icon: "🎨", audience: "business", href: "/designer",    status: "soon" },
  { slug: "checkform",    name: "Check Form",      description: "Form ประเมิน lead ใหม่อย่างมีระบบ",                icon: "📋", audience: "business", href: "/checkform",   status: "soon" },
  { slug: "prospect",     name: "Prospect",        description: "Lead intelligence + FORM scoring",                  icon: "🎯", audience: "business", href: "/prospect",    status: "soon" },

  // ── Internal ──
  { slug: "dose",         name: "Master Dose",     description: "เปรียบ Nutrilite dosage ทุก tier",                  icon: "💊", audience: "internal", href: "/dose",        status: "soon" },
  { slug: "dosecalc",     name: "Dose Calculator", description: "คำนวณ dose ส่วนตัว",                               icon: "🧮", audience: "internal", href: "/dosecalc",    status: "soon" },
  { slug: "pharmamate",   name: "PharmaMate AI",   description: "AI ผู้ช่วยเภสัชกร",                                icon: "⚕️", audience: "internal", href: "/pharmamate",  status: "soon" },
  { slug: "sallynote",    name: "Pharmacist Note", description: "คู่มือโรคทั่วไป + คำแนะนำ",                          icon: "📓", audience: "internal", href: "/sallynote",   status: "soon" },

  // ── Content ──
  { slug: "start",        name: "UP Labs Start",   description: "แผนลดน้ำหนัก 14 วัน",                              icon: "🚀", audience: "content", href: "/start",        status: "soon" },
  { slug: "faqs",         name: "FAQs",            description: "คำถามที่พบบ่อยของ UP Labs",                         icon: "❓", audience: "content", href: "/faqs",         status: "soon" },
  { slug: "longevity",    name: "Longevity Key",   description: "Infographic สุขภาพ longevity",                     icon: "🔑", audience: "content", href: "/longevity",    status: "soon" },
];

export function appsByAudience(audience: AppAudience) {
  return APPS.filter((a) => a.audience === audience);
}
