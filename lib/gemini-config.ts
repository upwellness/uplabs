/**
 * Which Gemini models this app calls.
 *
 * ⚠️ HISTORY: we pinned `gemini-2.5-flash`, and on 9 ก.ค. 2026 Google stopped serving
 * it to new API keys — every AI feature returned
 *   404 "This model models/gemini-2.5-flash is no longer available to new users".
 * Pinning an exact version guarantees this repeats at the next retirement, so the
 * default is now the **alias that always points at the current flash model**.
 *
 * Override per environment with GEMINI_MODEL / GEMINI_IMAGE_MODEL when a specific
 * version is needed (e.g. to pin behaviour for a while).
 * Model list: https://ai.google.dev/gemini-api/docs/models
 */

/** Text + vision (CheckForm analyse, clip matcher, NutriScan, Pulse summaries). */
export const GEMINI_TEXT_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

/**
 * Image generation (Plate Planner). No "latest" alias is published for the image
 * models, so we keep an ordered fallback list and move to the next id on a 404 —
 * that way a retirement degrades to one wasted request instead of a dead feature.
 */
export const GEMINI_IMAGE_MODELS: string[] = process.env.GEMINI_IMAGE_MODEL
  ? [process.env.GEMINI_IMAGE_MODEL]
  : ["gemini-3.1-flash-image", "gemini-3.1-flash-image-preview"];
