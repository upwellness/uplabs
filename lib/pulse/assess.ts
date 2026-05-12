/**
 * Pipeline: ทุกแหล่งข้อมูล → master snapshot → exclusions → rules → AI → save
 */
import { aggregateBiomarkers, evaluateRules } from "./rules";
import { checkExclusions, type IntakeData } from "./exclusions";
import { rephraseWithGemini, type GeminiOutput } from "./gemini";
import { buildMasterSnapshot, type BuildMasterInput, type MasterSnapshot } from "./master-data";

export interface AssessInput extends BuildMasterInput {
  intake_for_exclusion: IntakeData;
}

export interface AssessResult {
  blocked:        boolean;
  block_reasons:  string[];
  master?:        MasterSnapshot;
  matched_rules?: Array<{ id: string; name: string }>;
  ai_output?:     GeminiOutput;
}

export async function runAssessment(input: AssessInput): Promise<AssessResult> {
  const age = input.customer.birth_year
    ? new Date().getFullYear() - input.customer.birth_year
    : undefined;
  const block_reasons = checkExclusions({ ...input.intake_for_exclusion, age });
  if (block_reasons.length > 0) {
    return { blocked: true, block_reasons };
  }

  // Build master snapshot from all sources
  const master = buildMasterSnapshot(input);

  // Build biomarker aggregates from pulse readings for rule engine
  const aggs = aggregateBiomarkers(input.pulse_readings);

  // Add BCA-derived data into aggs so rules can use them
  if (master.body_fat_pct?.value != null) aggs.body_fat_pct = Number(master.body_fat_pct.value);
  if (master.weight?.value      != null) aggs.weight       = Number(master.weight.value);

  const matched = evaluateRules(aggs);

  // Always run Gemini even if matched is small — it has more context now
  const ai = await rephraseWithGemini({
    master,
    matched_rules: matched.map((r) => ({
      name: r.name,
      nutrient_category: r.nutrient_category,
      why_th: r.why_th,
      evidence_grade: r.evidence_grade,
      skus: r.skus,
    })),
  });

  return {
    blocked: false,
    block_reasons: [],
    master,
    matched_rules: matched.map((r) => ({ id: r.id, name: r.name })),
    ai_output: ai,
  };
}
