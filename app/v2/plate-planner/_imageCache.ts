/**
 * UP Labs v2 · Plate Planner — AI meal-photo cache + prompt (module-local)
 * ───────────────────────────────────────────────────────────────────────
 * Ported VERBATIM (protocol-compatible) from the v1 single-file PlatePlanner.tsx so the
 * v2 planner shares the SAME image cache as v1. v1's helpers live as un-exported module
 * consts inside a `@ts-nocheck` JSX file, so they cannot be imported — but the *protocol*
 * is reproduced exactly here, which is what makes the caches interoperable:
 *
 *   - cache KEY  = `mealSig(m)` → "name|style|th:g,th:g,…"   (IDENTICAL string to v1)
 *   - L1 in-memory  : IMG_CACHE[sig]  (per browser session)
 *   - L2 IndexedDB  : db "plateplanner" · store "img"        (IDENTICAL to v1)
 *   - L3 Supabase   : public bucket "meal-images" · key = SHA-256(sig) + ".png"
 *                     (IDENTICAL hash + bucket to the /api/plate-image backend)
 *
 * Because the key + store + hash all match, a photo generated on v1 (or by another user)
 * is found by v2 with zero extra API calls, and vice-versa. The image action calls the
 * SAME endpoint POST /api/plate-image (no new API).
 *
 * Prompt builder (buildImagePrompt) is a UI concern (English EN/COOK label maps) — also
 * ported so generated photos match v1's framing. NOT nutrition math (engine untouched).
 */

import type { Meal, MealItem } from "@/lib/plate-planner/engine";

/* ── Cache key — MUST match v1 mealSig() byte-for-byte (interop) ── */
export const mealSig = (m: Meal): string =>
  (m.name || "") + "|" + (m.style || "") + "|" + (m.items || []).map((it) => it.th + ":" + it.g).join(",");

/* ── L1: in-memory (fast, per session) + in-flight guard ── */
const IMG_CACHE: Record<string, string> = {};
const IMG_INFLIGHT = new Set<string>();

export function peekImg(sig: string): string | null {
  return IMG_CACHE[sig] || null;
}
export function isInflight(sig: string): boolean {
  return IMG_INFLIGHT.has(sig);
}

/* ── L2: IndexedDB — db "plateplanner", store "img" (same as v1) ── */
const IDB = (() => {
  let dbp: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> => {
    if (typeof indexedDB === "undefined") return Promise.reject();
    return (
      dbp ||
      (dbp = new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open("plateplanner", 1);
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains("img")) r.result.createObjectStore("img");
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      }))
    );
  };
  const st = (mode: IDBTransactionMode) => open().then((db) => db.transaction("img", mode).objectStore("img"));
  return {
    get: (k: string): Promise<string | null> =>
      st("readonly")
        .then(
          (s) =>
            new Promise<string | null>((res) => {
              const r = s.get(k);
              r.onsuccess = () => res((r.result as string) || null);
              r.onerror = () => res(null);
            }),
        )
        .catch(() => null),
    set: (k: string, v: string): Promise<void> => st("readwrite").then((s) => { s.put(v, k); }).catch(() => {}),
    del: (k: string): Promise<void> => st("readwrite").then((s) => { s.delete(k); }).catch(() => {}),
  };
})();

/* ── L3: Supabase Storage public read (cross-device / cross-user) ── */
const SB_PUBLIC = "https://qzqvwbucjxwgtmbdkrlu.supabase.co/storage/v1/object/public/meal-images/";
async function sigUrl(sig: string): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sig));
    return SB_PUBLIC + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("") + ".png";
  } catch {
    return null; // no SubtleCrypto (insecure context) → skip L3, never throw
  }
}

/**
 * Resolve a cached image for `sig` across L1→L2→L3 (no generation, no key needed).
 * Returns the image (data URL or public URL) or null if nothing is cached anywhere.
 */
export async function resolveCachedImage(sig: string): Promise<string | null> {
  if (IMG_CACHE[sig]) return IMG_CACHE[sig];
  const fromIdb = await IDB.get(sig);
  if (fromIdb) {
    IMG_CACHE[sig] = fromIdb;
    return fromIdb;
  }
  // L3: probe central cache directly — if anyone generated this exact meal, it appears free
  const url = await sigUrl(sig);
  if (!url) return null;
  const ok = await new Promise<boolean>((res) => {
    const probe = new Image();
    probe.onload = () => res(true);
    probe.onerror = () => res(false);
    probe.src = url;
  });
  if (ok) {
    IMG_CACHE[sig] = url;
    void IDB.set(sig, url);
    return url;
  }
  return null;
}

export type GenResult = { image: string } | { error: string };

/**
 * Generate (or fetch-cached) the meal photo via the SAME POST /api/plate-image flow v1 uses.
 * BYO key (provider+apiKey passed from the caller). De-dupes concurrent calls per sig and
 * writes the result back into L1 + L2 so it survives refresh and is shared with v1.
 */
export async function generateMealImage(
  m: Meal,
  apiKey: string,
  provider: "gemini" | "openai" = "gemini",
): Promise<GenResult> {
  const sig = mealSig(m);
  if (IMG_CACHE[sig]) return { image: IMG_CACHE[sig] };
  if (IMG_INFLIGHT.has(sig)) return { error: "กำลังสร้างภาพอยู่ — รอสักครู่" };
  IMG_INFLIGHT.add(sig);
  try {
    const r = await fetch("/api/plate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, prompt: buildImagePrompt(m), sig }),
    });
    const d = await r.json();
    if (d.image) {
      IMG_CACHE[sig] = d.image;
      void IDB.set(sig, d.image);
      return { image: d.image };
    }
    return { error: d.error || "สร้างภาพไม่สำเร็จ" };
  } catch {
    return { error: "เรียก backend ไม่ได้ ลองใหม่อีกครั้ง" };
  } finally {
    IMG_INFLIGHT.delete(sig);
  }
}

/** Forget a cached image (L1 + L2) so the next request regenerates it. */
export function clearMealImage(sig: string): void {
  delete IMG_CACHE[sig];
  void IDB.del(sig);
}

/* ── Prompt builder (English label maps — ported from v1, UI concern only) ── */
const EN: Record<string, string> = {
  "อกไก่ (สุก)": "grilled chicken breast", "ไข่ไก่ทั้งฟอง": "whole eggs", "ไข่ขาว": "egg whites",
  "ปลานิล (สุก)": "tilapia fillet", "ปลาแซลมอน": "salmon", "หมูสันใน": "pork tenderloin",
  "เนื้อวัวไม่ติดมัน": "lean beef", "กุ้งขาว": "shrimp", "ทูน่ากระป๋องในน้ำ": "canned tuna",
  "เต้าหู้แข็ง": "firm tofu", "กรีกโยเกิร์ตจืด": "plain Greek yogurt", "เวย์โปรตีน": "whey protein",
  "ข้าวสวย": "steamed jasmine rice", "ข้าวกล้อง": "brown rice", "มันเทศ (สุก)": "sweet potato",
  "ข้าวโอ๊ต (ดิบ)": "oats", "ขนมปังโฮลวีต": "whole-wheat bread", "กล้วย": "banana",
  "บรอกโคลี": "broccoli", "ผักบุ้ง": "morning glory", "คะน้า": "Chinese kale", "กะหล่ำปลี": "cabbage",
  "เห็ดออรินจิ": "king oyster mushroom", "ผักกาดขาว": "napa cabbage", "น้ำมันมะกอก": "olive oil",
  "น้ำมันรำข้าว": "rice bran oil", "อะโวคาโด": "avocado", "อัลมอนด์": "almonds",
  "เมล็ดฟักทอง": "pumpkin seeds", "ปลากะพง": "sea bass fillet", "ปลาทูนึ่ง": "steamed mackerel",
  "ปลาหมึก": "squid", "สะโพกไก่ลอกหนัง": "skinless chicken thigh", "ข้าวไรซ์เบอร์รี": "riceberry purple rice",
  "มันฝรั่ง (สุก)": "boiled potato", "เส้นก๋วยเตี๋ยว (ลวก)": "rice noodles", "วุ้นเส้น (ลวก)": "glass noodles",
  "แตงกวา": "cucumber", "มะเขือเทศ": "tomato", "เห็ดหอม": "shiitake mushroom", "ถั่วฝักยาว": "yardlong beans",
  "ฟักเขียว": "winter melon", "พริกหวาน": "bell pepper", "ฟักทอง (สุก)": "pumpkin",
  "เม็ดมะม่วงหิมพานต์": "cashews", "งา": "sesame seeds", "ปลาดุกย่าง (เลี้ยง)": "grilled catfish",
  "ปลาซาบะย่าง": "grilled saba mackerel", "หอยแมลงภู่ลวก": "steamed mussels", "หอยลายลวก": "blanched clams",
  "ปูม้านึ่ง": "steamed blue crab", "เอ็นดามาเมะ (ถั่วแระต้ม)": "boiled edamame", "ถั่วเหลืองต้ม": "boiled soybeans",
  "อกเป็ดลอกหนัง (ย่าง)": "grilled skinless duck breast", "เต้าหู้ขาวอ่อน": "soft tofu",
  "คอตเทจชีส (ไขมัน 2%)": "cottage cheese", "นมจืด (โฮลมิลค์)": "glass of milk",
  "นมถั่วเหลืองไม่หวาน": "unsweetened soy milk", "ข้าวเหนียวสุก": "steamed sticky rice",
  "ข้าวโพดหวานต้ม": "boiled sweet corn", "เผือกต้ม": "boiled taro", "ควินัวสุก": "cooked quinoa",
  "เส้นใหญ่สุก": "wide rice noodles", "ลูกเดือยสุก": "cooked job's tears", "ขนมจีน": "fermented rice noodles",
  "มันสำปะหลังต้ม": "boiled cassava", "ดอกกะหล่ำ": "cauliflower", "แครอท": "carrot", "มะเขือยาว": "eggplant",
  "มะระ": "bitter gourd", "ถั่วงอก": "bean sprouts", "ผักกาดหอม": "lettuce", "กวางตุ้ง": "pak choi",
  "ผักโขม": "amaranth greens", "หน่อไม้ต้ม": "boiled bamboo shoots", "ข้าวโพดอ่อน": "baby corn",
  "เห็ดเข็มทอง": "enoki mushrooms", "เห็ดฟาง": "straw mushrooms", "บวบ": "luffa gourd", "ขึ้นฉ่าย": "Chinese celery",
  "ตำลึง (ใบ)": "ivy gourd leaves", "แอปเปิล": "apple", "ส้ม": "orange", "มะละกอสุก": "ripe papaya",
  "ฝรั่ง": "guava", "แตงโม": "watermelon", "สับปะรด": "pineapple", "มะม่วงสุก": "ripe mango", "องุ่น": "grapes",
  "สตรอเบอร์รี": "strawberries", "แก้วมังกร": "dragon fruit", "วอลนัท": "walnuts", "ถั่วลิสง": "peanuts",
  "เนยถั่ว": "peanut butter", "เมล็ดทานตะวัน": "sunflower seeds", "เมล็ดเจีย": "chia seeds",
};
const COOK: Record<string, string> = {
  ย่าง: "grilled", ต้มยำ: "in spicy tom-yum soup", ผัดกระเทียมพริกไทย: "stir-fried with garlic and pepper",
  นึ่งซีอิ๊ว: "steamed with light soy sauce", อบสมุนไพร: "herb-roasted", ลวกจิ้มแจ่ว: "blanched, served with spicy nam-jim dip",
  ผัดพริกแกง: "stir-fried in red curry paste", ต้มจืด: "in a clear broth", ยำ: "in a spicy Thai salad (yum)",
  เจียว: "as a fluffy Thai omelette", ดาว: "as a fried egg", ต้ม: "boiled", ทอด: "crispy pan-fried",
  ราดพริก: "topped with Thai sweet chili sauce",
};
const en = (it: MealItem): string => EN[it.th] || it.th.replace(/\s*\(.*?\)\s*/g, "").trim();
const FRUIT = new Set(["กล้วย", "มะละกอ", "ฝรั่ง", "แอปเปิล", "ส้ม"]);
const DAIRY = new Set(["กรีกโยเกิร์ตจืด", "นมจืด", "คอตเทจชีส (ไขมัน 2%)", "นมจืด (โฮลมิลค์)", "นมถั่วเหลืองไม่หวาน"]);

/** Build the food-photo prompt (top-down realistic plate) — ported from v1 buildImagePrompt. */
export function buildImagePrompt(m: Meal): string {
  const items = m.items.filter((it) => it.cat !== "shake"); // shakes aren't plated food
  const oils = items.filter((it) => /น้ำมัน/.test(it.th));
  const fruit = items.filter((it) => it.cat === "fruit" || FRUIT.has(it.th));
  const dairy = items.filter((it) => DAIRY.has(it.th));
  const seeds = items.filter((it) => it.cat === "fat" && !oils.includes(it) && it.th !== "อะโวคาโด");
  const savory = items.filter(
    (it) => !oils.includes(it) && !fruit.includes(it) && !dairy.includes(it) && !seeds.includes(it),
  );
  const parts: string[] = [];
  if (savory.length) {
    const cook = m.style ? " " + (COOK[m.style] || m.style) : "";
    const oilTxt = oils.length ? `, lightly cooked with ${oils.map((o) => en(o)).join(" and ")}` : "";
    parts.push(
      `a white ceramic plate of ${savory.map((it) => `${it.g}g ${en(it)}`).join(", ")}${cook}${oilTxt}, protein-first plating`,
    );
  }
  if (dairy.length) {
    const top = seeds.length ? ` topped with ${seeds.map((s) => en(s)).join(" and ")}` : "";
    parts.push(`a separate small bowl of ${dairy.map((d) => `${d.g}g ${en(d)}`).join(" and ")}${top}`);
  } else if (seeds.length) {
    parts.push(`a small separate side dish of ${seeds.map((s) => en(s)).join(" and ")}`);
  }
  if (fruit.length) parts.push(`a separate small bowl of fresh ${fruit.map((f) => en(f)).join(" and ")} on the side`);
  return `Minimalist top-down food photograph on a plain neutral light-wood table, soft natural daylight: ${parts.join(
    "; and ",
  )}. IMPORTANT: show ONLY these exact dishes and nothing else — no rice, no noodles, no extra plates, no additional food or garnish that is not listed above. Each dish sits in its own separate plate or bowl, placed clearly apart, never mixed together. Realistic true-to-life portions, fresh and appetizing, clean professional food photography, 50mm lens, shallow depth of field, high detail. No text, no hands, no cutlery clutter, not an illustration.`;
}
