import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Plan, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { planoEfetivo, SELECAO_DE_PLANO } from '../common/plano-efetivo';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { GeminiService, GeneratedFlashcard, GeneratedQuestion } from '../gemini/gemini.service';
import { AiProvider, AiTask, MODEL_PRICING, TASK_MODEL } from './ai-router.constants';

export interface BudgetCheck {
  allowed: boolean;
  used: number;
  limit: number;
}

/**
 * Sits between domain services and the raw provider clients
 * (OpenaiService/GeminiService). Three jobs, per Fase 0 Bloco 4:
 *
 * 1. Picks the model for a task (`TASK_MODEL`) — one place to change it.
 * 2. Debits a per-user daily token budget (`ai_daily_tokens` entitlement,
 *    Infinity at launch — see EntitlementsService) before calling the
 *    provider, and throws if it's exhausted.
 * 3. Writes every call to `AiUsageLedger`, so cost is visible per user/day
 *    before it's ever enforced.
 *
 * It also generalizes the `AudioClip.textHash` cache pattern to deterministic
 * content generation: `generateFlashcards`/`generateQuiz` hash
 * (task, language, source content) and skip the LLM call entirely on a hit.
 *
 * Scope note: this is fully wired into `GenerateService` (flashcards/quiz),
 * which is where Bloco 3 already required an entitlements migration. Other
 * AI call sites (lesson transcription/structuring, audio TTS/script
 * planning) currently only call `record()` for ledger visibility — they are
 * NOT yet budget-gated or cached through this router. See the Fase 0 handoff
 * report for why that line was drawn where it was.
 */
@Injectable()
export class AiRouterService {
  private readonly logger = new Logger(AiRouterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly gemini: GeminiService,
  ) {}

  modelFor(task: AiTask) {
    return TASK_MODEL[task];
  }

  // ─── Budget ───

  private async tokensUsedToday(userId: string): Promise<number> {
    const agg = await this.prisma.aiUsageLedger.aggregate({
      where: { userId, date: startOfDay(), cacheHit: false },
      _sum: { inputTokens: true, outputTokens: true },
    });
    return (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0);
  }

  async checkBudget(userId: string): Promise<BudgetCheck> {
    const plan = await this.planFor(userId);
    const limit = await this.entitlements.getLimit(plan, 'ai_daily_tokens');
    if (limit === Infinity) {
      return { allowed: true, used: 0, limit: -1 };
    }
    const used = await this.tokensUsedToday(userId);
    return { allowed: used < limit, used, limit };
  }

  private async planFor(userId: string): Promise<Plan> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: SELECAO_DE_PLANO,
    });
    return planoEfetivo(profile);
  }

  // ─── Cost estimation ───

  private cost(model: string, inputUnits: number, outputUnits: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      this.logger.warn(`No pricing entry for model "${model}" — recording estimated cost as 0`);
      return 0;
    }
    if (pricing.kind === 'tokens') {
      return (inputUnits / 1_000_000) * pricing.inputPer1M + (outputUnits / 1_000_000) * pricing.outputPer1M;
    }
    if (pricing.kind === 'perMinute') {
      return (inputUnits / 60) * pricing.usd;
    }
    return (inputUnits / 1_000_000) * pricing.usdPer1M;
  }

  /** Writes one ledger row. Never throws — a broken ledger write must not break the underlying feature. */
  async record(params: {
    userId: string;
    task: AiTask;
    provider: AiProvider;
    model: string;
    inputUnits: number;
    outputUnits?: number;
    cacheHit?: boolean;
  }): Promise<void> {
    const outputUnits = params.outputUnits ?? 0;
    const estimatedCostUsd = params.cacheHit ? 0 : this.cost(params.model, params.inputUnits, outputUnits);

    try {
      await this.prisma.aiUsageLedger.create({
        data: {
          userId: params.userId,
          date: startOfDay(),
          task: params.task,
          provider: params.provider,
          model: params.model,
          inputTokens: Math.max(0, Math.round(params.inputUnits)),
          outputTokens: Math.max(0, Math.round(outputUnits)),
          estimatedCostUsd,
          cacheHit: params.cacheHit ?? false,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write AiUsageLedger entry (user=${params.userId}, task=${params.task}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // ─── Generalized content cache (AudioClip.textHash pattern) ───

  hashContent(task: AiTask, language: string, content: string): string {
    return createHash('sha256').update(`${task}|${language}|${content}`).digest('hex');
  }

  async getCached<T>(hash: string): Promise<T | null> {
    const row = await this.prisma.aiContentCache.findUnique({ where: { contentHash: hash } });
    return row ? (row.result as T) : null;
  }

  async putCached<T>(hash: string, task: AiTask, language: string, result: T): Promise<void> {
    try {
      await this.prisma.aiContentCache.upsert({
        where: { contentHash: hash },
        create: { contentHash: hash, task, language, result: result as unknown as Prisma.InputJsonValue },
        update: { result: result as unknown as Prisma.InputJsonValue },
      });
    } catch (err) {
      this.logger.error(`Failed to write AiContentCache entry (task=${task}): ${err instanceof Error ? err.message : err}`);
    }
  }

  // ─── High-level, budgeted + cached + ledgered entry points ───

  async generateFlashcards(userId: string, content: string, language: string): Promise<GeneratedFlashcard[]> {
    return this.withCacheBudgetLedger<GeneratedFlashcard[]>({
      userId,
      task: 'flashcards',
      language,
      cacheContent: content,
      run: () => this.gemini.generateFlashcardsWithUsage(content, language),
    });
  }

  async generateQuiz(userId: string, content: string, language: string): Promise<GeneratedQuestion[]> {
    return this.withCacheBudgetLedger<GeneratedQuestion[]>({
      userId,
      task: 'quiz',
      language,
      cacheContent: content,
      run: () => this.gemini.generateQuizWithUsage(content, language),
    });
  }

  private async withCacheBudgetLedger<T>(params: {
    userId: string;
    task: AiTask;
    language: string;
    cacheContent: string;
    run: () => Promise<{ result: T; inputTokens: number; outputTokens: number }>;
  }): Promise<T> {
    const { userId, task, language, cacheContent, run } = params;
    const { provider, model } = TASK_MODEL[task];
    const hash = this.hashContent(task, language, cacheContent);

    const cached = await this.getCached<T>(hash);
    if (cached !== null) {
      await this.record({ userId, task, provider, model, inputUnits: 0, outputUnits: 0, cacheHit: true });
      return cached;
    }

    const budget = await this.checkBudget(userId);
    if (!budget.allowed) {
      throw new ForbiddenException({
        code: 'AI_BUDGET_EXCEEDED',
        used: budget.used,
        limit: budget.limit,
      });
    }

    const { result, inputTokens, outputTokens } = await run();

    await this.record({ userId, task, provider, model, inputUnits: inputTokens, outputUnits: outputTokens });
    await this.putCached(hash, task, language, result);

    return result;
  }
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
