/**
 * UPLABS App Registry — single source of truth.
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
  // ── Customer ──
  { slug: "healthcheck",  name: "Health Check",    description: "ประเมินสุขภาพ + Lead Capture · ส่งลิงก์ให้คน · เก็บ lead อัตโนมัติ",  icon: "🏥", audience: "business", href: "/healthcheck",  status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "metaflexquiz", name: "MetaFlex Quiz",   description: "วัดความยืดหยุ่นระบบเผาผลาญ",                        icon: "🔥", audience: "customer", href: "/metaflexquiz", status: "soon", allowedRoles: ["member", "abo", "admin"] },

  // ── Business ──
  { slug: "bca",          name: "BCA Tracker",     description: "ติดตาม Body Composition ของลูกค้าแบบต่อเนื่อง",     icon: "📊", audience: "business", href: "/bca",          status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "cgm",          name: "CGM Analyzer",    description: "วิเคราะห์ glucose monitoring patterns",            icon: "📈", audience: "business", href: "/cgm",          status: "live", allowedRoles: ["abo", "admin"] },
  { slug: "pulse",        name: "UP Pulse",        description: "Wearable biomarker → Nutrient → Nutrilite mapping",icon: "📱", audience: "business", href: "/pulse",        status: "beta", allowedRoles: ["abo", "admin"] },
  { slug: "nutriscan",    name: "NutriScan AI",    description: "AI วิเคราะห์โภชนาการจากรูปภาพ",                     icon: "🥗", audience: "business", href: "/nutriscan",    status: "soon", allowedRoles: ["abo", "admin"] },
  { slug: "designer",     name: "Program Designer",description: "ออกแบบโปรแกรม wellness เฉพาะบุคคล",                icon: "🎨", audience: "business", href: "/designer",     status: "soon", allowedRoles: ["abo", "admin"] },
  { slug: "checkform",    name: "Check Form",      description: "Form ประเมิน lead ใหม่อย่างมีระบบ",                icon: "📋", audience: "business", href: "/checkform",    status: "soon", allowedRoles: ["abo", "admin"] },
  { slug: "prospect",     name: "Prospect",        description: "Lead intelligence + FORM scoring",                  icon: "🎯", audience: "business", href: "/prospect",     status: "soon", allowedRoles: ["abo", "admin"] },

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
