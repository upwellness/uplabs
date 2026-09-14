import { NextResponse } from "next/server";
import { customerByPortalToken, explainUsedToday, logPortalEvent, PORTAL_EXPLAIN_CAP } from "@/lib/health-design/portal";
import { latestAssessment } from "@/lib/health-design/load";
import { currentPlan } from "@/lib/health-design/plan-store";
import { buildFacts, buildPrompt, fallbackAnswer, validateAnswer, SYSTEM_PROMPT, EXPLAIN_DISCLAIMER, type ExplainTarget } from "@/lib/health-design/explain";
import { geminiGenerate } from "@/lib/gemini-call";
import { GEMINI_TEXT_MODEL } from "@/lib/gemini-config";
import type { DomainKey } from "@/lib/health-design/assess";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const DOMAINS = new Set<DomainKey>(["metabolic", "body_comp", "cardio_lipid", "liver_kidney", "recovery", "nutrition", "health_age"]);

/**
 * POST { kind: "metric", domain, metric } | { kind: "domain", domain } | { kind: "overview" }
 * → { answer: { what, where, action }, ai: boolean, facts, disclaimer, quota: { used, cap } }
 *
 * BYO-key exception #3 (AGENTS.md): the server Gemini key rephrases engine-graded facts
 * for a customer who has no key; capped per customer per day; every call logged.
 * When the key is missing, the cap is hit, or the answer fails validation, the customer
 * still gets an answer — the engine's own words (`ai: false`).
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const c = await customerByPortalToken(params.token);
  if (!c) return NextResponse.json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" }, { status: 404 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "body ต้องเป็น JSON" }, { status: 400 }); }

  let target: ExplainTarget;
  if (body?.kind === "overview") target = { kind: "overview" };
  else if (body?.kind === "domain" && DOMAINS.has(body.domain)) target = { kind: "domain", domain: body.domain };
  else if (body?.kind === "metric" && DOMAINS.has(body.domain) && typeof body.metric === "string" && /^[a-z0-9_]{1,40}$/.test(body.metric)) target = { kind: "metric", domain: body.domain, metric: body.metric };
  else return NextResponse.json({ error: "ระบุ kind/domain/metric ให้ถูกต้อง" }, { status: 400 });

  const [stored, plan] = await Promise.all([latestAssessment(c.id), currentPlan(c.id)]);
  if (!stored) return NextResponse.json({ error: "ยังไม่มีผลประเมิน" }, { status: 404 });
  const gender = c.gender === "male" || c.gender === "female" ? c.gender : null;
  const final = plan && (plan.status === "sent" || plan.status === "confirmed") ? plan.final : null;
  const facts = buildFacts(target, stored.assessment, final, gender);
  if ("error" in facts) return NextResponse.json({ error: facts.error }, { status: 404 });

  const used = await explainUsedToday(c.id);
  const key = process.env.GEMINI_API_KEY ?? "";
  const quota = { used, cap: PORTAL_EXPLAIN_CAP };
  const respond = (answer: ReturnType<typeof fallbackAnswer>, ai: boolean, note?: string) =>
    NextResponse.json({ answer, ai, note: note ?? null, facts: facts.facts, actions: facts.actions, disclaimer: EXPLAIN_DISCLAIMER, quota }, { headers: { "cache-control": "no-store" } });

  if (!key) return respond(fallbackAnswer(facts), false, "ระบบ AI ยังไม่พร้อม — แสดงคำอธิบายจากระบบแทน");
  if (used >= PORTAL_EXPLAIN_CAP) return respond(fallbackAnswer(facts), false, `วันนี้ใช้ AI อธิบายครบ ${PORTAL_EXPLAIN_CAP} ครั้งแล้ว — แสดงคำอธิบายจากระบบแทน`);

  await logPortalEvent(c.id, "explain", { kind: target.kind, domain: (target as any).domain ?? null, metric: (target as any).metric ?? null });
  quota.used = used + 1;
  try {
    const json = await geminiGenerate(GEMINI_TEXT_MODEL, key, {
      contents: [{ parts: [{ text: buildPrompt(facts) }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 700, responseMimeType: "application/json" },
    });
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const v = validateAnswer(parsed, facts.numbers);
    if (!v.ok) { console.warn("[portal explain] discarded:", v.reason); return respond(fallbackAnswer(facts), false, "คำตอบของ AI ไม่ผ่านการตรวจ — แสดงคำอธิบายจากระบบแทน"); }
    return respond(v.answer, true);
  } catch (e: any) {
    console.error("[portal explain]", e?.message ?? e);
    return respond(fallbackAnswer(facts), false, "AI ตอบไม่สำเร็จ — แสดงคำอธิบายจากระบบแทน");
  }
}
