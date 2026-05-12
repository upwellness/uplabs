/**
 * Pipeline: intake + readings → assessment (rules → Gemini → save)
 */
import { aggregateBiomarkers, evaluateRules } from "./rules";
import { checkExclusions, type IntakeData } from "./exclusions";
import { rephraseWithGemini, type GeminiOutput } from "./gemini";

export interface Reading {
  metric_type: string;
  value:       number;
  recorded_at: string;
}

export interface AssessInput {
  customer: {
    name:        string;
    gender?:     string | null;
    birth_year?: number | null;
  };
  intake:    IntakeData & { goal?: string | null; budget_range?: string | null };
  readings:  Reading[];
}

export interface AssessResult {
  blocked:        boolean;
  block_reasons:  string[];
  aggregates?:    Record<string, any>;
  matched_rules?: Array<{ id: string; name: string }>;
  ai_output?:     GeminiOutput;
  raw_input?:     any;
}

export async function runAssessment(input: AssessInput): Promise<AssessResult> {
  // 1) Exclusion check first — block if any red flag
  const age = input.customer.birth_year
    ? new Date().getFullYear() - input.customer.birth_year
    : undefined;
  const block_reasons = checkExclusions({ ...input.intake, age });
  if (block_reasons.length > 0) {
    return { blocked: true, block_reasons };
  }

  // 2) Aggregate biomarkers
  const aggs = aggregateBiomarkers(input.readings);

  // 3) Run rule engine
  const matched = evaluateRules(aggs);
  if (matched.length === 0) {
    return {
      blocked: false,
      block_reasons: [],
      aggregates: aggs,
      matched_rules: [],
      ai_output: {
        summary: "ข้อมูล wearable ของลูกค้ายังไม่พบ pattern ที่ตรงกับ rule ใดๆ",
        observations: [],
        recommendations: [],
        next_step: "บันทึกข้อมูลต่อเนื่องอีก 7-14 วันแล้วประเมินใหม่",
      },
    };
  }

  // 4) Gemini rephrase
  const ai = await rephraseWithGemini({
    customer_name: input.customer.name,
    age,
    gender: input.customer.gender ?? undefined,
    biomarkers: roundForPrompt(aggs),
    matched_rules: matched.map((r) => ({
      name: r.name,
      nutrient_category: r.nutrient_category,
      why_th: r.why_th,
      evidence_grade: r.evidence_grade,
      citation: r.citation,
      skus: r.skus,
    })),
    intake: {
      goal:        input.intake.goal ?? null,
      budget:      input.intake.budget_range ?? null,
      medications: input.intake.medications,
      conditions:  input.intake.conditions,
    },
  });

  return {
    blocked: false,
    block_reasons: [],
    aggregates: aggs,
    matched_rules: matched.map((r) => ({ id: r.id, name: r.name })),
    ai_output: ai,
    raw_input: { intake: input.intake },
  };
}

function roundForPrompt(o: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(o)) {
    out[k] = typeof v === "number" ? +v.toFixed(1) : v;
  }
  return out;
}
