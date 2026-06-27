/**
 * น้องจาน — core meal-plan logic for the LINE bot.
 *
 * Glues the shared Plate Planner engine (lib/plate-planner/engine.ts) to the
 * Supabase mapping tables and renders a LINE Flex Message.
 *
 *   resolveGroup(lineGroupId)        → load mapping + customer profile + config (service role)
 *   getDayMeals(group, which)        → compute program day N, build the plan, pick the day,
 *                                       merge supplements per meal slot
 *   buildMealFlex(result, which)     → a LINE Flex bubble for the day's meals
 *
 * Engine reuse guarantees the menu matches the Plate Planner UI exactly (SPEC R5).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calcTargets,
  buildPlan,
  type Goal,
  type PlanConfig,
  type DayPlan,
  type Meal,
  type MealItem,
} from "@/lib/plate-planner/engine";
import type { LineMessage } from "@/lib/line/client";

/* ───────────────────────── Types ───────────────────────── */

export interface ResolvedGroup {
  groupRowId: string;        // line_bot_groups.id (uuid)
  lineGroupId: string;       // LINE's group id (Cxxxxxxxx)
  customerId: string;
  customerName: string | null;
  height: number;            // cm
  weight: number;            // kg (latest measurement)
  goal: Goal;
  config: PlanConfig;
  seed: number;
  even3: boolean;
  planLen: number;
  programStartDate: string;  // ISO date (yyyy-mm-dd)
  pushEnabled: boolean;
}

export interface MealFood {
  name: string;
  qty: string;     // household label e.g. "≈ 1 ฝ่ามือ (120g)" — may be "" when too small
  grams: number;
  kcal: number;
  cat: string;
}

export interface MealOut {
  name: string;
  foods: MealFood[];
  supplements: string[];
  kcal: number;
}

export interface DayMealsResult {
  which: "today" | "tomorrow";
  programDay: number;          // 1-indexed day-of-program (N)
  planIndex: number;           // 0-indexed index into the plan array actually rendered
  customerName: string | null;
  meals: MealOut[];
  macros: { p: number; c: number; f: number; kcal: number };  // day totals
}

/* ───────────────────────── Helpers ───────────────────────── */

const TZ_OFFSET_MIN = 7 * 60; // Asia/Bangkok = UTC+7 (no DST)

/** Today's date in Asia/Bangkok as yyyy-mm-dd. */
export function bangkokToday(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Whole days between two yyyy-mm-dd strings (b - a). */
function daysBetween(aISO: string, bISO: string): number {
  const a = Date.UTC(+aISO.slice(0, 4), +aISO.slice(5, 7) - 1, +aISO.slice(8, 10));
  const b = Date.UTC(+bISO.slice(0, 4), +bISO.slice(5, 7) - 1, +bISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Program day N (1-indexed) for "today" given a program_start_date.
 *   N = today - start + 1
 * Clamped to >= 1 (start in the future ⇒ day 1).
 */
export function programDayFor(programStartDate: string, todayISO: string = bangkokToday()): number {
  return Math.max(1, daysBetween(programStartDate, todayISO) + 1);
}

// Household-unit hints used to coarsely label portions in the bot. Keep simple (SPEC: don't overbuild).
// 0.5-step rounding mirrors the UI's niceQty (6.4→6, 1.9→2, 0.2→"" too small → grams only).
function niceQty(x: number): string {
  if (x >= 3) return String(Math.round(x));
  const h = Math.round(x * 2) / 2;
  return h < 0.5 ? "" : (h === 0.5 ? "½" : String(h));
}

function qtyLabel(it: MealItem): string {
  const q = it.ug > 0 ? niceQty(it.g / it.ug) : "";
  const hh = q ? `≈ ${q} ${it.u} ` : "";
  return `${hh}(${it.g}g)`;
}

/**
 * Map an engine meal name → a supplement slot key.
 * Engine meal names vary by goal ("มื้อเช้า", "มื้อที่ 1", "มื้อ 1 (เช้า)", "ของว่าง", …),
 * so we match loosely against the coach's free-text meal_slot values.
 */
function slotKeyForMeal(mealName: string, index: number, total: number): string[] {
  const n = mealName;
  const keys: string[] = [n];
  if (/ของว่าง|snack/i.test(n)) keys.push("ของว่าง", "snack");
  if (/เช้า/.test(n)) keys.push("เช้า", "มื้อเช้า");
  if (/กลางวัน|เที่ยง/.test(n)) keys.push("กลางวัน", "เที่ยง", "มื้อกลางวัน");
  if (/เย็น|ค่ำ/.test(n)) keys.push("เย็น", "ค่ำ", "มื้อเย็น");
  // Positional fallback for goals whose meals are numbered (longevity / muscle).
  if (index === 0) keys.push("เช้า", "มื้อเช้า", "มื้อ 1", "มื้อที่ 1");
  if (index === total - 1) keys.push("เย็น", "มื้อเย็น");
  return keys;
}

/* ───────────────────────── resolveGroup ───────────────────────── */

/**
 * Load the group mapping + customer profile + plate config + latest weight + height.
 * Returns null when the group isn't mapped to a customer or push/use is effectively impossible
 * (no customer, no height, no weight) — the webhook treats null as "unbound / not ready".
 */
export async function resolveGroup(lineGroupId: string): Promise<ResolvedGroup | null> {
  const admin = createAdminClient();

  const { data: group } = await admin
    .from("line_bot_groups")
    .select("id, line_group_id, customer_id, program_start_date, push_enabled, seed")
    .eq("line_group_id", lineGroupId)
    .maybeSingle();

  if (!group || !group.customer_id) return null;

  const [{ data: customer }, { data: cfgRow }, { data: latestM }] = await Promise.all([
    admin.from("customers").select("name, height").eq("id", group.customer_id).maybeSingle(),
    admin
      .from("plate_plan_config")
      .select("goal, config, seed, even3, plan_len")
      .eq("customer_id", group.customer_id)
      .maybeSingle(),
    admin
      .from("measurements")
      .select("weight, recorded_at")
      .eq("customer_id", group.customer_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const height = toNum(customer?.height);
  const weight = toNum(latestM?.weight);
  if (!customer || !(height > 0) || !(weight > 0)) return null; // not enough to compute a plan

  const goal: Goal = isGoal(cfgRow?.goal) ? cfgRow!.goal : "longevity";
  const config: PlanConfig = (cfgRow?.config && typeof cfgRow.config === "object" ? cfgRow.config : {}) as PlanConfig;

  // Group seed wins (per-group stable menu); fall back to per-customer config seed; else 1.
  const seed = Number.isFinite(group.seed) ? Number(group.seed) : toNum(cfgRow?.seed) || 1;

  return {
    groupRowId: group.id,
    lineGroupId: group.line_group_id,
    customerId: group.customer_id,
    customerName: customer.name ?? null,
    height,
    weight,
    goal,
    config,
    seed,
    even3: !!cfgRow?.even3,
    planLen: clampPlanLen(toNum(cfgRow?.plan_len)),
    programStartDate: String(group.program_start_date),
    pushEnabled: group.push_enabled !== false,
  };
}

/* ───────────────────────── getDayMeals ───────────────────────── */

/**
 * Compute the meals (+supplements) for today or tomorrow for a resolved group.
 *   today    → plan[(N-1) % planLen]
 *   tomorrow → plan[ N    % planLen]
 * The plan is built deterministically from the group's seed, so the same day
 * always renders the same menu (SPEC: fixed seed per group).
 */
export async function getDayMeals(
  group: ResolvedGroup,
  which: "today" | "tomorrow",
): Promise<DayMealsResult> {
  const N = programDayFor(group.programStartDate);
  const planLen = group.planLen;
  const planIndex = which === "today" ? (N - 1) % planLen : N % planLen;

  const targets = calcTargets(group.weight, group.height, group.goal, group.config.lockW);
  // Build the whole cycle once (deterministic for the seed); pick the day we need.
  const plan: DayPlan[] = buildPlan(targets, group.goal, group.even3, planLen, group.seed, group.config);
  const day: DayPlan = plan[planIndex] ?? plan[0] ?? [];

  // Supplements: one fetch, matched to each meal by slot keys.
  const admin = createAdminClient();
  const { data: supRows } = await admin
    .from("supplement_schedule")
    .select("meal_slot, items, sort")
    .eq("customer_id", group.customerId)
    .order("sort", { ascending: true });

  const supBySlot = new Map<string, string[]>();
  for (const r of supRows ?? []) {
    const items = Array.isArray(r.items) ? (r.items as unknown[]).map(String) : [];
    supBySlot.set(String(r.meal_slot), items);
  }

  const meals: MealOut[] = day.map((m: Meal, i: number) => {
    const keys = slotKeyForMeal(m.name, i, day.length);
    let supplements: string[] = [];
    for (const k of keys) {
      const hit = supBySlot.get(k);
      if (hit && hit.length) { supplements = hit; break; }
    }
    return {
      name: m.name,
      foods: m.items.map((it: MealItem): MealFood => ({
        name: it.th,
        qty: qtyLabel(it),
        grams: it.g,
        kcal: it.kcal,
        cat: it.cat,
      })),
      supplements,
      kcal: m.tot.kcal,
    };
  });

  const macros = day.reduce(
    (s, m) => ({ p: s.p + m.tot.p, c: s.c + m.tot.c, f: s.f + m.tot.f, kcal: s.kcal + m.tot.kcal }),
    { p: 0, c: 0, f: 0, kcal: 0 },
  );
  macros.p = Math.round(macros.p);
  macros.c = Math.round(macros.c);
  macros.f = Math.round(macros.f);
  macros.kcal = Math.round(macros.kcal);

  return {
    which,
    programDay: which === "today" ? N : N + 1,
    planIndex,
    customerName: group.customerName,
    meals,
    macros,
  };
}

/* ───────────────────────── buildMealFlex ───────────────────────── */

const COLORS = {
  brand: "#4B6F44",     // olive green (UP Wellness)
  gold: "#B8893B",
  ink: "#22251F",
  sub: "#6B7066",
  faint: "#9AA095",
  line: "#E6E8E1",
  pillBg: "#EEF2E8",
  supBg: "#FBF3E2",
};

function txt(text: string, opts: Record<string, unknown> = {}): LineMessage {
  return { type: "text", text: text || " ", wrap: true, ...opts };
}

/** One meal block (header + foods + optional supplement line). */
function mealBox(m: MealOut): LineMessage {
  const foodRows: LineMessage[] = m.foods.length
    ? m.foods.map((f) => ({
        type: "box",
        layout: "baseline",
        spacing: "sm",
        contents: [
          { type: "text", text: "•", size: "sm", color: COLORS.gold, flex: 0 },
          { type: "text", text: f.name, size: "sm", color: COLORS.ink, flex: 5, wrap: true },
          { type: "text", text: f.qty, size: "xs", color: COLORS.sub, align: "end", flex: 4, wrap: true },
        ],
      }))
    : [txt("— ไม่มีรายการ —", { size: "xs", color: COLORS.faint })];

  const contents: LineMessage[] = [
    {
      type: "box",
      layout: "baseline",
      contents: [
        { type: "text", text: m.name, size: "sm", weight: "bold", color: COLORS.brand, flex: 1, wrap: true },
        { type: "text", text: `${m.kcal} kcal`, size: "xs", color: COLORS.faint, align: "end", flex: 0 },
      ],
    },
    { type: "box", layout: "vertical", spacing: "xs", margin: "sm", contents: foodRows },
  ];

  if (m.supplements.length) {
    contents.push({
      type: "box",
      layout: "vertical",
      margin: "sm",
      paddingAll: "8px",
      backgroundColor: COLORS.supBg,
      cornerRadius: "6px",
      contents: [
        {
          type: "box",
          layout: "baseline",
          spacing: "sm",
          contents: [
            { type: "text", text: "💊", size: "xs", flex: 0 },
            { type: "text", text: m.supplements.join(" · "), size: "xs", color: COLORS.gold, flex: 1, wrap: true },
          ],
        },
      ],
    });
  }

  return { type: "box", layout: "vertical", margin: "lg", spacing: "none", contents };
}

/**
 * Build the day's Flex bubble. Returns a single LINE message object
 * (`{ type: "flex", altText, contents, quickReply }`).
 * Quick Reply buttons (today/tomorrow/day-info) are attached so the buttons are
 * always present in the group (no Rich Menu in group chats — see webhook docs).
 */
export function buildMealFlex(result: DayMealsResult, which: "today" | "tomorrow"): LineMessage {
  const whichLabel = which === "today" ? "วันนี้" : "พรุ่งนี้";
  const title = `🍽️ มื้อ${whichLabel}`;
  const who = result.customerName ? ` · ${result.customerName}` : "";
  const headerSub = `วันที่ ${result.programDay} ของโปรแกรม${who}`;

  const mealBlocks: LineMessage[] = result.meals.length
    ? result.meals.map(mealBox)
    : [txt("ยังไม่มีเมนูสำหรับวันนี้ — แจ้งโค้ชตรวจสอบโปรไฟล์", { size: "sm", color: COLORS.sub })];

  const bubble: LineMessage = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      backgroundColor: COLORS.brand,
      contents: [
        { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg" },
        { type: "text", text: headerSub, color: "#E8EFE2", size: "xs", margin: "sm", wrap: true },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "none",
      contents: mealBlocks,
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      backgroundColor: COLORS.pillBg,
      spacing: "xs",
      contents: [
        { type: "text", text: "รวมทั้งวัน", size: "xs", weight: "bold", color: COLORS.brand },
        {
          type: "text",
          size: "sm",
          color: COLORS.ink,
          wrap: true,
          text: `โปรตีน ${result.macros.p}g · คาร์บ ${result.macros.c}g · ไขมัน ${result.macros.f}g · ${result.macros.kcal} kcal`,
        },
        { type: "text", text: "คำนวณจาก Plate Planner · Dr. Gabrielle Lyon", size: "xxs", color: COLORS.faint, margin: "sm" },
      ],
    },
  };

  return {
    type: "flex",
    altText: `${title} — วันที่ ${result.programDay} ของโปรแกรม`,
    contents: bubble,
    quickReply: mealQuickReply(),
  };
}

/* ───────────────────────── Quick Reply ───────────────────────── */

/**
 * Quick Reply buttons attached to every bot reply/push so users in the group
 * always have the action buttons. (Group chats can't use a per-user Rich Menu.)
 */
export function mealQuickReply(): LineMessage {
  return {
    items: [
      qrPostback("🍽️ มื้อวันนี้", "action=today"),
      qrPostback("📅 มื้อพรุ่งนี้", "action=tomorrow"),
      qrPostback("ℹ️ วันที่เท่าไรแล้ว", "action=dayinfo"),
    ],
  };
}

function qrPostback(label: string, data: string): LineMessage {
  return {
    type: "action",
    action: { type: "postback", label, data, displayText: label },
  };
}

/** A plain text message with the meal Quick Reply attached. */
export function textWithButtons(text: string): LineMessage {
  return { type: "text", text, quickReply: mealQuickReply() };
}

/* ───────────────────────── small utils ───────────────────────── */

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function isGoal(v: unknown): v is Goal {
  return v === "loss" || v === "longevity" || v === "muscle";
}
function clampPlanLen(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 30;
  return Math.max(1, Math.min(60, Math.round(v)));
}
