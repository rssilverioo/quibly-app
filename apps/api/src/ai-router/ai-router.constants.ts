/**
 * Tasks the app pays an AI provider for. Centralizing the list (and the
 * model each one uses, below) is the whole point of AiRouter: swapping the
 * model for one task is a one-line change here instead of a hunt through
 * domain services for a hardcoded model string.
 */
export type AiTask =
  | 'flashcards'
  | 'quiz'
  | 'lesson_structuring'
  | 'lesson_qa'
  | 'ocr'
  | 'transcription'
  | 'audio_script'
  | 'tts'
  | 'explain';

export type AiProvider = 'openai' | 'gemini';

export interface ModelChoice {
  provider: AiProvider;
  model: string;
}

/**
 * Task → model routing table.
 *
 * Note on naming: `GeminiService` is, today, entirely an OpenAI chat
 * completions client (`gpt-4o-mini`) — nothing in this codebase currently
 * calls Google's Gemini API despite the name. That's a pre-existing
 * inconsistency this task didn't introduce and doesn't fix (renaming it
 * would touch every domain service that injects `GeminiService`, which is
 * out of scope here) — flagged in the handoff report as a naming trap for
 * whoever wires up a real Gemini model next.
 */
export const TASK_MODEL: Record<AiTask, ModelChoice> = {
  transcription: { provider: 'openai', model: 'whisper-1' },
  tts: { provider: 'openai', model: 'tts-1' },
  flashcards: { provider: 'openai', model: 'gpt-4o-mini' },
  quiz: { provider: 'openai', model: 'gpt-4o-mini' },
  lesson_structuring: { provider: 'openai', model: 'gpt-4o-mini' },
  lesson_qa: { provider: 'openai', model: 'gpt-4o-mini' },
  ocr: { provider: 'openai', model: 'gpt-4o-mini' },
  audio_script: { provider: 'openai', model: 'gpt-4o-mini' },
  explain: { provider: 'openai', model: 'gpt-4o-mini' },
};

export type ModelPricing =
  | { kind: 'tokens'; inputPer1M: number; outputPer1M: number }
  | { kind: 'perMinute'; usd: number }
  | { kind: 'perChar'; usdPer1M: number };

/**
 * USD pricing per model, approximate as of the provider's published rates at
 * time of writing. Good enough for a cost *signal* on the admin dashboard,
 * not for finance-grade accounting — revisit when providers change pricing.
 *
 * `inputUnits`/`outputUnits` passed to `AiRouterService.record()` mean
 * different things depending on `kind`:
 *  - 'tokens': real token counts (chat completions)
 *  - 'perMinute': `inputUnits` = audio seconds, `outputUnits` unused
 *  - 'perChar': `inputUnits` = character count of the text sent to TTS
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': { kind: 'tokens', inputPer1M: 0.15, outputPer1M: 0.6 },
  'whisper-1': { kind: 'perMinute', usd: 0.006 },
  'tts-1': { kind: 'perChar', usdPer1M: 15 },
};
