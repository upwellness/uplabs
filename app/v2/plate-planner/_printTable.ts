/**
 * UP Labs v2 · Plate Planner — "บันทึก PDF" food table (module-local)
 * ──────────────────────────────────────────────────────────────────
 * Produces a clean, customer-ready DAY × MEAL food table and prints it (Save as PDF).
 *
 * WHY a popup window (not the in-app DOM): the planner lives inside the v2 Shell (sticky
 * nav, tabs, sidebar) and only one day is mounted at a time. To paginate ALL days as a
 * real table we render a self-contained HTML doc with its own @media print rules in a new
 * window and call print() there — reliable multi-page tables, nothing from the app leaks
 * in. Each cell = meal name + (style·main) + foods w/ portions + the meal's C:P:F. The
 * header carries the customer name + the daily targets when ?customer prefill is active.
 *
 * Pure data → HTML string. No nutrition math: reads the engine's per-meal grams as-is.
 */

import type { DayPlan, Goal, MealItem, Targets } from "@/lib/plate-planner/engine";

const esc = (s: string): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Portion label — mirrors the engine/LINE bot "≈ N unit · Ng" with 0.5-step rounding. */
function portionLabel(it: MealItem): string {
  if (it.cat === "shake") return "1 แก้ว";
  if (it.ug > 0) {
    const x = it.g / it.ug;
    const q = x >= 3 ? String(Math.round(x)) : (() => { const h = Math.round(x * 2) / 2; return h < 0.5 ? "" : h === 0.5 ? "½" : String(h); })();
    if (q) return `≈ ${q} ${it.u} · ${it.g}g`;
  }
  return `${it.g}g`;
}

const GOAL_LABEL: Record<Goal, string> = { loss: "ลดน้ำหนัก", longevity: "Longevity", muscle: "สร้างกล้ามเนื้อ" };

export interface PrintMeta {
  goal: Goal;
  targets: Targets;
  customerName?: string | null;
  diet?: string;
}

/** Build the standalone printable HTML document (day × meal food table). */
export function buildPrintHTML(plan: DayPlan[], meta: PrintMeta): string {
  const { goal, targets, customerName, diet } = meta;
  const today = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  const rows = plan
    .map((day, di) => {
      const cells = day
        .map((m) => {
          const head = `<div class="mname">${esc(m.name)}</div>${
            !m.snack && (m.style || m.main)
              ? `<div class="msub">${[m.style, m.main].filter(Boolean).map(esc).join(" · ")}</div>`
              : ""
          }`;
          const foods = m.items
            .map(
              (it) =>
                `<li><span class="fname">${esc(it.cat === "shake" ? it.th : it.th.replace(/\s*\(.*?\)/, ""))}</span><span class="fqty">${esc(
                  portionLabel(it),
                )}</span></li>`,
            )
            .join("");
          const cpf = `<div class="cpf">C ${Math.round(m.tot.c)} · P ${Math.round(m.tot.p)} · F ${Math.round(
            m.tot.f,
          )} <b>${m.tot.kcal} kcal</b></div>`;
          return `<td>${head}<ul class="foods">${foods}</ul>${cpf}</td>`;
        })
        .join("");
      const dayTot = day.reduce((s, m) => ({ p: s.p + m.tot.p, c: s.c + m.tot.c, f: s.f + m.tot.f, kcal: s.kcal + m.tot.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
      return `<tr><th class="daycol">วันที่ ${di + 1}<div class="daytot">${Math.round(dayTot.kcal)} kcal<br>C${Math.round(dayTot.c)} P${Math.round(dayTot.p)} F${Math.round(dayTot.f)}</div></th>${cells}</tr>`;
    })
    .join("");

  // meal column headers = the meal names of day 1 (plans share the same meal structure)
  const mealHeads = (plan[0] || []).map((m) => `<th>${esc(m.name)}</th>`).join("");

  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ตารางอาหาร${customerName ? " · " + esc(customerName) : ""}</title>
<style>
  :root { --ink:#18151A; --ink60:#5C5660; --ink40:#8A838E; --line:#E7E3E8; --rose:#8C4C4C; --amber:#C47A2A; --science:#2A7B8F; --wellness:#396755; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", "Sarabun", "Noto Sans Thai", sans-serif; color: var(--ink); margin: 24px; font-size: 12px; line-height: 1.5; }
  header { border-bottom: 2px solid var(--wellness); padding-bottom: 12px; margin-bottom: 16px; }
  .brand { font-size: 11px; letter-spacing: .04em; color: var(--wellness); font-weight: 700; text-transform: uppercase; }
  h1 { font-size: 19px; margin: 4px 0 2px; }
  .meta { color: var(--ink60); font-size: 12px; }
  .targets { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .tg { border: 1px solid var(--line); border-radius: 8px; padding: 5px 10px; font-size: 11px; }
  .tg b { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid var(--line); padding: 8px; vertical-align: top; text-align: left; }
  thead th { background: #F7F5F3; font-size: 11px; color: var(--ink60); }
  .daycol { width: 64px; background: #F7F5F3; font-weight: 700; font-size: 12px; }
  .daytot { font-weight: 400; color: var(--ink40); font-size: 9px; margin-top: 4px; }
  .mname { font-weight: 700; font-size: 12px; }
  .msub { color: var(--wellness); font-size: 10px; margin-top: 1px; }
  ul.foods { list-style: none; margin: 5px 0; padding: 0; }
  ul.foods li { display: flex; justify-content: space-between; gap: 6px; padding: 1px 0; }
  .fname { min-width: 0; }
  .fqty { color: var(--ink40); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cpf { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--line); color: var(--ink60); font-size: 10px; }
  .cpf b { color: var(--ink); }
  tr { page-break-inside: avoid; }
  footer { margin-top: 14px; color: var(--ink40); font-size: 10px; }
  @media print {
    body { margin: 12mm; }
    @page { size: A4 landscape; margin: 10mm; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style></head>
<body>
  <header>
    <div class="brand">UP Labs · Plate Planner</div>
    <h1>ตารางอาหาร${customerName ? " — " + esc(customerName) : ""}</h1>
    <div class="meta">เป้าหมาย ${esc(GOAL_LABEL[goal])} · ${plan.length} วัน${diet && diet !== "ไม่จำกัด" ? " · " + esc(diet) : ""} · จัดทำ ${esc(today)}</div>
    <div class="targets">
      <span class="tg">พลังงาน <b>${targets.kcal.toLocaleString()}</b> kcal/วัน</span>
      <span class="tg">โปรตีน <b>${targets.p}</b> g</span>
      <span class="tg">คาร์บ <b>${targets.c}</b> g</span>
      <span class="tg">ไขมัน <b>${targets.f}</b> g</span>
      <span class="tg">BMI <b>${targets.bmi}</b></span>
    </div>
  </header>
  <table>
    <thead><tr><th class="daycol">วัน</th>${mealHeads}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <footer>ค่ามาโครต่อมื้อจาก UP Labs Plate Planner (Muscle-Centric · Dr. Gabrielle Lyon) · ปริมาณเป็นค่าประมาณเพื่อวางแผนมื้ออาหาร ไม่ใช่คำสั่งทางการแพทย์</footer>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 350); };</script>
</body></html>`;
}

/** Open the printable food table in a new window and trigger the print/PDF dialog. */
export function printFoodTable(plan: DayPlan[], meta: PrintMeta): boolean {
  if (!plan.length || typeof window === "undefined") return false;
  const html = buildPrintHTML(plan, meta);
  const win = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
  if (!win) return false; // popup blocked — caller surfaces the message
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
