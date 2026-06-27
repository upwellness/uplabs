// @ts-nocheck
/**
 * Plate Planner — pure meal-planning engine (server-callable).
 *
 * Extracted VERBATIM from app/plate-planner/PlatePlanner.tsx (the QA'd, production engine).
 * No React, no JSX, no localStorage/window/document/DOM, no crypto. Safe to import from
 * Next.js route handlers and a LINE bot:  import { buildPlan, calcTargets } from "@/lib/plate-planner/engine";
 *
 * i18n: the engine only uses tr() inside calcTargets() for the human-readable `note`.
 * Here tr() defaults to Thai (the bot renders Thai). UI display helpers (mn/stl/fnm/en/
 * catl/unit/shk/*_EN) and buildImagePrompt are UI concerns and are intentionally EXCLUDED.
 *
 * SINGLE SOURCE OF TRUTH NOTE: until PlatePlanner.tsx is refactored to import from here,
 * this file and the component each hold a copy of the engine. A parity test must guard them.
 * Do NOT "improve" the nutrition math — copy logic only.
 */

/* ===== Public types (exported surface) ===== */
export type Goal = 'loss' | 'longevity' | 'muscle';

export interface Food {
  th: string; kcal: number; p: number; c: number; f: number;
  u: string; ug: number; max: number; src?: string; conf?: string;
  cat?: string; _cat?: string;
  hero?: number; snkp?: number; snk?: number; sv?: number; fixed?: number;
}

export interface MealItem {
  th: string; cat: string;
  u: string; ug: number; src?: string; conf?: string; mx: number;
  g: number; p: number; c: number; f: number; kcal: number;
  ref: { kcal: number; p: number; c: number; f: number };
  fixed?: number;
}

export interface MealTot { p: number; c: number; f: number; kcal: number; }

export interface Meal {
  name: string; snack?: boolean; style: string; main: string;
  items: MealItem[]; tot: MealTot;
  tgt: { p: number; c: number; f?: number };
  sig: string; edited?: boolean; shake?: number;
}

export type DayPlan = Meal[];

export interface Targets {
  bmi: number; ideal: number; base: number;
  kcal: number; p: number; c: number; f: number; note: string;
}

export interface ShakeCfg { on?: boolean; breakfast?: boolean; dinner?: boolean; }

export type Diet = 'none' | 'halal' | 'nopork' | 'nobeef' | 'noredmeat' | 'vegetarian' | 'vegan';
export type Allergy = 'seafood' | 'fish' | 'nuts' | 'soy' | 'dairy' | 'egg' | 'sesame' | 'gluten';

export interface PlanConfig {
  diet?: Diet;
  noVeg?: boolean;
  allergy?: Allergy[];
  shake?: ShakeCfg;
  lockW?: boolean;
}

/* ===== Public function signatures (the engine body below is the verbatim impl) =====
 *   calcTargets(w, h, goal, lockW?)                              => Targets
 *   buildPlan(t, goal, even3, days, baseSeed, cfg?)              => DayPlan[]
 *   buildDay(t, goal, even3, seed, cfg?)                         => DayPlan
 *   planVariety(plan)        => { total, distinct, pct, proteins }
 *   poolHealth(cfg?)         => { hero, snkp, carb, veg, tight, veryTight }
 *   dietTags(food)           => Set<string>
 *   okFood(food, cfg?)       => boolean
 *   rebuildMeal(meal, foods, cfg?) / rebalanceDay(...) / shakeMeal(meal, shake, mode) => Meal(s)
 */

/* ===== Engine (copied verbatim from PlatePlanner.tsx — do not edit logic) ===== */
const tr = (th: string, _en?: string): string => th;

// flag โหมดคีย์ภาพ: true = โชว์แผง ⚙️ ให้เลือก Gemini/OpenAI + ใส่ key เอง (เว้นว่าง = ใช้ env key ฝั่งเซิร์ฟเวอร์)
// ===== i18n: LANG เป็น module var · t(ไทย,EN) อ่าน LANG · สลับภาษาแล้ว setLangTick ใน App รีเรนเดอร์ทุก component =====

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

/* ===== Public API export (canonical engine names; signatures documented above) ===== */
export {
  calcTargets,
  buildPlan,
  buildDay,
  planVariety,
  poolHealth,
  dietTags,
  okFood,
  allocMeal,
  rebuildMeal,
  rebalanceDay,
  shakeMeal,
  mkShake,
  itemToFood,
  // data + helpers useful to callers
  DB,
  CAT,
  SHAKEFOODS,
  SHAKEBASE,
  SHAKEMIX,
  CATFOODS,
  CATLABEL,
  STYLES,
  PSTYLE,
  PGRP,
  pgrp,
  ORD,
  tag,
  mk,
  reTot,
  mealPlan,
};

