// @ts-nocheck
/**
 * Plate Planner — native uplabs port of the standalone single-file app
 * (source: Plate Planner/webapp/index.html · ported verbatim, BYO-key disabled).
 * Engine (calcTargets/buildDay/dietTags/okFood/allocMeal/…) copied unchanged from QA'd source.
 * Image gen routed to /api/plate-image (server-side GEMINI_API_KEY + Supabase cache).
 * Styling: scoped under .pp-root so the glass/aurora vars + dark mode don't leak to the rest of uplabs.
 * NOTE: `// @ts-nocheck` must lead the file (before any statement) to apply — the `'use client'`
 * directive follows it; React/Next allow leading comments before the directive.
 */
'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';

export type PlatePlannerProps = { initialW?: number; initialH?: number };

// flag โหมดคีย์ภาพ: native mode → false = ใช้ env GEMINI_API_KEY ฝั่งเซิร์ฟเวอร์ ไม่ถาม (ซ่อนแผง ⚙️ ใส่คีย์)
const BYO_KEY = false;
// ===== i18n: LANG เป็น module var · t(ไทย,EN) อ่าน LANG · สลับภาษาแล้ว setLangTick ใน App รีเรนเดอร์ทุก component =====
let LANG = (typeof localStorage !== 'undefined' && localStorage.getItem('pp_lang')) || 'th';
const tr = (th, en) => (LANG === 'en' && en) ? en : th;  // i18n (ชื่อ tr กัน t ชนเป้ามาโครใน App)
const MEALNAME_EN = { 'มื้อเช้า': 'Breakfast', 'มื้อกลางวัน': 'Lunch', 'มื้อเย็น': 'Dinner', 'มื้อที่ 1': 'Meal 1', 'มื้อที่ 2': 'Meal 2', 'ของว่าง': 'Snack', 'มื้อ 1 (เช้า)': 'Meal 1 (AM)', 'มื้อ 2 (ก่อนเทรน)': 'Meal 2 (pre-workout)', 'มื้อ 3 (หลังเทรน)': 'Meal 3 (post-workout)', 'มื้อ 4 (เย็น)': 'Meal 4 (evening)' };
const STYLE_EN = { 'ย่าง': 'grilled', 'ต้มยำ': 'tom yum', 'ผัดกระเทียมพริกไทย': 'garlic & pepper', 'นึ่งซีอิ๊ว': 'steamed w/ soy', 'อบสมุนไพร': 'herb-baked', 'ลวกจิ้มแจ่ว': 'blanched w/ jaew', 'ผัดพริกแกง': 'red-curry stir-fry', 'ต้มจืด': 'clear soup', 'เจียว': 'omelette', 'ดาว': 'fried', 'ต้ม': 'boiled', 'ยำ': 'spicy salad', 'ทอด': 'fried', 'ราดพริก': 'chili-topped' };
const CATL_EN = { 'โปรตีน': 'Protein', 'คาร์บ': 'Carb', 'ผัก': 'Veg', 'ไขมันดี': 'Fat', 'ผลไม้': 'Fruit' };
const UNIT_EN = { 'ฝ่ามือ': 'palm', 'ฟอง': 'egg', 'ชิ้น': 'piece', 'ตัว': 'pc', 'กระป๋อง': 'can', 'ก้อน': 'block', 'ถ้วย': 'cup', 'สกู๊ป': 'scoop', 'ทัพพี': 'scoop', 'หัวเล็ก': 'small', 'หัวกลาง': 'medium', 'แผ่น': 'slice', 'ผล': 'piece', 'ช้อนตวง': 'scoop', 'ช้อนโต๊ะ': 'tbsp', 'กำมือ': 'handful', 'ฝัก': 'cob', 'ลูก': 'piece', 'ดอก': 'piece', 'แก้ว': 'glass', 'จับ': 'bundle', 'ถ้วยตวง': 'cup', 'หัว': 'piece', 'ลูกเล็ก': 'small' };
const catl = l => LANG === 'en' ? (CATL_EN[l] || l) : l;   // ป้ายหมวด
const unit = u => LANG === 'en' ? (UNIT_EN[u] || u) : u;    // หน่วยอาหาร
const shk = th => LANG === 'en' ? th.replace(/ซอง/g, 'sachet').replace(/ช้อน/g, 'scoop') : th;  // ชื่อเชค (หน่วยไทย→en)
const mn = name => LANG === 'en' ? (MEALNAME_EN[name] || name) : name;                                    // ชื่อมื้อ
const stl = s => LANG === 'en' ? (STYLE_EN[s] || s) : s;                                                  // วิธีปรุง
const fnm = th => LANG === 'en' ? (EN[th] || th.replace(/\s*\(.*?\)/, '')) : th.replace(/\s*\(.*?\)/, '');   // ชื่ออาหาร (จาก th string)

// ===== ฐานข้อมูลอาหาร (ค่าจริงจาก knowledge/food-db/thai-food-db.csv · USDA FDC / Source-anchor) =====
// ค่าทั้งหมดต่อ 100 กรัม (ยกเว้น kcal ของผัก ใช้ค่า USDA ตรง ไม่ recompute)
const CAT = {
  protein: { c: '#8C4C4C', label: 'โปรตีน' }, carb: { c: '#C47A2A', label: 'คาร์บ' },
  veg: { c: '#396755', label: 'ผัก' }, fruit: { c: '#A0567B', label: 'ผลไม้' }, fat: { c: '#2A7B8F', label: 'ไขมันดี' },
};
// u=หน่วยครัวเรือน · ug=กรัมต่อ 1 หน่วย · max=เพดานกรัม/มื้อที่ "กินจริงได้"
const DB = {
  protein: [
    { th: 'อกไก่ (สุก)', kcal: 165, p: 31, c: 0, f: 3.6, u: 'ฝ่ามือ', ug: 120, max: 250, src: 'USDA 171534', conf: 'verified', hero: 1 },
    { th: 'ไข่ไก่ทั้งฟอง', kcal: 143, p: 12.6, c: 0.7, f: 9.5, u: 'ฟอง', ug: 55, max: 165, src: 'USDA 748967', conf: 'verified', snkp: 1 },
    { th: 'ไข่ขาว', kcal: 52, p: 10.9, c: 0.7, f: 0.2, u: 'ฟอง', ug: 33, max: 231, src: 'USDA 747997', conf: 'verified' },
    { th: 'ปลานิล (สุก)', kcal: 96, p: 20.1, c: 0, f: 1.7, u: 'ฝ่ามือ', ug: 120, max: 250, src: 'USDA 175179', conf: 'verified', hero: 1 },
    { th: 'ปลาแซลมอน', kcal: 208, p: 20.4, c: 0, f: 13.4, u: 'ชิ้น', ug: 120, max: 200, src: 'USDA 175167', conf: 'verified', hero: 1 },
    { th: 'หมูสันใน', kcal: 120, p: 20.7, c: 0, f: 3.4, u: 'ฝ่ามือ', ug: 120, max: 250, src: 'USDA 167903', conf: 'verified', hero: 1 },
    { th: 'เนื้อวัวไม่ติดมัน', kcal: 135, p: 25, c: 0, f: 3.5, u: 'ฝ่ามือ', ug: 120, max: 250, src: 'Source anchor', conf: 'verified', hero: 1 },
    { th: 'กุ้งขาว', kcal: 85, p: 20.1, c: 0.9, f: 0.5, u: 'ตัว', ug: 16, max: 200, src: 'USDA', conf: 'verified', hero: 1 },
    { th: 'ทูน่ากระป๋องในน้ำ', kcal: 116, p: 25.5, c: 0, f: 0.8, u: 'กระป๋อง', ug: 100, max: 200, src: 'USDA 175159', conf: 'verified', hero: 1 },
    { th: 'เต้าหู้แข็ง', kcal: 144, p: 17.3, c: 2.8, f: 8.7, u: 'ก้อน', ug: 150, max: 300, src: 'USDA 174291', conf: 'verified', hero: 1 },
    { th: 'กรีกโยเกิร์ตจืด', kcal: 59, p: 10.2, c: 3.6, f: 0.4, u: 'ถ้วย', ug: 150, max: 300, src: 'USDA 170903', conf: 'verified', snkp: 1 },
    { th: 'เวย์โปรตีน', kcal: 370, p: 77, c: 8, f: 5, u: 'สกู๊ป', ug: 30, max: 60, src: 'ฉลาก', conf: 'estimate', snkp: 1 },
    { th: 'ปลากะพง', kcal: 97, p: 18.4, c: 0, f: 2, u: 'ฝ่ามือ', ug: 120, max: 250, src: 'USDA 174194', conf: 'estimate', hero: 1 },
    { th: 'ปลาทูนึ่ง', kcal: 147, p: 20, c: 0, f: 7, u: 'ตัว', ug: 80, max: 200, src: 'Thai FCD ~', conf: 'estimate', hero: 1 },
    { th: 'ปลาหมึก', kcal: 92, p: 15.6, c: 3.1, f: 1.4, u: 'ตัว', ug: 100, max: 250, src: 'USDA 175179', conf: 'verified', hero: 1 },
    { th: 'สะโพกไก่ลอกหนัง', kcal: 121, p: 18.6, c: 0, f: 4.7, u: 'ชิ้น', ug: 100, max: 250, src: 'USDA 171479', conf: 'verified', hero: 1 },
    { th: 'ปลาดุกย่าง (เลี้ยง)', kcal: 144, p: 18.4, c: 0, f: 7.2, u: 'ชิ้น', ug: 120, max: 200, src: 'USDA 174185', conf: 'verified', hero: 1 },
    { th: 'ปลาซาบะย่าง', kcal: 201, p: 25.7, c: 0, f: 10.1, u: 'ชิ้น', ug: 100, max: 200, src: 'USDA 171994', conf: 'verified', hero: 1 },
    { th: 'หอยแมลงภู่ลวก', kcal: 172, p: 23.8, c: 7.4, f: 4.5, u: 'ตัว', ug: 15, max: 200, src: 'USDA 174217', conf: 'verified', hero: 1 },
    { th: 'หอยลายลวก', kcal: 148, p: 25.6, c: 5.1, f: 2, u: 'ตัว', ug: 8, max: 150, src: 'USDA 171975', conf: 'verified', hero: 1 },
    { th: 'ปูม้านึ่ง', kcal: 83, p: 17.9, c: 0, f: 0.7, u: 'ตัว', ug: 80, max: 200, src: 'USDA 171973', conf: 'verified', hero: 1 },
    { th: 'เอ็นดามาเมะ (ถั่วแระต้ม)', kcal: 121, p: 11.9, c: 8.9, f: 5.2, u: 'ถ้วย', ug: 155, max: 200, src: 'USDA 168411', conf: 'verified', hero: 1 },
    { th: 'ถั่วเหลืองต้ม', kcal: 172, p: 18.2, c: 8.4, f: 9, u: 'ทัพพี', ug: 90, max: 150, src: 'USDA 174271', conf: 'verified', hero: 1 },
    { th: 'อกเป็ดลอกหนัง (ย่าง)', kcal: 201, p: 23.5, c: 0, f: 11.2, u: 'ชิ้น', ug: 100, max: 180, src: 'USDA 172411', conf: 'verified', hero: 1 },
    { th: 'เต้าหู้ขาวอ่อน', kcal: 61, p: 7.2, c: 1.2, f: 3.7, u: 'ก้อน', ug: 120, max: 250, src: 'USDA 172449', conf: 'verified', hero: 1 },
    { th: 'คอตเทจชีส (ไขมัน 2%)', kcal: 84, p: 11, c: 4.3, f: 2.3, u: 'ถ้วย', ug: 113, max: 200, src: 'USDA 328841', conf: 'verified', snkp: 1 },
    { th: 'นมจืด (โฮลมิลค์)', kcal: 60, p: 3.3, c: 4.6, f: 3.2, u: 'แก้ว', ug: 240, max: 300, src: 'USDA 746782', conf: 'verified', snkp: 1 },
    { th: 'นมถั่วเหลืองไม่หวาน', kcal: 33, p: 2.6, c: 1.2, f: 1.2, u: 'แก้ว', ug: 240, max: 300, src: 'USDA 175223', conf: 'verified', snkp: 1 },
  ],
  carb: [
    { th: 'ข้าวสวย', kcal: 130, p: 2.7, c: 28, f: 0.3, u: 'ทัพพี', ug: 55, max: 275, src: 'USDA 169756', conf: 'verified', sv: 1 },
    { th: 'ข้าวกล้อง', kcal: 123, p: 2.7, c: 25.6, f: 1, u: 'ทัพพี', ug: 55, max: 275, src: 'USDA 169704', conf: 'verified', sv: 1 },
    { th: 'มันเทศ (สุก)', kcal: 90, p: 2, c: 20.7, f: 0.2, u: 'หัวเล็ก', ug: 130, max: 300, src: 'USDA 168483', conf: 'verified', sv: 1 },
    { th: 'ข้าวโอ๊ต (ดิบ)', kcal: 389, p: 16.9, c: 66.3, f: 6.9, u: 'ถ้วยตวง', ug: 80, max: 120, src: 'USDA 173904', conf: 'verified' },
    { th: 'ขนมปังโฮลวีต', kcal: 247, p: 13, c: 41, f: 3.4, u: 'แผ่น', ug: 30, max: 120, src: 'USDA 172686', conf: 'verified' },
    { th: 'กล้วย', kcal: 89, p: 1.1, c: 22.8, f: 0.3, u: 'ผล', ug: 100, max: 200, src: 'USDA 173944', conf: 'verified' },
    { th: 'ข้าวไรซ์เบอร์รี', kcal: 127, p: 3, c: 26, f: 0.8, u: 'ทัพพี', ug: 55, max: 275, src: 'ประมาณจากข้าวกล้อง', conf: 'estimate', sv: 1 },
    { th: 'มันฝรั่ง (สุก)', kcal: 93, p: 2.5, c: 21.2, f: 0.1, u: 'หัวกลาง', ug: 150, max: 300, src: 'USDA 170093', conf: 'verified', sv: 1 },
    { th: 'เส้นก๋วยเตี๋ยว (ลวก)', kcal: 108, p: 1.8, c: 24.9, f: 0.2, u: 'ก้อน', ug: 120, max: 300, src: 'USDA 169758', conf: 'verified', sv: 1 },
    { th: 'วุ้นเส้น (ลวก)', kcal: 83, p: 0.1, c: 19, f: 0.6, u: 'ก้อน', ug: 100, max: 280, src: 'USDA 169743', conf: 'estimate', sv: 1 },
    { th: 'ข้าวเหนียวสุก', kcal: 97, p: 2, c: 21.1, f: 0.2, u: 'ทัพพี', ug: 55, max: 150, src: 'USDA 169711', conf: 'verified', sv: 1 },
    { th: 'ข้าวโพดหวานต้ม', kcal: 96, p: 3.4, c: 21, f: 1.5, u: 'ฝัก', ug: 90, max: 200, src: 'USDA 169999', conf: 'verified', sv: 1 },
    { th: 'เผือกต้ม', kcal: 142, p: 0.5, c: 34.6, f: 0.1, u: 'ทัพพี', ug: 60, max: 150, src: 'USDA 168486', conf: 'verified', sv: 1 },
    { th: 'ควินัวสุก', kcal: 120, p: 4.4, c: 21.3, f: 1.9, u: 'ทัพพี', ug: 60, max: 180, src: 'USDA 168917', conf: 'verified', sv: 1 },
    { th: 'เส้นใหญ่สุก', kcal: 109, p: 0.9, c: 24.9, f: 0.2, u: 'ทัพพี', ug: 60, max: 200, src: 'USDA 168914', conf: 'verified', sv: 1 },
    { th: 'ลูกเดือยสุก', kcal: 135, p: 5.5, c: 23, f: 2.2, u: 'ทัพพี', ug: 60, max: 180, src: 'Coix ดิบ USDA/TKPI 380 ÷ หุงสุก', conf: 'estimate', sv: 1 },
    { th: 'ขนมจีน', kcal: 108, p: 1.8, c: 24, f: 0.2, u: 'จับ', ug: 50, max: 200, src: 'Nutrition Hub TKPI kanom-jeen', conf: 'verified', sv: 1 },
    { th: 'มันสำปะหลังต้ม', kcal: 112, p: 1, c: 27, f: 0.3, u: 'ทัพพี', ug: 60, max: 150, src: 'USDA cassava cooked', conf: 'verified', sv: 1 },
  ],
  veg: [
    { th: 'บรอกโคลี', kcal: 35, p: 2.4, c: 7.2, f: 0.4, u: 'ทัพพี', ug: 80, max: 250, src: 'USDA 170380', conf: 'verified' },
    { th: 'ผักบุ้ง', kcal: 19, p: 2.6, c: 3.1, f: 0.2, u: 'ทัพพี', ug: 80, max: 250, src: 'USDA 169301 water spinach', conf: 'verified' },
    { th: 'คะน้า', kcal: 26, p: 1.8, c: 3.4, f: 0.7, u: 'ทัพพี', ug: 80, max: 250, src: 'USDA gai lan (chinese broccoli)', conf: 'verified' },
    { th: 'กะหล่ำปลี', kcal: 25, p: 1.3, c: 5.8, f: 0.1, u: 'ทัพพี', ug: 80, max: 250, src: 'USDA 169975', conf: 'verified' },
    { th: 'เห็ดออรินจิ', kcal: 33, p: 3.3, c: 6.1, f: 0.4, u: 'ทัพพี', ug: 80, max: 250, src: 'USDA 169246', conf: 'verified' },
    { th: 'ผักกาดขาว', kcal: 16, p: 1.2, c: 3.2, f: 0.2, u: 'ทัพพี', ug: 80, max: 250, src: 'USDA 170390', conf: 'verified' },
    { th: 'แตงกวา', kcal: 15, p: 0.7, c: 3.6, f: 0.1, u: 'ลูกเล็ก', ug: 100, max: 250, src: 'USDA 168409', conf: 'verified' },
    { th: 'มะเขือเทศ', kcal: 18, p: 0.9, c: 3.9, f: 0.2, u: 'ลูก', ug: 100, max: 250, src: 'USDA 170457', conf: 'verified' },
    { th: 'เห็ดหอม', kcal: 34, p: 2.2, c: 6.8, f: 0.5, u: 'ดอก', ug: 80, max: 250, src: 'USDA 169244', conf: 'verified' },
    { th: 'ถั่วฝักยาว', kcal: 47, p: 2.8, c: 8.4, f: 0.4, u: 'ทัพพี', ug: 80, max: 250, src: 'USDA 169218', conf: 'verified' },
    { th: 'ฟักเขียว', kcal: 13, p: 0.4, c: 3, f: 0.1, u: 'ทัพพี', ug: 80, max: 250, src: 'USDA 169912 waxgourd', conf: 'verified' },
    { th: 'พริกหวาน', kcal: 26, p: 1, c: 6, f: 0.3, u: 'ลูก', ug: 80, max: 200, src: 'USDA 170108', conf: 'verified' },
    { th: 'ฟักทอง (สุก)', kcal: 20, p: 0.7, c: 4.9, f: 0.1, u: 'ทัพพี', ug: 80, max: 250, src: 'USDA 168448', conf: 'verified' },
    { th: 'ดอกกะหล่ำ', kcal: 25, p: 1.9, c: 5, f: 0.3, u: 'ถ้วย', ug: 100, max: 200, src: 'USDA 169986', conf: 'verified' },
    { th: 'แครอท', kcal: 41, p: 0.9, c: 9.6, f: 0.2, u: 'หัว', ug: 60, max: 150, src: 'USDA 170393', conf: 'verified' },
    { th: 'มะเขือยาว', kcal: 25, p: 1, c: 5.9, f: 0.2, u: 'ผล', ug: 80, max: 200, src: 'USDA 169228', conf: 'verified' },
    { th: 'มะระ', kcal: 17, p: 1, c: 3.7, f: 0.2, u: 'ลูก', ug: 120, max: 200, src: 'USDA 169226', conf: 'verified' },
    { th: 'ถั่วงอก', kcal: 30, p: 3, c: 5.9, f: 0.2, u: 'ถ้วย', ug: 100, max: 150, src: 'USDA 169957', conf: 'verified' },
    { th: 'ผักกาดหอม', kcal: 15, p: 1.4, c: 2.9, f: 0.2, u: 'ถ้วย', ug: 55, max: 150, src: 'USDA 169249', conf: 'verified' },
    { th: 'กวางตุ้ง', kcal: 13, p: 1.5, c: 2.2, f: 0.2, u: 'ทัพพี', ug: 70, max: 200, src: 'USDA 170390', conf: 'verified' },
    { th: 'ผักโขม', kcal: 23, p: 2.5, c: 4, f: 0.3, u: 'ทัพพี', ug: 70, max: 200, src: 'USDA 168390', conf: 'verified' },
    { th: 'หน่อไม้ต้ม', kcal: 12, p: 1.5, c: 1.9, f: 0.2, u: 'ถ้วย', ug: 120, max: 200, src: 'USDA 169211', conf: 'verified' },
    { th: 'ข้าวโพดอ่อน', kcal: 26, p: 2, c: 5.2, f: 0.3, u: 'ฝัก', ug: 10, max: 150, src: 'Thai FCD', conf: 'estimate' },
    { th: 'เห็ดเข็มทอง', kcal: 37, p: 2.7, c: 7.8, f: 0.3, u: 'กำมือ', ug: 80, max: 150, src: 'USDA 169382', conf: 'verified' },
    { th: 'เห็ดฟาง', kcal: 32, p: 3.8, c: 4.6, f: 0.7, u: 'ถ้วย', ug: 90, max: 150, src: 'USDA 168582', conf: 'verified' },
    { th: 'บวบ', kcal: 14, p: 0.6, c: 3.4, f: 0, u: 'ผล', ug: 100, max: 200, src: 'USDA 169232', conf: 'verified' },
    { th: 'ขึ้นฉ่าย', kcal: 16, p: 0.7, c: 3, f: 0.2, u: 'กำมือ', ug: 40, max: 100, src: 'USDA 169988', conf: 'verified' },
    { th: 'ตำลึง (ใบ)', kcal: 35, p: 3.3, c: 4.4, f: 0.4, u: 'ทัพพี', ug: 50, max: 150, src: 'Thai FCD ใบตำลึง', conf: 'estimate' },
  ],
  fat: [
    { th: 'น้ำมันมะกอก', kcal: 884, p: 0, c: 0, f: 100, u: 'ช้อนโต๊ะ', ug: 14, max: 30, src: 'USDA 171413', conf: 'verified' },
    { th: 'น้ำมันรำข้าว', kcal: 884, p: 0, c: 0, f: 100, u: 'ช้อนโต๊ะ', ug: 14, max: 30, src: 'USDA', conf: 'verified' },
    { th: 'อะโวคาโด', kcal: 160, p: 2, c: 8.5, f: 14.7, u: 'ผล', ug: 200, max: 200, src: 'USDA 171705', conf: 'verified' },
    { th: 'อัลมอนด์', kcal: 579, p: 21.2, c: 21.6, f: 49.9, u: 'กำมือ', ug: 28, max: 56, src: 'USDA 170567', conf: 'verified', snk: 1 },
    { th: 'เมล็ดฟักทอง', kcal: 559, p: 30.2, c: 10.7, f: 49, u: 'ช้อนโต๊ะ', ug: 14, max: 42, src: 'USDA 170556', conf: 'verified', snk: 1 },
    { th: 'เม็ดมะม่วงหิมพานต์', kcal: 553, p: 18.2, c: 30.2, f: 43.9, u: 'กำมือ', ug: 28, max: 42, src: 'USDA 170162', conf: 'verified', snk: 1 },
    { th: 'งา', kcal: 573, p: 17.7, c: 23.4, f: 49.7, u: 'ช้อนโต๊ะ', ug: 9, max: 27, src: 'USDA 170150', conf: 'verified', snk: 1 },
    { th: 'วอลนัท', kcal: 654, p: 15.2, c: 13.7, f: 65.2, u: 'กำมือ', ug: 30, max: 40, src: 'USDA 170187', conf: 'verified', snk: 1 },
    { th: 'ถั่วลิสง', kcal: 567, p: 25.8, c: 16.1, f: 49.2, u: 'กำมือ', ug: 30, max: 40, src: 'USDA 172430', conf: 'verified', snk: 1 },
    { th: 'เนยถั่ว', kcal: 588, p: 25.1, c: 19.6, f: 50.4, u: 'ช้อนโต๊ะ', ug: 16, max: 32, src: 'USDA 174294', conf: 'verified', snk: 1 },
    { th: 'เมล็ดทานตะวัน', kcal: 584, p: 20.8, c: 20, f: 51.5, u: 'ช้อนโต๊ะ', ug: 9, max: 30, src: 'USDA 170562', conf: 'verified', snk: 1 },
    { th: 'เมล็ดเจีย', kcal: 486, p: 16.5, c: 42.1, f: 30.7, u: 'ช้อนโต๊ะ', ug: 12, max: 30, src: 'USDA 170554', conf: 'verified', snk: 1 },
  ],
  fruit: [
    { th: 'แอปเปิล', kcal: 52, p: 0.3, c: 13.8, f: 0.2, u: 'ผล', ug: 150, max: 200, src: 'USDA 171688', conf: 'verified' },
    { th: 'ส้ม', kcal: 47, p: 0.9, c: 11.8, f: 0.1, u: 'ผล', ug: 120, max: 200, src: 'USDA 169097', conf: 'verified' },
    { th: 'มะละกอสุก', kcal: 43, p: 0.5, c: 10.8, f: 0.3, u: 'ถ้วย', ug: 140, max: 200, src: 'USDA 169926', conf: 'verified' },
    { th: 'ฝรั่ง', kcal: 68, p: 2.6, c: 14.3, f: 1, u: 'ผล', ug: 120, max: 200, src: 'USDA 173044', conf: 'verified' },
    { th: 'แตงโม', kcal: 30, p: 0.6, c: 7.6, f: 0.2, u: 'ชิ้น', ug: 150, max: 250, src: 'USDA 167765', conf: 'verified' },
    { th: 'สับปะรด', kcal: 50, p: 0.5, c: 13.1, f: 0.1, u: 'ถ้วย', ug: 165, max: 200, src: 'USDA 169124', conf: 'verified' },
    { th: 'มะม่วงสุก', kcal: 60, p: 0.8, c: 15, f: 0.4, u: 'ผล', ug: 150, max: 200, src: 'USDA 169910', conf: 'verified' },
    { th: 'องุ่น', kcal: 69, p: 0.7, c: 18.1, f: 0.2, u: 'ลูก', ug: 7, max: 150, src: 'USDA 174683', conf: 'verified' },
    { th: 'สตรอเบอร์รี', kcal: 32, p: 0.7, c: 7.7, f: 0.3, u: 'ลูก', ug: 12, max: 200, src: 'USDA 167762', conf: 'verified' },
    { th: 'แก้วมังกร', kcal: 60, p: 1.2, c: 13, f: 0.4, u: 'ผล', ug: 150, max: 200, src: 'USDA pitaya', conf: 'verified' },
  ],
};

const r1 = x => Math.round(x * 10) / 10;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pick = (arr, n) => arr[((n % arr.length) + arr.length) % arr.length];

// ===== v4: ตัวจำแนกอาหารตามข้อจำกัด/แพ้ (อิง 9 สารก่อภูมิแพ้หลัก ประกาศ สธ. ฉบับ 383) =====
function dietTags(f) {
  const n = f.th, T = new Set(), add = (...xs) => xs.forEach(x => T.add(x));
  if (/หมู/.test(n)) add('pork', 'meat', 'animal');
  if (/เนื้อวัว/.test(n)) add('beef', 'meat', 'animal');
  if ((/ไก่|เป็ด/.test(n)) && !/ไข่/.test(n)) add('poultry', 'meat', 'animal');   // กัน "ไข่ไก่" ติด poultry/meat (มังสวิรัติต้องเก็บไข่)
  if (/หมึก/.test(n)) add('shellfish', 'seafood', 'animal');                 // ปลาหมึก = หอย/mollusk (ไม่ใช่ปลา)
  else if (/ปลา|ทูน่า|แซลมอน|ซาบะ/.test(n)) add('fish', 'animal');
  if (/กุ้ง|หอย|ปู/.test(n)) add('shellfish', 'seafood', 'animal');
  if (/ไข่/.test(n)) add('egg', 'animal');
  if (/นม(?!ถั่ว)|โยเกิร์ต|ชีส|เวย์/.test(n)) add('dairy', 'animal');         // "นมถั่วเหลือง" ไม่นับนม
  if (/เต้าหู้|ถั่วเหลือง|ถั่วแระ|เอ็นดามาเมะ|นมถั่วเหลือง/.test(n)) add('soy', 'plant');
  if (/อัลมอนด์|มะม่วงหิมพานต์|วอลนัท|ถั่วลิสง|เนยถั่ว/.test(n)) add('nuts', 'plant');
  if (/งา|เมล็ดทานตะวัน|เมล็ดฟักทอง|เมล็ดเจีย/.test(n)) add('seeds', 'plant');
  return T;
}
function okFood(f, cfg) {
  if (!cfg) return true;
  const T = dietTags(f), d = cfg.diet, a = cfg.allergy || [];
  if ((d === 'halal' || d === 'nopork' || d === 'noredmeat') && T.has('pork')) return false;
  if ((d === 'nobeef' || d === 'noredmeat') && T.has('beef')) return false;
  if (d === 'vegetarian' && (T.has('meat') || T.has('fish') || T.has('shellfish'))) return false;  // lacto-ovo: เก็บไข่+นม
  if (d === 'vegan' && T.has('animal')) return false;
  if (cfg.noVeg && f.cat === 'veg') return false;
  if (a.includes('seafood') && T.has('shellfish')) return false;
  if (a.includes('fish') && T.has('fish')) return false;
  if (a.includes('nuts') && T.has('nuts')) return false;
  if (a.includes('soy') && T.has('soy')) return false;
  if (a.includes('dairy') && T.has('dairy')) return false;
  if (a.includes('egg') && T.has('egg')) return false;
  if (a.includes('sesame') && /งา/.test(f.th)) return false;
  if (a.includes('gluten') && /ขนมปัง|โอ๊ต|ข้าวสาลี/.test(f.th)) return false;
  return true;
}
const cfgActive = cfg => !!cfg && (cfg.diet && cfg.diet !== 'none' || cfg.noVeg || (cfg.allergy || []).length || cfg.lockW || cfg.shake?.on);

// ===== คำนวณมาโครเป้าหมาย (ตรงตาม Protocol Lyon ที่ทดสอบแล้ว) =====
function calcTargets(w, h, goal, lockW) {
  const hm = h / 100, bmi = w / (hm * hm);
  const ideal = lockW ? w : (bmi >= 25 ? r1(22.9 * hm * hm) : w);   // v4 weight-lock: ใช้ น้ำหนักที่ใส่ตรง ๆ ไม่คิด ideal จาก BMI
  let kcal, p, c, f, base, note;
  if (goal === 'loss') {
    base = ideal; kcal = Math.round(27 * ideal); p = r1(2.2 * ideal); c = 90; f = r1((kcal - p * 4 - c * 4) / 9);
    note = tr(`27 kcal × น้ำหนักที่เหมาะสม ${ideal} กก. · โปรตีน 2.2 ก./กก. · คาร์บ 30 ก./มื้อ · ไขมัน=ส่วนที่เหลือ`, `27 kcal × ideal weight ${ideal} kg · protein 2.2 g/kg · carbs ~30 g/meal · fat = remainder`);
  }
  else if (goal === 'longevity') {
    base = w; kcal = Math.round(34 * w); p = r1(2.2 * w); c = 130; f = r1((kcal - p * 4 - c * 4) / 9);
    note = tr(`34 kcal × น้ำหนักปัจจุบัน ${w} กก. · โปรตีนสูง+คาร์บ≤130 → ไขมันดีสูงแบบเมดิเตอร์เรเนียน`, `34 kcal × current weight ${w} kg · high protein + carbs ≤130 → Mediterranean-style healthy fats`);
  }
  else {
    base = w; kcal = Math.round(40 * w); p = r1(2.2 * w); f = r1(1.0 * w); c = r1((kcal - p * 4 - f * 9) / 4);
    note = tr(`40 kcal × น้ำหนักปัจจุบัน ${w} กก. · โปรตีน 2.2 ก./กก. · ไขมัน 1 ก./กก. · คาร์บ=ส่วนที่เหลือ`, `40 kcal × current weight ${w} kg · protein 2.2 g/kg · fat 1 g/kg · carbs = remainder`);
  }
  if (lockW) note += tr(' · 🔒 ล็อกน้ำหนักคำนวณ', ' · 🔒 weight-locked');
  return { bmi: r1(bmi), ideal, base, kcal, p, c, f, note };
}

function mealPlan(goal, even3) {
  if (even3) return [
    { name: 'มื้อเช้า', frac: 0.34, carb: true }, { name: 'มื้อกลางวัน', frac: 0.33, carb: true }, { name: 'มื้อเย็น', frac: 0.33, carb: true }];
  if (goal === 'loss') return [
    { name: 'มื้อเช้า', frac: 0.34, carb: true }, { name: 'มื้อกลางวัน', frac: 0.33, carb: true }, { name: 'มื้อเย็น', frac: 0.33, carb: true }];
  if (goal === 'longevity') return [
    { name: 'มื้อที่ 1', frac: 0.42, carb: true, carbCap: 30 }, { name: 'มื้อที่ 2', frac: 0.43, carb: true }, { name: 'ของว่าง', frac: 0.15, carb: false, snack: true }];
  return [
    { name: 'มื้อ 1 (เช้า)', frac: 0.25, carb: true }, { name: 'มื้อ 2 (ก่อนเทรน)', frac: 0.22, carb: true },
    { name: 'มื้อ 3 (หลังเทรน)', frac: 0.30, carb: true }, { name: 'มื้อ 4 (เย็น)', frac: 0.23, carb: true }];
}

const niceQty = x => { if (x >= 3) return String(Math.round(x)); const h = Math.round(x * 2) / 2; return h < 0.5 ? '' : String(h); }; // 6.4→"6" · 1.9→"2" · 0.2→"" (เล็กไป ใช้กรัมแทน)
const qtyLabel = it => { const q = niceQty(it.g / it.ug); return q ? ('≈ ' + q + ' ' + unit(it.u)) : ''; };
// % พลังงานจากแต่ละมาโครของอาหารชิ้นนั้น (โปรตีน/คาร์บ ×4 kcal/g, ไขมัน ×9 → normalize ให้รวม 100)
const eSplit = it => { const pk = it.p * 4, ck = it.c * 4, fk = it.f * 9, t = pk + ck + fk || 1; return { p: Math.round(pk / t * 100), c: Math.round(ck / t * 100), f: Math.round(fk / t * 100) }; };
const mk = (food, g) => {
  const gg = Math.round(g); return {
    th: food.th, cat: food.cat || food._cat,
    u: food.u, ug: food.ug, src: food.src, conf: food.conf, mx: food.max,
    g: gg, p: r1(food.p * g / 100), c: r1(food.c * g / 100), f: r1(food.f * g / 100), kcal: Math.round(food.kcal * g / 100),
    ref: { kcal: food.kcal, p: food.p, c: food.c, f: food.f }
  };
};
const reTot = it => {
  const a = it.reduce((s, x) => ({ p: s.p + x.p, c: s.c + x.c, f: s.f + x.f, kcal: s.kcal + x.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
  return { p: r1(a.p), c: r1(a.c), f: r1(a.f), kcal: Math.round(a.kcal) };
};
const tag = (arr, cat) => arr.map(o => ({ ...o, _cat: cat }));

const STYLES = ['ย่าง', 'ต้มยำ', 'ผัดกระเทียมพริกไทย', 'นึ่งซีอิ๊ว', 'อบสมุนไพร', 'ลวกจิ้มแจ่ว', 'ผัดพริกแกง', 'ต้มจืด'];
// วิธีปรุงที่ "เข้ากับ" โปรตีนหลักแต่ละชนิด (กัน "อบสมุนไพรเวย์" / "ลวกจิ้มแจ่วไข่ขาว")
const PSTYLE = { 'อกไก่ (สุก)': ['ย่าง', 'ผัดกระเทียมพริกไทย', 'ผัดพริกแกง', 'ต้มยำ', 'อบสมุนไพร'], 'หมูสันใน': ['ย่าง', 'ผัดกระเทียมพริกไทย', 'ผัดพริกแกง', 'ต้มจืด'], 'เนื้อวัวไม่ติดมัน': ['ย่าง', 'ผัดพริกแกง', 'ผัดกระเทียมพริกไทย', 'ต้มยำ'], 'ปลานิล (สุก)': ['ย่าง', 'นึ่งซีอิ๊ว', 'ต้มยำ', 'ผัดพริกแกง'], 'ปลาแซลมอน': ['ย่าง', 'นึ่งซีอิ๊ว', 'อบสมุนไพร'], 'กุ้งขาว': ['ย่าง', 'ต้มยำ', 'ผัดกระเทียมพริกไทย'], 'ทูน่ากระป๋องในน้ำ': ['ยำ'], 'เต้าหู้แข็ง': ['ผัดกระเทียมพริกไทย', 'ต้มจืด', 'นึ่งซีอิ๊ว'], 'ไข่ไก่ทั้งฟอง': ['เจียว', 'ดาว', 'ต้ม'], 'ไข่ขาว': ['เจียว', 'ต้ม'], 'ปลากะพง': ['ย่าง', 'นึ่งซีอิ๊ว', 'ต้มยำ', 'ผัดพริกแกง'], 'ปลาทูนึ่ง': ['ทอด', 'ต้มยำ', 'ราดพริก'], 'ปลาหมึก': ['ย่าง', 'ผัดกระเทียมพริกไทย', 'ผัดพริกแกง', 'ต้มยำ'], 'สะโพกไก่ลอกหนัง': ['ย่าง', 'ผัดกระเทียมพริกไทย', 'ผัดพริกแกง', 'ต้มยำ', 'อบสมุนไพร'] };
// หมวดโปรตีน — กันมื้อซ้ำหมวดในวันเดียว (เช่น เช้าหอยลาย เที่ยงหอยแมลงภู่ = หมวด "ทะเล" ซ้ำ)
const PGRP = { 'อกไก่ (สุก)': 'ไก่', 'สะโพกไก่ลอกหนัง': 'ไก่', 'อกเป็ดลอกหนัง (ย่าง)': 'ไก่', 'ปลานิล (สุก)': 'ปลา', 'ปลาแซลมอน': 'ปลา', 'ทูน่ากระป๋องในน้ำ': 'ปลา', 'ปลากะพง': 'ปลา', 'ปลาทูนึ่ง': 'ปลา', 'ปลาดุกย่าง (เลี้ยง)': 'ปลา', 'ปลาซาบะย่าง': 'ปลา', 'กุ้งขาว': 'ทะเล', 'ปลาหมึก': 'ทะเล', 'หอยแมลงภู่ลวก': 'ทะเล', 'หอยลายลวก': 'ทะเล', 'ปูม้านึ่ง': 'ทะเล', 'หมูสันใน': 'หมู', 'เนื้อวัวไม่ติดมัน': 'เนื้อ', 'เต้าหู้แข็ง': 'พืช', 'เต้าหู้ขาวอ่อน': 'พืช', 'เอ็นดามาเมะ (ถั่วแระต้ม)': 'พืช', 'ถั่วเหลืองต้ม': 'พืช' };
const pgrp = th => PGRP[th] || th;
// ===== ปรับมื้อเอง: เพิ่ม/สลับอาหาร แล้ว "เกลี่ยมาโครใหม่" =====
const ORD = { shake: -1, protein: 0, carb: 1, veg: 2, fruit: 3, fat: 4 };
const CATLABEL = { protein: 'โปรตีน', carb: 'คาร์บ', veg: 'ผัก', fruit: 'ผลไม้', fat: 'ไขมัน/ถั่ว' };
const CATFOODS = ['protein', 'carb', 'veg', 'fruit', 'fat'].reduce((o, c) => (o[c] = DB[c].map(f => ({ ...f, cat: c })), o), {}); // อาหารต่อหมวด (ติด cat)
const itemToFood = it => ({ th: it.th, cat: it.cat, kcal: it.ref.kcal, p: it.ref.p, c: it.ref.c, f: it.ref.f, u: it.u, ug: it.ug, max: it.mx, src: it.src, conf: it.conf });
// เกลี่ย portion ของชุดอาหารให้เข้าเป้ามาโครของมื้อ (คาร์บ→ผัก/ผลไม้→โปรตีน(+ไข่เสริม)→ไขมัน)
function allocMeal(foods, tgt, snack, cfg) {
  const items = []; const sP = () => items.reduce((s, x) => s + x.p, 0), sC = () => items.reduce((s, x) => s + x.c, 0), sF = () => items.reduce((s, x) => s + x.f, 0);
  foods.filter(f => f.cat === 'shake').forEach(f => items.push(mkShake(f)));  // เชค Nutrilite = ของตายตัว ใส่ก่อน มาโครนับเข้าเลย
  const carbs = foods.filter(f => f.cat === 'carb'), remC = Math.max(0, (tgt.c || 0) - sC());
  carbs.forEach(f => { const share = remC / carbs.length; items.push(mk(f, f.c > 0 ? clamp(share / (f.c / 100), 10, f.max) : (f.ug || 50))); });
  foods.filter(f => f.cat === 'veg').forEach(f => items.push(mk(f, 130)));
  foods.filter(f => f.cat === 'fruit').forEach(f => items.push(mk(f, 100)));
  const prots = foods.filter(f => f.cat === 'protein');
  prots.forEach((f, idx) => { const per = (tgt.p - sP()) / Math.max(1, prots.length - idx); items.push(mk(f, f.p > 0 ? clamp(per / (f.p / 100), 15, f.max) : (f.ug || 50))); });
  if (!snack && sP() < tgt.p - 5 && okFood(DB.protein[1], cfg) && !foods.some(f => f.th === DB.protein[1].th) && !foods.some(f => f.cat === 'shake')) { const e = { ...DB.protein[1], cat: 'protein' }; items.push(mk(e, clamp((tgt.p - sP()) / (e.p / 100), 55, e.max))); } // เติมไข่ครั้งเดียว — เช็ค cfg ด้วย (วีแกน/แพ้ไข่ ไม่เติม)
  const fats = foods.filter(f => f.cat === 'fat');
  fats.forEach(f => { const need = tgt.f - sF(); items.push(mk(f, (need > 1 && f.f > 0) ? clamp(need / (f.f / 100), 3, f.max) : (f.ug || 10))); });
  return items.sort((a, b) => ORD[a.cat] - ORD[b.cat]);
}
function rebuildMeal(m, foods, cfg) {
  const items = allocMeal(foods, m.tgt, m.snack, cfg);
  const mainP = items.filter(x => x.cat === 'protein').sort((a, b) => b.g - a.g)[0];
  const carb0 = items.find(x => x.cat === 'carb');
  const style = m.snack ? '' : (PSTYLE[mainP ? mainP.th : 'อกไก่ (สุก)'] || ['ย่าง'])[0];
  return {
    ...m, items, tot: reTot(items), main: mainP ? mainP.th : '', style, edited: true,
    sig: (mainP ? mainP.th : '') + '|' + style + '|' + (carb0 ? carb0.th : '') + '|edit'
  };
}
// ===== UP Labs Shake (โปรตีนเชค Nutrilite) — ใส่/แทนมื้อ แล้วเกลี่ยทั้งวัน =====
// ค่าต่อหน่วยจากฉลากจริง Amway Thailand (Bodykey + Green Tea ยืนยันจากฉลาก 2026-06-25 · All Plant จาก USDA/ฉลาก)
const SHAKEBASE = {
  bk: { th: 'Bodykey', per: 'ซอง', kcal: 205, p: 17, c: 23, f: 6, conf: 'verified' },          // ฉลาก 1 ซอง 51g = 205kcal/17p/23c/6f
  ap: { th: 'All Plant Protein', per: 'ช้อน', kcal: 40, p: 8, c: 1, f: 0.5, conf: 'verified' }, // 1 ช้อน ~10g (USDA/ฉลาก)
  gt: { th: 'Green Tea Protein', per: 'ช้อน', kcal: 110, p: 10.5, c: 13, f: 2, conf: 'verified' }, // ฉลาก 2 ช้อน 56g=220/21/26/4 ÷2
};
const SHAKEMIX = [
  [['bk', 0.5], ['ap', 2]], [['bk', 0.5], ['ap', 3]], [['bk', 0.5], ['ap', 1], ['gt', 1]],
  [['bk', 1], ['ap', 2]], [['bk', 1], ['ap', 1], ['gt', 1]],
  [['ap', 2]], [['ap', 1], ['gt', 1]], [['gt', 2]],
];
const qstr = q => q === 0.5 ? '½' : String(q);
const SHAKEFOODS = SHAKEMIX.map(mix => {
  let kcal = 0, p = 0, c = 0, f = 0, allv = true; const parts = mix.map(([k, q]) => { const b = SHAKEBASE[k]; kcal += b.kcal * q; p += b.p * q; c += b.c * q; f += b.f * q; if (b.conf !== 'verified') allv = false; return b.th + ' ' + qstr(q) + ' ' + b.per; });
  return { th: parts.join(' + '), cat: 'shake', kcal: Math.round(kcal), p: r1(p), c: r1(c), f: r1(f), u: 'แก้ว', ug: 1, max: 1, fixed: 1, src: 'Nutrilite (ฉลาก Amway TH)', conf: allv ? 'verified' : 'estimate' };
});
const mkShake = s => ({ th: s.th, cat: 'shake', u: 'แก้ว', ug: 1, mx: 1, src: s.src, conf: s.conf, g: 1, p: r1(s.p), c: r1(s.c), f: r1(s.f), kcal: Math.round(s.kcal), ref: { kcal: s.kcal, p: s.p, c: s.c, f: s.f }, fixed: 1 });
// สร้างมื้อ anchor จากเชค: replace = เชคล้วน · add = ของเดิม + เชค
function shakeMeal(m, shake, mode) {
  const items = mode === 'replace' ? [mkShake(shake)] : [...m.items.filter(x => x.cat !== 'shake'), mkShake(shake)].sort((a, b) => ORD[a.cat] - ORD[b.cat]);
  return { ...m, items, tot: reTot(items), main: '', style: '', edited: true, shake: 1, sig: (mode === 'replace' ? '' : m.sig + '+') + shake.th + '|shk' };
}
// เกลี่ยทั้งวัน: ตรึงมื้อ anchor (เชค) แล้วแบ่งงบมาโครที่เหลือให้มื้ออื่นตามสัดส่วน frac → สร้างใหม่ (คงวัตถุดิบเดิม ปรับ portion)
function rebalanceDay(curDay, t, goal, even3, anchorIdx, anchorMeal, cfg) {
  const plan = mealPlan(goal, even3); const am = anchorMeal.tot;
  const others = curDay.map((_, i) => i).filter(i => i !== anchorIdx);
  const fSum = others.reduce((s, i) => s + plan[i].frac, 0) || 1;
  const remP = Math.max(0, t.p - am.p), remC = Math.max(0, t.c - am.c), remF = Math.max(0, t.f - am.f);
  return curDay.map((m, i) => {
    if (i === anchorIdx) return anchorMeal;
    const w = plan[i].frac / fSum; const tgt = { p: r1(remP * w), c: r1(plan[i].carb ? remC * w : 0), f: r1(remF * w) };
    const foods = m.items.filter(x => x.cat !== 'shake').map(itemToFood);
    const items = allocMeal(foods, tgt, m.snack, cfg);
    const mainP = items.filter(x => x.cat === 'protein').sort((a, b) => b.g - a.g)[0]; const carb0 = items.find(x => x.cat === 'carb');
    const style = m.snack ? '' : (PSTYLE[mainP ? mainP.th : 'อกไก่ (สุก)'] || ['ย่าง'])[0];
    return { ...m, tgt, items, tot: reTot(items), main: mainP ? mainP.th : '', style, edited: true, sig: (mainP ? mainP.th : '') + '|' + style + '|' + (carb0 ? carb0.th : '') + '|rb' };
  });
}
function buildDay(t, goal, even3, seed, cfg) {
  const plan = mealPlan(goal, even3);
  const F = f => okFood(f, cfg);                                             // v4: ผ่านเงื่อนไข diet/แพ้ไหม
  const mainProt = DB.protein.filter(p => p.hero).filter(F);                   // เนื้อแน่นเป็นพระเอก (กรองตาม cfg)
  const eggOK = F(DB.protein[1]);                                           // ไข่ผ่านไหม (วีแกน/แพ้ไข่ = ไม่ผ่าน)
  const egg = tag([DB.protein[1]], 'protein')[0];
  const fatFill = tag([DB.fat[0], DB.fat[1]].filter(F), 'fat');                // น้ำมัน (พืช ผ่านเสมอ)
  const carbFill = tag(DB.carb.filter(c => c.sv).filter(F), 'carb');            // คาร์บมื้อคาว
  const vegPool = DB.veg.map(f => ({ ...f, cat: 'veg' })).filter(F);               // ผัก — ติด cat ก่อนกรอง ไม่งั้น okFood เช็ค noVeg ไม่เจอ (noVeg/แพ้ = อาจว่าง)
  const fruitPool = (DB.fruit || []).filter(F);
  const snkpPool = DB.protein.filter(p => p.snkp).filter(F);                   // โปรตีนของว่าง
  const snkFat = DB.fat.filter(f => f.snk).filter(F);                          // ถั่ว/เมล็ดของว่าง (แพ้ถั่ว=เหลือเมล็ด)
  const shakeMeals = [];                                                      // มื้อที่บังคับใส่เชค (resolve เช้า=มื้อแรก · เย็น=มื้อคาวสุดท้าย)
  if (cfg && cfg.shake && cfg.shake.on) {
    const lastMain = plan.map((m, ix) => m.snack ? -1 : ix).filter(x => x >= 0).pop();
    if (cfg.shake.breakfast) shakeMeals.push(0);
    if (cfg.shake.dinner && lastMain > 0 && lastMain !== 0) shakeMeals.push(lastMain);
  }
  const ord = { shake: -1, protein: 0, carb: 1, veg: 2, fruit: 3, fat: 4 };
  const usedGrp = new Set(); // หมวดโปรตีนที่ใช้ไปแล้วในวันนี้ — กันมื้อซ้ำหมวด
  const day = plan.map((m, i) => {
    const mP = t.p * m.frac, mC = (m.carb ? t.c * m.frac : 0), mF = t.f * m.frac;
    let items = [];
    const sP = () => items.reduce((s, x) => s + x.p, 0), sC = () => items.reduce((s, x) => s + x.c, 0), sF = () => items.reduce((s, x) => s + x.f, 0);
    // 0) v4 force-shake: ใส่เชคก่อน (มาโครนับเข้าเลย) แล้วเติมส่วนที่เหลือให้พอดีเป้า
    const forced = shakeMeals.includes(i);
    if (forced) {
      let sp = SHAKEFOODS;
      if (cfg && (cfg.diet === 'vegan' || cfg.diet === 'vegetarian' || (cfg.allergy || []).includes('dairy'))) sp = SHAKEFOODS.filter(s => !/Bodykey|Green Tea/.test(s.th)); // เลี่ยง Bodykey (นม)/Green Tea (ฐานไม่ชัด) — ใช้ All Plant Protein ล้วน
      items.push(mkShake(pick(sp.length ? sp : SHAKEFOODS, seed + i + 9)));
    }
    // 1) คาร์บก่อน — ใช้คาร์บโปรตีนต่ำ จะได้ไม่ดันโปรตีนรวมเกินเป้า (หักของที่มีอยู่ เช่น เชค)
    if (m.carb && carbFill.length) {
      let rC = mC; if (m.carbCap) rC = Math.min(rC, m.carbCap); rC -= sC();
      if (rC > 4) { const carb = pick(carbFill, seed + i + 1); items.push(mk(carb, clamp(rC / (carb.c / 100), 15, carb.max))); }
    }
    // 2) ผักให้ปริมาตร (noVeg/แพ้ = ข้ามถ้า pool ว่าง)
    if (!m.snack && vegPool.length) { const veg = pick(tag(vegPool, 'veg'), seed + i + 2); items.push(mk(veg, 130)); }
    if (m.snack && fruitPool.length) { const fr = pick(tag(fruitPool, 'fruit'), seed + i + 6); items.push(mk(fr, 100)); }  // ของว่าง = โยเกิร์ต/เวย์ + ผลไม้ + ถั่ว
    // 3) โปรตีน — เติมให้ถึงเป้า (มีเพดานต่อชนิด=สมจริง)
    const protList = m.snack ? tag(snkpPool, 'protein') : tag(mainProt, 'protein');
    if (protList.length) {
      let prot = pick(protList, seed + i + 4);
      if (!m.snack) { // เลือกพระเอกที่ "หมวด" ยังไม่ถูกใช้ในวันนี้
        const b = ((seed + i + 4) % protList.length + protList.length) % protList.length;
        for (let k = 0; k < protList.length; k++) { const c = protList[(b + k) % protList.length]; if (!usedGrp.has(pgrp(c.th))) { prot = c; break; } }
        usedGrp.add(pgrp(prot.th));
      }
      if (mP - sP() > 2) items.push(mk(prot, clamp((mP - sP()) / (prot.p / 100), 20, prot.max)));
    }
    // เติม "ไข่" 1 ครั้งถ้าโปรตีนยังขาด >5g (ถ้าไข่ผ่านเงื่อนไข)
    if (!m.snack && eggOK && sP() < mP - 5) { const n = (mP - sP()) / (egg.p / 100); items.push(mk(egg, clamp(n, 55, egg.max))); }
    // 4) ไขมัน = เติมส่วนที่เหลือ (ของว่างใช้ถั่ว/เมล็ด · มื้อคาว = น้ำมัน)
    let rF = mF - sF();
    if (rF > 2) { const fl = m.snack ? snkFat : fatFill; if (fl.length) { const fat = pick(fl, seed + i + 5); items.push(mk(fat, clamp(rF / (fat.f / 100), 3, fat.max))); } }
    items.sort((a, b) => ord[a.cat] - ord[b.cat]);
    const mainP = items.filter(x => x.cat === 'protein').sort((a, b) => b.g - a.g)[0];
    const style = m.snack ? '' : pick(PSTYLE[mainP ? mainP.th : 'อกไก่ (สุก)'] || ['ย่าง'], seed + i + 3);
    const carb0 = items.find(x => x.cat === 'carb');
    return {
      name: m.name, snack: m.snack, style, main: mainP ? mainP.th : '', items, tot: reTot(items),
      tgt: { p: r1(mP), c: r1(mC), f: r1(mF) }, sig: (forced ? 'shk:' : '') + (mainP ? mainP.th : '') + '|' + style + '|' + (carb0 ? carb0.th : '')
    };
  });
  // 6) ปรับ portion ปิดส่วนต่าง kcal/วัน ภายในเพดานสมจริง (เกลี่ยน้ำมัน → ตามด้วยข้าว)
  const adj = (it, ng) => { const rf = it.ref; Object.assign(it, { g: Math.round(ng), p: r1(rf.p * ng / 100), c: r1(rf.c * ng / 100), f: r1(rf.f * ng / 100), kcal: Math.round(rf.kcal * ng / 100) }); };
  const dayK = () => day.reduce((s, m) => s + m.tot.kcal, 0);
  let gap = t.kcal - dayK();
  if (gap > t.kcal * 0.02) {
    // 1) เติมคาร์บก่อน (กินจริงได้กว่าเทน้ำมัน) — ข้าวเดิมเต็มแล้วเติม "มันเทศ" เป็นคาร์บที่ 2 (ข้าว+มันเทศ = ปกติ)
    for (const m of day) {
      if (gap < t.kcal * 0.015) break; if (m.snack || m.carbCap) continue;
      let it = m.items.filter(x => x.cat === 'carb').find(x => x.mx - x.g > 1);
      if (!it) { it = mk({ ...DB.carb[2], _cat: 'carb' }, 0); m.items.push(it); m.items.sort((a, b) => ord[a.cat] - ord[b.cat]); }
      const room = it.mx - it.g; if (room <= 1) continue;
      const addG = Math.min(room, gap / (it.ref.kcal / 100)); adj(it, it.g + addG); m.tot = reTot(m.items); gap = t.kcal - dayK();
    }
    // 2) ยังขาด → เพิ่ม "น้ำมันเดิม" ของมื้อ (ไม่เกินเพดาน 30g)
    for (const m of day) {
      if (gap < t.kcal * 0.015) break; if (m.snack) continue;
      let it = m.items.find(x => x.cat === 'fat' && /น้ำมัน/.test(x.th)); if (!it) continue;
      const room = it.mx - it.g; if (room <= 1) continue;
      const addG = Math.min(room, gap / (it.ref.kcal / 100)); adj(it, it.g + addG); m.tot = reTot(m.items); gap = t.kcal - dayK();
    }
  } else if (gap < -t.kcal * 0.025) {              // เกิน → ลดน้ำมันก้อนใหญ่สุด
    let best = null; day.forEach(m => m.items.forEach(it => { if (it.cat === 'fat' && (!best || it.g > best.it.g)) best = { m, it }; }));
    if (best) { adj(best.it, clamp(best.it.g + gap / (best.it.ref.kcal / 100), 0, best.it.mx)); best.m.tot = reTot(best.m.items); }
  }
  return day;
}

// ===== เครื่องเจนแผนหลายวัน "ไม่ซ้ำ" =====
function buildPlan(t, goal, even3, days, baseSeed, cfg) {
  const plan = [];
  for (let d = 0; d < days; d++) plan.push(buildDay(t, goal, even3, baseSeed + d * 17 + 1, cfg));
  return plan;
}
// v4: นับ pool ที่เหลือหลังกรอง → เตือนถ้าน้อยเกินจนคุณภาพแผนหย่อน
function poolHealth(cfg) {
  const F = f => okFood(f, cfg);
  const hero = DB.protein.filter(p => p.hero && F(p)).length, snkp = DB.protein.filter(p => p.snkp && F(p)).length;
  const carb = DB.carb.filter(c => c.sv && F(c)).length, veg = DB.veg.map(f => ({ ...f, cat: 'veg' })).filter(F).length;
  return { hero, snkp, carb, veg, tight: hero < 3 || carb < 2, veryTight: hero < 2 };
}
function planVariety(plan) {
  const sigs = []; const proteins = new Set();
  plan.forEach(day => day.forEach(m => { if (!m.snack) sigs.push(m.sig); m.items.forEach(it => { if (it.cat === 'protein') proteins.add(it.th); }); }));
  const distinct = new Set(sigs).size;
  return { total: sigs.length, distinct, pct: sigs.length ? Math.round(distinct / sigs.length * 100) : 0, proteins: proteins.size };
}

// ===== ภาพจานแสดง portion =====
// รวมกรัมตามหมวด → ชิ้นสัดส่วน
function catSlices(items) {
  // สัดส่วนตาม "พลังงาน" P:C:F (โปรตีน/คาร์บ ×4 kcal/g · ไขมัน ×9) — ผักรวมเข้าคาร์บ/โปรตีนของมันเอง · g=พลังงาน(kcal) ใช้ตีวงพาย
  const e = { protein: items.reduce((s, it) => s + it.p, 0) * 4, carb: items.reduce((s, it) => s + it.c, 0) * 4, fat: items.reduce((s, it) => s + it.f, 0) * 9 };
  const cats = ['protein', 'carb', 'fat'];
  const total = cats.reduce((s, c) => s + e[c], 0) || 1;
  return cats.map(c => ({ cat: c, g: Math.round(e[c]), pct: Math.round(e[c] / total * 100), color: (CAT[c] || {}).c || '#8A838E', label: (CAT[c] || {}).label || c }));
}
// จานกลม Healthy Plate — เฉพาะวงจาน (legend แยกไป component Legend)
function Plate({ items }) {
  const cx = 80, cy = 80, r = 74, rad = a => (a - 90) * Math.PI / 180;
  const cats = catSlices(items); const total = cats.reduce((s, x) => s + x.g, 0) || 1;
  let acc = 0; const slices = cats.map(c => { const a0 = acc / total * 360; acc += c.g; return { ...c, a0, a1: acc / total * 360 }; });
  const arc = (a0, a1) => {
    const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0)), x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1)), lg = a1 - a0 > 180 ? 1 : 0;
    return `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${lg} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
  };
  return (
    <svg viewBox="0 0 160 160" width="148" height="148" className="shrink-0" role="img" aria-label="สัดส่วนพลังงาน P:C:F">
      <circle cx={cx} cy={cy} r={r + 3} fill="#FFFFFF" stroke="rgba(31,30,27,0.10)" strokeWidth="2" />
      {slices.length === 1
        ? <circle cx={cx} cy={cy} r={r} fill={slices[0].color} fillOpacity="0.9" />
        : slices.map((s, i) => <path key={i} d={arc(s.a0, s.a1)} fill={s.color} fillOpacity="0.9" stroke="#FFFFFF" strokeWidth="2" />)}
      {slices.map((s, i) => {
        if (s.pct < 9) return null; const mid = (s.a0 + s.a1) / 2, lx = cx + r * 0.6 * Math.cos(rad(mid)), ly = cy + r * 0.6 * Math.sin(rad(mid));
        return <text key={'p' + i} x={lx.toFixed(1)} y={(ly + 4).toFixed(1)} textAnchor="middle" fontSize="13" fontWeight="700" fill="#FFFFFF">{s.pct}%</text>;
      })}
    </svg>
  );
}
// ป้ายสัดส่วน (Healthy Plate label) — วางทางซ้าย
function Legend({ items }) {
  return (<div className="space-y-2 min-w-[120px]">
    {catSlices(items).map(s => (
      <div key={s.cat} className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-ink"><span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />{LANG === 'en' ? (CATL_EN[s.label] || s.label) : s.label}</span>
        <span className="text-ink-60 tabular-nums whitespace-nowrap">{s.pct}%</span>
      </div>))}
  </div>);
}
function Bar({ items }) {
  const total = items.reduce((s, x) => s + x.g, 0) || 1;
  return (<div className="flex w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(31,30,27,0.07)' }}>
    {items.map((it, i) => (<div key={i} title={`${it.th} ${it.g}g`} style={{ width: `${it.g / total * 100}%`, background: (CAT[it.cat] || {}).c || '#8A838E', opacity: .9 }} />))}
  </div>);
}
const Chip = ({ c, children }) => (<span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: c + '1A', color: c, border: '1px solid ' + c + '33' }}>{children}</span>);

const COOK = { 'ย่าง': 'grilled', 'ต้มยำ': 'in spicy tom-yum soup', 'ผัดกระเทียมพริกไทย': 'stir-fried with garlic and pepper', 'นึ่งซีอิ๊ว': 'steamed with light soy sauce', 'อบสมุนไพร': 'herb-roasted', 'ลวกจิ้มแจ่ว': 'blanched, served with spicy nam-jim dip', 'ผัดพริกแกง': 'stir-fried in red curry paste', 'ต้มจืด': 'in a clear broth', 'ยำ': 'in a spicy Thai salad (yum)', 'เจียว': 'as a fluffy Thai omelette', 'ดาว': 'as a fried egg', 'ต้ม': 'boiled', 'ทอด': 'crispy pan-fried', 'ราดพริก': 'topped with Thai sweet chili sauce' };
const EN = { 'อกไก่ (สุก)': 'grilled chicken breast', 'ไข่ไก่ทั้งฟอง': 'whole eggs', 'ไข่ขาว': 'egg whites', 'ปลานิล (สุก)': 'tilapia fillet', 'ปลาแซลมอน': 'salmon', 'หมูสันใน': 'pork tenderloin', 'เนื้อวัวไม่ติดมัน': 'lean beef', 'กุ้งขาว': 'shrimp', 'ทูน่ากระป๋องในน้ำ': 'canned tuna', 'เต้าหู้แข็ง': 'firm tofu', 'กรีกโยเกิร์ตจืด': 'plain Greek yogurt', 'เวย์โปรตีน': 'whey protein', 'ข้าวสวย': 'steamed jasmine rice', 'ข้าวกล้อง': 'brown rice', 'มันเทศ (สุก)': 'sweet potato', 'ข้าวโอ๊ต (ดิบ)': 'oats', 'ขนมปังโฮลวีต': 'whole-wheat bread', 'กล้วย': 'banana', 'บรอกโคลี': 'broccoli', 'ผักบุ้ง': 'morning glory', 'คะน้า': 'Chinese kale', 'กะหล่ำปลี': 'cabbage', 'เห็ดออรินจิ': 'king oyster mushroom', 'ผักกาดขาว': 'napa cabbage', 'น้ำมันมะกอก': 'olive oil', 'น้ำมันรำข้าว': 'rice bran oil', 'อะโวคาโด': 'avocado', 'อัลมอนด์': 'almonds', 'เมล็ดฟักทอง': 'pumpkin seeds', 'ปลากะพง': 'sea bass fillet', 'ปลาทูนึ่ง': 'steamed mackerel', 'ปลาหมึก': 'squid', 'สะโพกไก่ลอกหนัง': 'skinless chicken thigh', 'ข้าวไรซ์เบอร์รี': 'riceberry purple rice', 'มันฝรั่ง (สุก)': 'boiled potato', 'เส้นก๋วยเตี๋ยว (ลวก)': 'rice noodles', 'วุ้นเส้น (ลวก)': 'glass noodles', 'แตงกวา': 'cucumber', 'มะเขือเทศ': 'tomato', 'เห็ดหอม': 'shiitake mushroom', 'ถั่วฝักยาว': 'yardlong beans', 'ฟักเขียว': 'winter melon', 'พริกหวาน': 'bell pepper', 'ฟักทอง (สุก)': 'pumpkin', 'เม็ดมะม่วงหิมพานต์': 'cashews', 'งา': 'sesame seeds', 'ปลาดุกย่าง (เลี้ยง)': 'grilled catfish', 'ปลาซาบะย่าง': 'grilled saba mackerel', 'หอยแมลงภู่ลวก': 'steamed mussels', 'หอยลายลวก': 'blanched clams', 'ปูม้านึ่ง': 'steamed blue crab', 'เอ็นดามาเมะ (ถั่วแระต้ม)': 'boiled edamame', 'ถั่วเหลืองต้ม': 'boiled soybeans', 'อกเป็ดลอกหนัง (ย่าง)': 'grilled skinless duck breast', 'เต้าหู้ขาวอ่อน': 'soft tofu', 'คอตเทจชีส (ไขมัน 2%)': 'cottage cheese', 'นมจืด (โฮลมิลค์)': 'glass of milk', 'นมถั่วเหลืองไม่หวาน': 'unsweetened soy milk', 'ข้าวเหนียวสุก': 'steamed sticky rice', 'ข้าวโพดหวานต้ม': 'boiled sweet corn', 'เผือกต้ม': 'boiled taro', 'ควินัวสุก': 'cooked quinoa', 'เส้นใหญ่สุก': 'wide rice noodles', 'ลูกเดือยสุก': "cooked job's tears", 'ขนมจีน': 'fermented rice noodles', 'มันสำปะหลังต้ม': 'boiled cassava', 'ดอกกะหล่ำ': 'cauliflower', 'แครอท': 'carrot', 'มะเขือยาว': 'eggplant', 'มะระ': 'bitter gourd', 'ถั่วงอก': 'bean sprouts', 'ผักกาดหอม': 'lettuce', 'กวางตุ้ง': 'pak choi', 'ผักโขม': 'amaranth greens', 'หน่อไม้ต้ม': 'boiled bamboo shoots', 'ข้าวโพดอ่อน': 'baby corn', 'เห็ดเข็มทอง': 'enoki mushrooms', 'เห็ดฟาง': 'straw mushrooms', 'บวบ': 'luffa gourd', 'ขึ้นฉ่าย': 'Chinese celery', 'ตำลึง (ใบ)': 'ivy gourd leaves', 'แอปเปิล': 'apple', 'ส้ม': 'orange', 'มะละกอสุก': 'ripe papaya', 'ฝรั่ง': 'guava', 'แตงโม': 'watermelon', 'สับปะรด': 'pineapple', 'มะม่วงสุก': 'ripe mango', 'องุ่น': 'grapes', 'สตรอเบอร์รี': 'strawberries', 'แก้วมังกร': 'dragon fruit', 'วอลนัท': 'walnuts', 'ถั่วลิสง': 'peanuts', 'เนยถั่ว': 'peanut butter', 'เมล็ดทานตะวัน': 'sunflower seeds', 'เมล็ดเจีย': 'chia seeds' };
const en = it => EN[it.th] || it.th.replace(/\s*\(.*?\)\s*/g, '').trim();
const FRUIT = new Set(['กล้วย', 'มะละกอ', 'ฝรั่ง', 'แอปเปิล', 'ส้ม']);
const DAIRY = new Set(['กรีกโยเกิร์ตจืด', 'นมจืด', 'คอตเทจชีส (ไขมัน 2%)', 'นมจืด (โฮลมิลค์)', 'นมถั่วเหลืองไม่หวาน']);
const SEED = new Set(['อัลมอนด์', 'เมล็ดฟักทอง']);
function buildImagePrompt(m) {
  const oils = m.items.filter(it => /น้ำมัน/.test(it.th));
  const fruit = m.items.filter(it => it.cat === 'fruit' || FRUIT.has(it.th));
  const dairy = m.items.filter(it => DAIRY.has(it.th));
  const seeds = m.items.filter(it => it.cat === 'fat' && !oils.includes(it) && it.th !== 'อะโวคาโด');
  const savory = m.items.filter(it => !oils.includes(it) && !fruit.includes(it) && !dairy.includes(it) && !seeds.includes(it));
  const parts = [];
  if (savory.length) {
    const cook = m.style ? (' ' + (COOK[m.style] || m.style)) : '';
    const oilTxt = oils.length ? `, lightly cooked with ${oils.map(o => en(o)).join(' and ')}` : '';
    parts.push(`a white ceramic plate of ${savory.map(it => `${it.g}g ${en(it)}`).join(', ')}${cook}${oilTxt}, protein-first plating`);
  }
  if (dairy.length) {
    const top = seeds.length ? ` topped with ${seeds.map(s => en(s)).join(' and ')}` : '';
    parts.push(`a separate small bowl of ${dairy.map(d => `${d.g}g ${en(d)}`).join(' and ')}${top}`);
  } else if (seeds.length) {
    parts.push(`a small separate side dish of ${seeds.map(s => en(s)).join(' and ')}`);
  }
  if (fruit.length) parts.push(`a separate small bowl of fresh ${fruit.map(f => en(f)).join(' and ')} on the side`);
  return `Minimalist top-down food photograph on a plain neutral light-wood table, soft natural daylight: ${parts.join('; and ')}. IMPORTANT: show ONLY these exact dishes and nothing else — no rice, no noodles, no extra plates, no additional food or garnish that is not listed above. Each dish sits in its own separate plate or bowl, placed clearly apart, never mixed together. Realistic true-to-life portions, fresh and appetizing, clean professional food photography, 50mm lens, shallow depth of field, high detail. No text, no hands, no cutlery clutter, not an illustration.`;
}
// จำรูปที่ gen แล้วตาม "เนื้อเมนู" (ชื่อ+วิธีทำ+วัตถุดิบ+กรัม) ไม่ใช่ตำแหน่งมื้อ → เปลี่ยนวันแล้วรูปไม่ติดมามั่ว · เมนูที่เคย gen เก็บไว้ ไม่ gen ซ้ำ
const IMG_CACHE = {};            // sig -> dataURI : in-memory L1 (เร็ว ระหว่าง session)
const IMG_INFLIGHT = new Set();  // sig ที่กำลังสร้างอยู่ กันยิงซ้ำ
const mealSig = (m) => (m.name || '') + '|' + (m.style || '') + '|' + (m.items || []).map(it => it.th + ':' + it.g).join(',');
// L2: เก็บรูปถาวรใน IndexedDB ของเบราว์เซอร์ — อยู่ข้าม refresh/ปิด-เปิด · จุได้เยอะกว่า localStorage มาก · ถ้าเบราว์เซอร์บล็อกก็คืน null/ไม่ทำอะไร แอปไม่พัง
const IDB = (() => {
  let dbp;
  const open = () => { if (typeof indexedDB === 'undefined') return Promise.reject(); return dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('plateplanner', 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('img')) r.result.createObjectStore('img'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); };
  const st = (mode) => open().then(db => db.transaction('img', mode).objectStore('img'));
  return {
    get: (k) => st('readonly').then(s => new Promise(res => { const r = s.get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); })).catch(() => null),
    set: (k, v) => st('readwrite').then(s => s.put(v, k)).catch(() => { }),
    del: (k) => st('readwrite').then(s => s.delete(k)).catch(() => { }),
  };
})();
// L3: แคชกลางข้ามเครื่อง/ข้ามผู้ใช้ (Supabase Storage public) — hash sig แบบเดียวกับ backend (SHA-256 hex) → public URL ของรูปเมนูนี้
const SB_PUBLIC = 'https://qzqvwbucjxwgtmbdkrlu.supabase.co/storage/v1/object/public/meal-images/';
async function sigUrl(sig) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sig));
    return SB_PUBLIC + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('') + '.png';
  } catch (e) { return null; }  // ไม่มี SubtleCrypto (insecure context) → ข้าม L3 เฉย ๆ ไม่พัง
}
function MealCard({ m, onEdit, onReset, edited, onShake, cfg }) {
  const sig = mealSig(m);
  const [showP, setShowP] = useState(false), [zoom, setZoom] = useState(false);
  const [editing, setEditing] = useState(false), [emode, setEmode] = useState('replace'), [esel, setEsel] = useState(''), [shsel, setShsel] = useState('');
  const applyEdit = () => {
    if (!esel || !onEdit) return; const bar = esel.indexOf('|'); const food = (CATFOODS[esel.slice(0, bar)] || []).find(f => f.th === esel.slice(bar + 1)); if (!food) return;
    const foods = emode === 'replace' ? m.items.map(itemToFood).filter(f => f.cat !== 'protein').concat([food]) : m.items.map(itemToFood).concat([food]);
    onEdit(rebuildMeal(m, foods, cfg)); setEditing(false); setEsel('');
  };
  const [img, setImg] = useState(() => IMG_CACHE[sig] || null), [loading, setLoading] = useState(false), [err, setErr] = useState(null);
  const sigRef = useRef(sig); sigRef.current = sig;
  // เปลี่ยนเมนู (เปลี่ยนวัน/สุ่มใหม่/refresh) → ดึงรูป: L1 ก่อน · ไม่มีค่อยถาม IndexedDB (รูปที่เคย gen ไว้รอบก่อน) · ว่างถ้ายังไม่เคย gen
  useEffect(() => {
    setErr(null); setZoom(false); setLoading(IMG_INFLIGHT.has(sig));
    if (IMG_CACHE[sig]) { setImg(IMG_CACHE[sig]); return; }
    setImg(null);
    let alive = true;
    IDB.get(sig).then(v => {
      if (v) { if (alive && sigRef.current === sig) { IMG_CACHE[sig] = v; setImg(v); } return; }
      // L3: ลองโหลดรูปจากแคชกลางตรง ๆ — ถ้ามีคน gen เมนูนี้ไว้แล้ว (เครื่องไหนก็ได้) รูปจะเด้งขึ้นเอง ไม่ต้องเสียเงิน gen
      sigUrl(sig).then(url => {
        if (!url || !alive || sigRef.current !== sig) return;
        const probe = new Image();
        probe.onload = () => { if (alive && sigRef.current === sig) { IMG_CACHE[sig] = url; IDB.set(sig, url); setImg(url); } };
        probe.src = url;  // ไม่มีในแคชกลาง → onerror เงียบ ๆ → คงปุ่ม gen ไว้
      });
    });
    return () => { alive = false; };
  }, [sig]);
  const genImage = () => {
    const s = sig;
    if (IMG_CACHE[s]) { setImg(IMG_CACHE[s]); return; }   // มีรูปแล้ว ไม่ต้องเสียเงิน gen ซ้ำ
    if (IMG_INFLIGHT.has(s)) return;                      // เมนูนี้กำลัง gen อยู่
    IMG_INFLIGHT.add(s); setLoading(true); setErr(null);
    // native: ไม่ส่ง provider/apiKey → /api/plate-image ใช้ env GEMINI_API_KEY ฝั่งเซิร์ฟเวอร์ + แคช Supabase
    fetch('/api/plate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: buildImagePrompt(m), sig: s }) })
      .then(r => r.json()).then(d => { if (d.image) { IMG_CACHE[s] = d.image; IDB.set(s, d.image); if (sigRef.current === s) setImg(d.image); } else if (sigRef.current === s) setErr(d.error || tr('สร้างภาพไม่สำเร็จ', 'Image generation failed')); })
      .catch(() => { if (sigRef.current === s) setErr(tr('เรียก backend ไม่ได้ ลองใหม่อีกครั้ง', 'Could not reach the backend, please try again')); })
      .finally(() => { IMG_INFLIGHT.delete(s); if (sigRef.current === s) setLoading(false); });
  };
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div><h3 className="text-lg font-head text-ink">{mn(m.name)}</h3>
          {m.style && <div className="text-xs text-wellness">🍳 {fnm(m.main || '')} · {stl(m.style || '')}</div>}</div>
        <div className="flex gap-1.5">
          <Chip c={CAT.protein.c}>P {Math.round(m.tot.p)}g</Chip><Chip c={CAT.carb.c}>C {Math.round(m.tot.c)}g</Chip>
          <Chip c={CAT.fat.c}>F {Math.round(m.tot.f)}g</Chip><Chip c="#5C5660">{m.tot.kcal} kcal</Chip>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 my-3">
        <Legend items={m.items} />
        <div className="text-center"><Plate items={m.items} /><div className="text-[10px] text-ink-40 mt-0.5">{tr('พลังงาน P:C:F', 'Energy P:C:F')}</div></div>
        <div className="shrink-0">
          {img
            ? <div className="relative w-[148px] h-[148px] cursor-zoom-in" onClick={() => setZoom(true)} title="คลิกขยาย + ดู portion">
                <img src={img} alt="ภาพจานอาหารเสมือนจริง" className="w-full h-full object-cover rounded-xl border border-ink/10" />
                <span className="absolute bottom-1.5 right-1.5 text-[11px] text-white rounded-md px-1.5 py-0.5" style={{ background: 'rgba(24,21,26,.6)' }}>🔍 ขยาย</span>
              </div>
            : <button onClick={genImage} disabled={loading} className="w-[148px] h-[148px] flex flex-col items-center justify-center gap-1 text-sm text-wellness glass glass-hover rounded-xl disabled:opacity-60">
                {loading ? <span className="text-ink-60">⏳ {tr('กำลังสร้าง…', 'Generating…')}</span> : <span className="flex flex-col items-center"><span className="text-2xl mb-1">🎨</span>{tr('สร้างภาพจริง', 'Generate image')}</span>}
              </button>}
          <div className="text-[10px] text-ink-40 mt-0.5 text-center w-[148px]">{img ? tr('🔍 คลิกขยาย + portion', '🔍 Tap to zoom + portions') : tr('ภาพเสมือนจริง', 'AI food image')}</div>
        </div>
      </div>
      {img && <div className="text-[11px] text-ink-40 mb-2">📷 ภาพ AI ไว้เทียบหน้าตา · <span className="text-ink-60">ปริมาณจริงดูตารางด้านล่าง</span> · <button onClick={() => { delete IMG_CACHE[sig]; IDB.del(sig); setImg(null); }} className="text-wellness underline">สร้างใหม่</button></div>}
      {err && <div className="text-xs text-amber mb-2">{err}</div>}
      <div className="border-t border-ink/5 pt-3">
        <div className="flex items-center justify-between text-[11px] text-ink-40 mb-1 px-0.5"><span>🍽️ {tr('อาหารในมื้อนี้', 'In this meal')}</span><span>{tr('ปริมาณ · กรัม · แคล', 'amount · g · kcal')}</span></div>
        {m.items.map((it, i) => {
          const es = eSplit(it); return (
            <div key={i} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-ink/5 last:border-0">
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: (CAT[it.cat] || {}).c }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1 min-w-0"><span className={"text-ink " + (it.cat === 'shake' ? 'leading-tight' : 'truncate')}>{it.cat === 'shake' ? shk(it.th) : (LANG === 'en' ? en(it) : it.th.replace(/\s*\(.*?\)/, ''))}</span>{it.conf === 'estimate' && <span className="text-amber text-[10px] shrink-0" title={'ค่าประมาณ — ' + it.src}>~</span>}</div>
                  <div className="text-[10px] leading-tight text-ink-40">{tr('พลังงาน', 'Energy')} <span style={{ color: CAT.protein.c }} className="font-semibold">{es.p}</span>:<span style={{ color: CAT.carb.c }} className="font-semibold">{es.c}</span>:<span style={{ color: CAT.fat.c }} className="font-semibold">{es.f}</span> <span className="text-ink-40">(P:C:F %)</span></div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {it.cat !== 'shake' && qtyLabel(it) && <span className="text-wellness text-xs font-medium whitespace-nowrap">{qtyLabel(it)}</span>}
                <span className={"font-medium text-ink tabular-nums text-right whitespace-nowrap " + (it.cat === 'shake' ? '' : 'w-11')}>{it.cat === 'shake' ? '1 แก้ว' : it.g + 'g'}</span>
                <span className="text-ink-40 text-xs tabular-nums w-9 text-right">{it.kcal}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs flex-wrap">
        <button onClick={() => setEditing(v => !v)} className="text-wellness glass glass-hover rounded-lg px-2.5 py-1">{editing ? tr('✕ ปิด', '✕ Close') : tr('⚙️ ปรับมื้อนี้', '⚙️ Adjust meal')}</button>
        {edited && <button onClick={onReset} className="text-ink-40 underline">{tr('↺ คืนค่าเดิม', '↺ Reset')}</button>}
        {edited && <span className="text-amber">· {tr('ปรับเอง (เกลี่ยมาโครใหม่แล้ว)', 'edited (macros rebalanced)')}</span>}
      </div>
      {editing && <div className="mt-2 glass rounded-xl p-3 space-y-2">
        <div className="flex gap-2 text-xs">
          <button onClick={() => { setEmode('replace'); setEsel(''); }} className={"rounded-lg px-2.5 py-1 " + (emode === 'replace' ? 'ring-2 ring-wellness text-wellness font-medium' : 'glass glass-hover text-ink-80')}>🔄 {tr('เปลี่ยนพระเอก', 'Swap main')}</button>
          <button onClick={() => { setEmode('add'); setEsel(''); }} className={"rounded-lg px-2.5 py-1 " + (emode === 'add' ? 'ring-2 ring-wellness text-wellness font-medium' : 'glass glass-hover text-ink-80')}>➕ {tr('เพิ่มอาหาร', 'Add food')}</button>
        </div>
        <select value={esel} onChange={e => setEsel(e.target.value)} className="w-full glass rounded-lg px-2.5 py-2 text-sm text-ink outline-none">
          <option value="">{emode === 'replace' ? tr('— เลือกโปรตีนพระเอกใหม่ —', '— pick a new main protein —') : tr('— เลือกอาหารที่จะเพิ่ม —', '— pick a food to add —')}</option>
          {emode === 'replace'
            ? CATFOODS.protein.filter(f => okFood(f, cfg)).map(f => <option key={f.th} value={'protein|' + f.th}>{LANG === 'en' ? en(f) : f.th}</option>)
            : ['protein', 'carb', 'veg', 'fruit', 'fat'].map(c => { const fl = CATFOODS[c].filter(f => okFood(f, cfg)); return fl.length ? <optgroup key={c} label={catl(CATLABEL[c])}>{fl.map(f => <option key={f.th} value={c + '|' + f.th}>{LANG === 'en' ? en(f) : f.th}</option>)}</optgroup> : null; })}
        </select>
        <button onClick={applyEdit} disabled={!esel} className="px-3 py-1.5 rounded-lg text-white text-sm disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#396755,#244438)' }}>{tr('ใช้ + เกลี่ยมาโครใหม่', 'Apply + rebalance')}</button>
        <div className="text-[10px] text-ink-40">{tr('เปลี่ยนพระเอก = สลับโปรตีนหลัก · เพิ่มอาหาร = แทรกเข้ามื้อ · ระบบปรับ portion ให้เข้าเป้ามาโครของมื้อเดิมอัตโนมัติ', 'Swap main = change the lead protein · Add food = insert into the meal · portions auto-adjust to keep the meal on its macro target')}</div>
        <div className="pt-2 mt-1 border-t border-ink/8">
          <div className="text-xs text-ink-80 mb-1">🥤 UP Labs Shake <span className="text-amber text-[10px]">{tr('(เกลี่ยทั้งวัน · ค่า~รอยืนยันฉลาก)', '(rebalances the whole day · ~values pending label confirmation)')}</span></div>
          <select value={shsel} onChange={e => setShsel(e.target.value)} className="w-full glass rounded-lg px-2.5 py-2 text-sm text-ink outline-none">
            <option value="">{tr('— เลือกสูตรเชค Nutrilite —', '— pick a Nutrilite shake —')}</option>
            {SHAKEFOODS.map((s, i) => <option key={i} value={i}>{shk(s.th)} · {s.kcal} kcal · P{s.p}</option>)}
          </select>
          <div className="flex gap-2 mt-1.5">
            <button onClick={() => { if (shsel !== '' && onShake) { onShake(SHAKEFOODS[+shsel], 'replace'); setEditing(false); setShsel(''); } }} disabled={shsel === ''} className="px-3 py-1.5 rounded-lg text-sm text-white disabled:opacity-50" style={{ background: '#8C4C4C' }}>{tr('แทนมื้อนี้ด้วยเชค', 'Replace meal with shake')}</button>
            <button onClick={() => { if (shsel !== '' && onShake) { onShake(SHAKEFOODS[+shsel], 'add'); setEditing(false); setShsel(''); } }} disabled={shsel === ''} className="px-3 py-1.5 rounded-lg text-sm text-wellness glass glass-hover disabled:opacity-50">{tr('ใส่เชคในมื้อ', 'Add shake to meal')}</button>
          </div>
        </div>
      </div>}
      {zoom && img && (
        <div onClick={() => setZoom(false)} className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5" style={{ background: 'rgba(24,21,26,0.9)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} className="relative flex flex-col lg:flex-row gap-3 lg:gap-5 rounded-2xl p-2.5 sm:p-3.5 overflow-hidden" style={{ width: 'min(96vw,940px)', maxHeight: '94vh', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)' }}>
            <button onClick={() => setZoom(false)} aria-label="ปิด" className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full text-white text-lg flex items-center justify-center" style={{ background: 'rgba(24,21,26,.94)', border: '1px solid rgba(255,255,255,.25)', cursor: 'pointer' }}>✕</button>
            <img src={img} alt={m.name} className="block w-full lg:w-auto lg:flex-1 min-w-0 self-center rounded-xl object-contain max-h-[42vh] lg:max-h-[86vh]" style={{ boxShadow: '0 24px 70px rgba(0,0,0,.5)' }} />
            <div className="lg:w-[300px] shrink-0 overflow-auto text-white pr-1">
              <div className="mb-0.5" style={{ fontFamily: "'Kanit',sans-serif", fontSize: '17px', lineHeight: 1.3 }}>{mn(m.name)}{m.style ? ' · ' + stl(m.style) : ''}</div>
              <div className="text-[12px] mb-3" style={{ color: '#BAB5BD' }}>📋 {tr('portion ในจานนี้ · รวม', 'portions on this plate · total')} {m.tot.kcal} kcal</div>
              <div className="space-y-2">
                {m.items.map((it, i) => (
                  <div key={i} className="flex items-baseline gap-2.5 text-[14px] leading-snug">
                    <span className="shrink-0 translate-y-1" style={{ width: 11, height: 11, borderRadius: 3, background: (CAT[it.cat] || {}).c }} />
                    <span className="min-w-0"><b style={{ fontWeight: 600 }}>{it.cat === 'shake' ? shk(it.th) : (LANG === 'en' ? en(it) : it.th.replace(/\s*\(.*?\)/, ''))}</b><span style={{ color: '#DBD7DD' }}> — {it.g}g{qtyLabel(it) ? ' · ' + qtyLabel(it) : ''}</span></span>
                  </div>))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalIcon({ id, color }) {
  const p = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === 'loss') return (<svg {...p}><polyline points="3 7 9 13 13 9 21 17" /><polyline points="21 13 21 17 17 17" /></svg>);       // กราฟน้ำหนักลดลง
  if (id === 'longevity') return (<svg {...p}><path d="M12 20.5l-7-7a4.5 4.5 0 0 1 6.4-6.3l.6.6.6-.6a4.5 4.5 0 0 1 6.4 6.3z" /></svg>); // หัวใจ (สุขภาพ/อายุยืน)
  return (<svg {...p}><path d="M2.5 12h2M19.5 12h2M5.5 9v6M18.5 9v6M8.5 7.5v9M15.5 7.5v9M8.5 12h7" /></svg>);                          // ดัมเบล (กล้ามเนื้อ)
}
function GoalBtn({ id, cur, set, icon, color, title, sub }) {
  const on = cur === id;
  return (<button onClick={() => set(id)} className="glass glass-hover rounded-2xl p-4 text-left transition" style={on ? { boxShadow: '0 0 0 2px ' + color } : {}}>
    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-2" style={{ background: color + '18' }}><GoalIcon id={icon} color={color} /></div>
    <div className="font-head text-ink">{title}</div>
    <div className="text-xs text-ink-60 mt-0.5">{sub}</div></button>);
}

function App(props) {
  // wrapper ref → toggle .dark บน .pp-root subtree เท่านั้น (ไม่แตะ <html> ของ uplabs) + scope CSS vars
  const rootRef = useRef(null);
  // โหลดแผนล่าสุดกลับมา (input เล็ก ๆ ใน localStorage) → refresh แล้วได้แผน/เมนูเดิม sig เดิม → ดึงรูปจาก IndexedDB ได้ ไม่ gen ซ้ำ
  const PP = (() => { try { return JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem('pp_plan')) || '{}'); } catch (e) { return {}; } })();
  const [w, setW] = useState(PP.w || props.initialW || 78), [h, setH] = useState(PP.h || props.initialH || 172), [goal, setGoal] = useState(PP.goal || 'longevity');
  const [even3, setEven3] = useState(PP.even3 || false), [seed, setSeed] = useState(PP.seed || 1), [show, setShow] = useState(PP.show || false);
  const [planLen, setPlanLen] = useState(PP.planLen || 30), [dayIdx, setDayIdx] = useState(PP.dayIdx || 0);
  const [edits, setEdits] = useState({}); // ปรับมื้อเอง: key `${dayIdx}-${mealIdx}` → meal ที่เกลี่ยมาโครใหม่
  // v4: ข้อจำกัดอาหาร (diet/แพ้/ไม่ทานผัก/บังคับเชค/ล็อกน้ำหนัก)
  const [cfg, setCfgRaw] = useState(PP.cfg || { diet: 'none', noVeg: false, allergy: [], shake: { on: false, meals: [] }, lockW: false });
  const setCfg = u => setCfgRaw(c => ({ ...c, ...(typeof u === 'function' ? u(c) : u) }));
  const [cfgOpen, setCfgOpen] = useState(false);
  // ธีม (system/light/dark) · ขนาดฟอนต์ · ภาษา (TH/EN)
  const [theme, setTheme] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('pp_theme')) || 'system');
  const [font, setFontS] = useState(() => parseFloat((typeof localStorage !== 'undefined' && localStorage.getItem('pp_font'))) || 1);
  const [, setLangTick] = useState(0);
  // โหมดมืดผูกกับ .pp-root (ผ่าน ref) แทน document.documentElement → ไม่กระทบหน้าอื่นของ uplabs
  const applyTheme = th => { try { const d = th === 'dark' || (th === 'system' && typeof window !== 'undefined' && matchMedia('(prefers-color-scheme:dark)').matches); if (rootRef.current) rootRef.current.classList.toggle('dark', d); } catch (e) { } };
  const cycleTheme = () => { const o = ['system', 'light', 'dark'], nx = o[(o.indexOf(theme) + 1) % 3]; setTheme(nx); try { localStorage.setItem('pp_theme', nx); } catch (e) { } applyTheme(nx); };
  // ฟอนต์: ตั้งบน .pp-root เอง (ไม่แตะ document root font-size ของ uplabs)
  const setFont = v => { v = Math.min(1.4, Math.max(0.8, Math.round(v * 10) / 10)); setFontS(v); try { localStorage.setItem('pp_font', v); if (rootRef.current) rootRef.current.style.fontSize = (16 * v) + 'px'; } catch (e) { } };
  const setLang = v => { LANG = v; try { localStorage.setItem('pp_lang', v); } catch (e) { } setLangTick(x => x + 1); };
  // ใช้ธีม + ฟอนต์ตอน mount (แทน FOUC script ใน <head> ของ standalone) + ฟัง system theme change
  useEffect(() => {
    applyTheme(theme);
    if (rootRef.current) rootRef.current.style.fontSize = (16 * font) + 'px';
    try { const mq = matchMedia('(prefers-color-scheme:dark)'); const handler = () => { if (((localStorage.getItem('pp_theme')) || 'system') === 'system') applyTheme('system'); }; mq.addEventListener('change', handler); return () => mq.removeEventListener('change', handler); } catch (e) { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { try { localStorage.setItem('pp_plan', JSON.stringify({ w, h, goal, even3, seed, show, planLen, dayIdx, cfg })); } catch (e) { } }, [w, h, goal, even3, seed, show, planLen, dayIdx, cfg]);
  const t = useMemo(() => calcTargets(+w, +h, goal, cfg.lockW), [w, h, goal, cfg.lockW]);
  const plan = useMemo(() => show ? buildPlan(t, goal, even3, planLen, seed, cfg) : null, [t, goal, even3, planLen, seed, show, cfg]);
  const pool = useMemo(() => poolHealth(cfg), [cfg]);  // v4: เช็ค pool หลังกรอง → เตือนถ้าแน่นไป
  useEffect(() => { setEdits({}); }, [w, h, goal, even3, planLen, seed, cfg]); // แผนใหม่/สุ่มใหม่/เปลี่ยน config → ล้างการปรับมือ
  const variety = useMemo(() => plan ? planVariety(plan) : null, [plan]);
  const day = plan ? plan[Math.min(dayIdx, plan.length - 1)].map((mm, mi) => edits[dayIdx + '-' + mi] || mm) : null;
  const applyShake = (mi, shake, mode) => { const anchor = shakeMeal(day[mi], shake, mode); const nd = rebalanceDay(day, t, goal, even3, mi, anchor, cfg); const e = {}; nd.forEach((nm, j) => e[dayIdx + '-' + j] = nm); setEdits(e); }; // เชค → เกลี่ยทั้งวัน เก็บทุกมื้อเป็น edits
  const dtot = day && day.reduce((a, m) => ({ p: a.p + m.tot.p, c: a.c + m.tot.c, f: a.f + m.tot.f, kcal: a.kcal + m.tot.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
  const recon = dtot ? Math.round(dtot.kcal / t.kcal * 100) : 0;
  const reconOK = recon >= 95 && recon <= 105;
  const shop = useMemo(() => { if (!day) return null; const m = {}; day.forEach(ml => ml.items.forEach(it => { m[it.th] = m[it.th] || { cat: it.cat, g: 0 }; m[it.th].g += it.g; })); return m; }, [plan, dayIdx]);

  const goalMeta = { loss: { icon: 'loss', c: '#2A7B8F', t: tr('ลดน้ำหนัก', 'Weight Loss'), s: tr('ลดไขมัน รักษากล้าม', 'Lose fat, keep muscle') }, longevity: { icon: 'longevity', c: '#396755', t: 'Longevity', s: tr('สุขภาพดี อายุยืน', 'Healthy & long life') }, muscle: { icon: 'muscle', c: '#C47A2A', t: tr('เพิ่มกล้ามเนื้อ', 'Build Muscle'), s: tr('สร้างมวลกล้าม', 'Gain muscle mass') } };
  // v4 config options
  const DIETS = [['none', tr('ไม่จำกัด', 'No limit')], ['halal', tr('ฮาลาล', 'Halal')], ['nopork', tr('ไม่ทานหมู', 'No pork')], ['nobeef', tr('ไม่ทานเนื้อวัว', 'No beef')], ['noredmeat', tr('ไม่ทานเนื้อแดง', 'No red meat')], ['vegetarian', tr('มังสวิรัติ (ทานไข่/นม)', 'Vegetarian')], ['vegan', tr('วีแกน/เจ', 'Vegan')]];
  const ALLERGENS = [['seafood', tr('อาหารทะเล', 'Shellfish')], ['fish', tr('ปลา', 'Fish')], ['nuts', tr('ถั่วเปลือกแข็ง/ลิสง', 'Nuts/peanut')], ['soy', tr('ถั่วเหลือง', 'Soy')], ['dairy', tr('นม', 'Milk')], ['egg', tr('ไข่', 'Egg')], ['sesame', tr('งา', 'Sesame')], ['gluten', tr('กลูเตน', 'Gluten')]];
  const toggleAllergy = k => setCfg(c => ({ ...c, allergy: c.allergy.includes(k) ? c.allergy.filter(x => x !== k) : [...c.allergy, k] }));

  return (
    <div ref={rootRef} className="pp-root min-h-screen">
      <style>{PP_CSS}</style>
      <div className="aurora"><i className="o1" /><i className="o2" /><i className="o3" /></div>
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2 text-wellness text-sm"><span>🍽️</span><span className="tracking-wide font-medium">PLATE PLANNER</span></div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setLang(LANG === 'th' ? 'en' : 'th')} className="glass glass-hover rounded-lg px-2.5 py-1 text-xs font-semibold text-ink-80" title="TH / EN">{LANG === 'th' ? 'EN' : 'ไทย'}</button>
              <button onClick={cycleTheme} className="glass glass-hover rounded-lg px-2 py-1 text-sm leading-none" title={tr('ธีม', 'Theme') + ': ' + theme}>{theme === 'system' ? '💻' : theme === 'dark' ? '🌙' : '☀️'}</button>
              <div className="flex glass rounded-lg overflow-hidden">
                <button onClick={() => setFont(font - 0.1)} className="px-2 py-1 text-[11px] text-ink-80 glass-hover" title={tr('ฟอนต์เล็กลง', 'Smaller')}>A−</button>
                <button onClick={() => setFont(font + 0.1)} className="px-2 py-1 text-sm text-ink-80 glass-hover" title={tr('ฟอนต์ใหญ่ขึ้น', 'Larger')}>A+</button>
              </div>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-head text-ink">{tr('วางแผนมื้ออาหารตามหลักกล้ามเนื้อ', 'Muscle‑Centric Meal Planner')}</h1>
          <p className="text-ink-60 mt-2">{tr('สูตร Dr. Gabrielle Lyon (Forever Strong) · อาหารไทยหาง่าย · ตัวเลขจริงจากฐานข้อมูล USDA/Thai FCD — แก่ช้า เจ็บสั้น ตายดี', 'By Dr. Gabrielle Lyon (Forever Strong) · everyday Thai food · real USDA/Thai FCD numbers — age slow, suffer briefly, die well')}</p>
        </header>

        {BYO_KEY ? null : (
          <div className="text-xs text-ink-40 mb-5 flex items-center gap-1.5"><span>🎨</span><span>{tr('กดดูรูปอาหารเสมือนจริงได้ทุกมื้อ — พร้อมใช้เลย ไม่ต้องตั้งค่าอะไร', 'Generate a realistic photo for any meal — ready to use, no setup needed')}</span></div>
        )}

        <section className="glass rounded-3xl p-5 sm:p-6 mb-6">
          <h2 className="font-head text-ink text-lg mb-4">{tr('1 · บอกข้อมูลตัวเอง', '1 · About you')}</h2>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <label className="block"><span className="text-sm text-ink-80">{tr('น้ำหนักปัจจุบัน (กก.)', 'Current weight (kg)')}</span>
              <input type="number" value={w} onChange={e => setW(e.target.value)} className="mt-1 w-full glass rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 ring-wellness/50" /></label>
            <label className="block"><span className="text-sm text-ink-80">{tr('ส่วนสูง (ซม.)', 'Height (cm)')}</span>
              <input type="number" value={h} onChange={e => setH(e.target.value)} className="mt-1 w-full glass rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 ring-wellness/50" /></label>
          </div>
          <div className="text-sm text-ink-80 mb-2">{tr('เป้าหมาย', 'Goal')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {Object.keys(goalMeta).map(k => <GoalBtn key={k} id={k} cur={goal} set={setGoal} icon={goalMeta[k].icon} color={goalMeta[k].c} title={goalMeta[k].t} sub={goalMeta[k].s} />)}
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={even3} onChange={e => setEven3(e.target.checked)} className="w-4 h-4" style={{ accentColor: '#396755' }} />
            <span className="text-sm text-ink-80">{tr('ขอกินวันละ 3 มื้อเท่า ๆ กัน', 'Eat 3 equal meals a day')} <span className="text-ink-40">{tr('— ไม่ติ๊ก = เราจัดจำนวนมื้อให้เหมาะกับเป้าหมายให้อัตโนมัติ', '— unchecked = we set meals to fit your goal automatically')}</span></span>
          </label>
          <div className="mt-4">
            <div className="text-sm text-ink-80 mb-2">{tr('ความยาวแผน (เมนูไม่ซ้ำ)', 'Plan length (no repeats)')}</div>
            <div className="flex flex-wrap gap-2">
              {[[7, tr('7 วัน', '7 days')], [30, tr('30 วัน', '30 days')], [49, tr('49 วัน · 7 สัปดาห์', '49 days · 7 weeks')]].map(o => (
                <button key={o[0]} onClick={() => { setPlanLen(o[0]); setDayIdx(0); }} className={"glass glass-hover rounded-xl px-4 py-2 text-sm " + (planLen === o[0] ? 'ring-2 ring-wellness text-wellness font-medium' : 'text-ink-80')}>{o[1]}</button>))}
            </div>
          </div>
          <div className="mt-4 glass rounded-2xl overflow-hidden">
            <button onClick={() => setCfgOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <span className="text-sm text-ink-80">🥗 {tr('ข้อจำกัดอาหาร & ตัวเลือก', 'Dietary restrictions & options')} <span className="text-ink-40">{tr('(ไม่บังคับ)', '(optional)')}</span></span>
              <span className="text-xs flex items-center gap-2">{cfgActive(cfg) && <span className="bg-wellness/15 text-wellness rounded-full px-2 py-0.5">{tr('เปิดใช้', 'on')}</span>}<span className="text-ink-40">{cfgOpen ? '▲' : '▼'}</span></span>
            </button>
            {cfgOpen && <div className="px-4 pb-4 pt-1 space-y-4 border-t border-ink/8">
              <div>
                <div className="text-xs text-ink-60 mb-1.5">{tr('รูปแบบการกิน (เลือก 1)', 'Eating pattern (pick 1)')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {DIETS.map(o => <button key={o[0]} onClick={() => setCfg({ diet: o[0] })} className={"rounded-lg px-2.5 py-1 text-xs " + (cfg.diet === o[0] ? 'ring-2 ring-wellness text-wellness font-medium' : 'glass glass-hover text-ink-80')}>{o[1]}</button>)}
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-60 mb-1.5">{tr('แพ้อาหาร (เลือกหลายอย่างได้ · อิงสารก่อภูมิแพ้หลัก)', 'Allergies (multi-select · major allergens)')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGENS.map(o => <button key={o[0]} onClick={() => toggleAllergy(o[0])} className={"rounded-lg px-2.5 py-1 text-xs " + (cfg.allergy.includes(o[0]) ? 'ring-2 ring-rose text-rose font-medium' : 'glass glass-hover text-ink-80')}>{cfg.allergy.includes(o[0]) ? '✕ ' : ''}{o[1]}</button>)}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-ink-80"><input type="checkbox" checked={cfg.noVeg} onChange={e => setCfg({ noVeg: e.target.checked })} className="w-4 h-4" style={{ accentColor: '#396755' }} />{tr('ไม่ทานผัก', 'No vegetables')}</label>
                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-ink-80"><input type="checkbox" checked={cfg.lockW} onChange={e => setCfg({ lockW: e.target.checked })} className="w-4 h-4" style={{ accentColor: '#396755' }} />{tr('🔒 ใช้น้ำหนักที่กรอกคำนวณตรง ๆ (ไม่คิดจาก BMI)', '🔒 Use entered weight directly (skip BMI)')}</label>
                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-ink-80"><input type="checkbox" checked={cfg.shake.on} onChange={e => setCfg({ shake: { ...cfg.shake, on: e.target.checked } })} className="w-4 h-4" style={{ accentColor: '#396755' }} />🥤 {tr('บังคับมีโปรตีนเชคในแผน', 'Require a protein shake')}</label>
                {cfg.shake.on && <div className="ml-6 flex items-center gap-2 flex-wrap">
                  {[['breakfast', tr('มื้อเช้า', 'Breakfast')], ['dinner', tr('มื้อเย็น', 'Dinner')]].map(o => <button key={o[0]} onClick={() => setCfg({ shake: { ...cfg.shake, [o[0]]: !cfg.shake[o[0]] } })} className={"rounded-lg px-2.5 py-1 text-xs " + (cfg.shake[o[0]] ? 'ring-2 ring-wellness text-wellness font-medium' : 'glass glass-hover text-ink-80')}>{cfg.shake[o[0]] ? '✓ ' : ''}{o[1]}</button>)}
                  <span className="text-[11px] text-amber">{tr('· ตรวจฉลากเชคเองว่าตรงเงื่อนไขแพ้/มังสวิรัติ', '· verify shake label fits your allergies/diet')}</span>
                </div>}
              </div>
              {pool.veryTight ? <div className="text-xs text-rose leading-relaxed">{tr('⚠️ เงื่อนไขแน่นมาก เหลือโปรตีนหลักน้อย — แผนอาจซ้ำ/ทำเป้าโปรตีนไม่ครบ ลองปลดบางข้อหรือเปิดเชค', '⚠️ Very restrictive — few main proteins left; the plan may repeat or miss the protein target. Try relaxing a rule or enabling a shake.')}</div>
                : pool.tight ? <div className="text-xs text-amber leading-relaxed">{tr('⚠️ เงื่อนไขค่อนข้างแน่น เมนูอาจซ้ำบ่อยขึ้น', '⚠️ Fairly restrictive — menus may repeat more often.')}</div> : null}
              {cfg.diet === 'vegan' && !cfg.shake.on && <div className="text-[11px] text-ink-40 leading-relaxed">{tr('💡 วีแกน: โปรตีนพืชเข้มข้นน้อย — แนะนำเปิด “บังคับเชค” (All Plant Protein) ช่วยให้ถึงเป้า', '💡 Vegan: plant protein is less dense — enabling “Require a shake” (All Plant Protein) helps hit the target.')}</div>}
            </div>}
          </div>
          <button onClick={() => { setShow(true); setDayIdx(0); setSeed(s => s + 1); }} className="mt-5 w-full sm:w-auto px-6 py-3 rounded-xl font-head text-white shadow-sm" style={{ background: 'linear-gradient(135deg,#396755,#244438)' }}>{tr('สร้างแผน', 'Create plan')} {planLen} {tr('วัน', 'days')} →</button>
        </section>

        {show && (<>
          <section className="glass rounded-3xl p-5 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-head text-ink text-lg">{tr('2 · สารอาหารที่ควรได้ต่อวัน', '2 · Daily nutrient targets')}</h2>
              <span className="text-xs text-ink-60">BMI {t.bmi} · {tr('ฐานคำนวณ', 'base')} {t.base} {tr('กก.', 'kg')}</span>
            </div>
            <p className="text-sm text-ink-60 mb-3">{tr('กินให้ครบประมาณนี้ในแต่ละวัน', 'Aim for roughly this each day')} 💪 <span className="text-ink-80">{tr('เน้นโปรตีนเป็นพระเอก', 'protein first')}</span> {tr('ตามแนว Dr. Lyon', '— Dr. Lyon style')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[[tr('พลังงาน', 'Energy'), t.kcal, 'kcal', '#5C5660'], [tr('โปรตีน', 'Protein'), t.p, tr('กรัม', 'g'), CAT.protein.c], [tr('คาร์บ', 'Carb'), t.c, tr('กรัม', 'g'), CAT.carb.c], [tr('ไขมัน', 'Fat'), t.f, tr('กรัม', 'g'), CAT.fat.c]].map((x, i) => (
                <div key={i} className="glass rounded-2xl p-4 text-center">
                  <div className="text-3xl font-head" style={{ color: x[3] }}>{x[1]}</div>
                  <div className="text-xs text-ink-60 mt-1">{x[0]} ({x[2]})</div></div>))}
            </div>
            <p className="text-xs text-ink-40 mt-3 leading-relaxed">📐 {t.note}</p>
          </section>

          <section className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <h2 className="font-head text-ink text-lg">{tr('3 · แผน', '3 · Plan')} {plan.length} {tr('วัน · เมนูไม่ซ้ำ', 'days · no repeats')}</h2>
              <button onClick={() => { setSeed(s => s + 1); setDayIdx(0); }} className="glass glass-hover px-4 py-2 rounded-xl text-sm text-wellness font-medium">🎲 {tr('สุ่มแผนใหม่', 'Shuffle')}</button>
            </div>
            {variety && <div className="glass rounded-xl p-3 mb-3 text-sm text-ink-80 flex flex-wrap gap-x-5 gap-y-1">
              <span>{tr('เมนูหลักไม่ซ้ำ', 'Unique mains')} <span className="text-optimal font-medium">{variety.pct}%</span> ({variety.distinct}/{variety.total})</span>
              <span>{tr('ใช้โปรตีน', 'Proteins')} <span className="text-ink font-medium">{variety.proteins}</span> {tr('ชนิด × วิธีปรุง', 'types ×')} {STYLES.length} {tr('แบบ', 'styles')}</span>
            </div>}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
              <button onClick={() => setDayIdx(i => Math.max(0, i - 1))} className="glass glass-hover rounded-lg px-3 py-1.5 text-ink-80 shrink-0">◀</button>
              {plan.map((_, i) => (<button key={i} onClick={() => setDayIdx(i)} className={"rounded-lg px-3 py-1.5 text-sm shrink-0 " + (i === dayIdx ? 'text-white font-medium' : 'glass glass-hover text-ink-80')} style={i === dayIdx ? { background: '#396755' } : {}}>{i + 1}</button>))}
              <button onClick={() => setDayIdx(i => Math.min(plan.length - 1, i + 1))} className="glass glass-hover rounded-lg px-3 py-1.5 text-ink-80 shrink-0">▶</button>
            </div>
            <div className="text-sm text-ink-60 mb-3">📅 {tr('วันที่', 'Day')} {dayIdx + 1} / {plan.length} · {day.length} {tr('มื้อ', 'meals')}</div>
            <div className="grid gap-4">{day.map((m, i) => <MealCard key={i} m={m} cfg={cfg} edited={!!edits[dayIdx + '-' + i]} onEdit={nm => setEdits(e => ({ ...e, [dayIdx + '-' + i]: nm }))} onReset={() => setEdits(e => { const n = { ...e }; delete n[dayIdx + '-' + i]; return n; })} onShake={(shake, mode) => applyShake(i, shake, mode)} />)}</div>
          </section>

          <section className={"glass rounded-3xl p-5 sm:p-6 mb-6 " + (reconOK ? 'ring-1 ring-optimal/40' : 'ring-1 ring-amber/40')}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-head text-ink text-lg">{tr('รวมทั้งวัน', 'Daily total')}</h2>
              <div className="flex gap-2 items-center">
                <Chip c={CAT.protein.c}>P {r1(dtot.p)}</Chip><Chip c={CAT.carb.c}>C {r1(dtot.c)}</Chip>
                <Chip c={CAT.fat.c}>F {r1(dtot.f)}</Chip><Chip c="#5C5660">{dtot.kcal} kcal</Chip>
                <span className={"text-sm font-medium " + (reconOK ? 'text-optimal' : 'text-amber')}>{recon}% {tr('ของเป้า', 'of target')} {reconOK ? tr('✓ ผ่าน ±5%', '✓ within ±5%') : tr('· ปรับ portion', '· adjusting')}</span>
              </div>
            </div>
            {dtot.p < t.p * 0.9 && <div className="mt-2.5 text-xs text-amber leading-relaxed">⚠️ {tr(`โปรตีนได้ ${r1(dtot.p)}/${t.p} ก. (${Math.round(dtot.p / t.p * 100)}% ของเป้า) — เป้า 2.2 ก./กก. ทำได้ยากในเมนูจำกัด (วีแกน/แพ้) แนะนำเปิด “บังคับเชค” หรือเสริมโปรตีน`, `Protein ${r1(dtot.p)}/${t.p} g (${Math.round(dtot.p / t.p * 100)}% of target) — 2.2 g/kg is hard on a restricted menu (vegan/allergy); enable “Require a shake” or add protein`)}</div>}
          </section>

          <section className="glass rounded-3xl p-5 sm:p-6 mb-6">
            <h2 className="font-head text-ink text-lg mb-3">{tr('4 · รายการซื้อของ', '4 · Shopping list')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
              {Object.keys(CAT).map(cat => {
                const list = Object.keys(shop).filter(k => shop[k].cat === cat);
                if (!list.length) return null;
                return (<div key={cat}><div className="text-xs font-medium mb-1" style={{ color: CAT[cat].c }}>{catl(CAT[cat].label)}</div>
                  {list.map(k => <div key={k} className="text-sm text-ink-80 flex justify-between"><span className="truncate pr-2">{LANG === 'en' ? fnm(k) : k}</span><span className="text-ink-60 tabular-nums">{shop[k].g}g</span></div>)}</div>);
              })}
            </div>
          </section>

          <footer className="text-xs text-ink-40 leading-relaxed glass rounded-2xl p-4">
            <p className="mb-1">⚖️ <span className="text-ink-60">{tr('กันมั่ว:', 'No fabrication:')}</span> {tr('ตัวเลขสารอาหารมาจาก USDA FoodData Central / Source-anchor (เนื้อวัว 25g) — รายการที่ติด', 'Nutrition numbers come from USDA FoodData Central / Source anchors — items marked')} <span className="text-amber">{tr('~ประมาณ', '~estimate')}</span> {tr('ยังรอยืนยันกับ Thai FCD (INMU). โมเดลเลือกจัดจาน แต่ตัวเลขดึงจากฐานข้อมูลจริง ไม่ปั้นเอง.', 'await Thai FCD (INMU) confirmation. The model composes the plate, but all numbers are pulled from real databases — never invented.')}</p>
            <p>🍽️ {tr('เมนูไม่ซ้ำ 7–49 วัน + กดสร้างรูปจานเหมือนจริง · ไม่ใช่คำแนะนำทางการแพทย์', 'Non-repeating 7–49 day plans + realistic AI plate images · not medical advice')}</p>
          </footer>
        </>)}
      </div>
    </div>
  );
}

export default function PlatePlanner(props: PlatePlannerProps) {
  return <App {...props} />;
}

// ===== Scoped styles (from standalone <style>) — prefixed under .pp-root so vars/dark mode/glass/aurora don't leak globally =====
const PP_CSS = `
.pp-root{--bg:#FAF6F1;--bg2:#F2EDE8;--bg3:#F5F0EB;--ink:24 21 26;--ink-80:61 56 64;--ink-60:92 86 96;--ink-40:138 131 142;--ink-20:186 181 189;--ink-10:221 217 223;--ink-5:242 240 243;--surface:247 245 243;--glass:255 255 255;--glass-a:.55;--glass-h:.74;--glass-bd:255 255 255;--glass-bd-a:.6;--sh:31 30 27;--shi:.06;position:relative;color:rgb(var(--ink));background:var(--bg);font-family:'IBM Plex Sans Thai',var(--font-sarabun),system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
.pp-root.dark{--bg:#141118;--bg2:#0E0C13;--bg3:#16131C;--ink:236 233 242;--ink-80:201 197 210;--ink-60:159 154 170;--ink-40:121 116 134;--ink-20:84 80 97;--ink-10:56 52 67;--ink-5:38 35 47;--surface:30 27 37;--glass:50 45 60;--glass-a:.5;--glass-h:.66;--glass-bd:255 255 255;--glass-bd-a:.1;--sh:0 0 0;--shi:.35;}
.pp-root h1,.pp-root h2,.pp-root h3,.pp-root .font-head{font-family:'Kanit','IBM Plex Sans Thai',var(--font-manrope),sans-serif;}
/* UP Labs liquid glass (theme-aware) */
.pp-root .glass{background:rgba(var(--glass)/var(--glass-a));backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(var(--glass-bd)/var(--glass-bd-a));box-shadow:0 8px 32px rgba(var(--sh)/var(--shi)),inset 0 1px 0 rgba(255,255,255,0.85);isolation:isolate;}
.pp-root.dark .glass{box-shadow:0 8px 32px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05);}
.pp-root .glass-hover{transition:all 300ms cubic-bezier(0.4,0,0.2,1);}
.pp-root .glass-hover:hover{background:rgba(var(--glass)/var(--glass-h));transform:translateY(-2px);box-shadow:0 12px 40px rgba(var(--sh)/calc(var(--shi) + .04)),inset 0 1px 0 rgba(255,255,255,0.9);}
/* Aurora ambient orbs — absolute within .pp-root (not fixed, so it stays inside the planner panel) */
.pp-root .aurora{position:absolute;inset:0;overflow:hidden;z-index:0;background:linear-gradient(180deg,var(--bg) 0%,var(--bg2) 60%,var(--bg3) 100%);pointer-events:none;}
.pp-root .aurora i{position:absolute;border-radius:50%;filter:blur(140px);will-change:transform;display:block;}
.pp-root .aurora .o1{width:640px;height:640px;background:radial-gradient(circle,rgba(140,76,76,0.34),transparent 65%);top:-180px;left:-100px;opacity:.55;animation:pp-fl1 22s ease-in-out infinite;}
.pp-root .aurora .o2{width:720px;height:720px;background:radial-gradient(circle,rgba(57,103,85,0.30),transparent 65%);bottom:-200px;right:-100px;opacity:.55;animation:pp-fl2 28s ease-in-out infinite;}
.pp-root .aurora .o3{width:480px;height:480px;background:radial-gradient(circle,rgba(196,122,42,0.26),transparent 65%);top:42%;left:50%;transform:translateX(-50%);opacity:.5;animation:pp-fl3 24s ease-in-out infinite;}
@keyframes pp-fl1{0%,100%{transform:translate(0,0)}50%{transform:translate(70px,50px)}}
@keyframes pp-fl2{0%,100%{transform:translate(0,0)}50%{transform:translate(-70px,-50px)}}
@keyframes pp-fl3{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-38%) translateY(36px)}}
/* ensure planner content sits above the absolute aurora */
.pp-root > .max-w-4xl{position:relative;z-index:1;}
/* status-green utility (standalone used a Tailwind "optimal" color uplabs doesn't have) */
.pp-root .text-optimal{color:#16A34A;}
.pp-root .ring-optimal\\/40{--tw-ring-color:rgba(22,163,74,.4);}
/* Dark-mode recolor: uplabs ink/surface tokens are static hex, so map the utilities the app uses to the scoped --ink vars in dark mode */
.pp-root.dark .text-ink{color:rgb(var(--ink));}
.pp-root.dark .text-ink-80{color:rgb(var(--ink-80));}
.pp-root.dark .text-ink-60{color:rgb(var(--ink-60));}
.pp-root.dark .text-ink-40{color:rgb(var(--ink-40));}
.pp-root.dark .text-ink-20{color:rgb(var(--ink-20));}
.pp-root.dark .bg-surface{background:rgb(var(--surface));}
/* border-ink/X opacity helpers used in dark mode (uplabs static ink → scoped var) */
.pp-root.dark .border-ink\\/5{border-color:rgba(var(--ink)/.05);}
.pp-root.dark .border-ink\\/8{border-color:rgba(var(--ink)/.08);}
.pp-root.dark .border-ink\\/10{border-color:rgba(var(--ink)/.10);}
@media (prefers-reduced-motion:reduce){.pp-root .aurora i{animation:none!important;}.pp-root .glass-hover{transition:none!important}.pp-root .glass-hover:hover{transform:none!important}}
`;
