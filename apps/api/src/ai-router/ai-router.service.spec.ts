import { ForbiddenException } from '@nestjs/common';
import { AiRouterService } from './ai-router.service';

function makePrismaMock() {
  return {
    profile: { findUnique: jest.fn() },
    aiUsageLedger: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { inputTokens: 0, outputTokens: 0 } }),
      create: jest.fn().mockResolvedValue({}),
    },
    aiContentCache: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeEntitlementsMock() {
  return { getLimit: jest.fn().mockResolvedValue(Infinity), getLimits: jest.fn() };
}

function makeGeminiMock() {
  return {
    generateFlashcardsWithUsage: jest.fn(),
    generateQuizWithUsage: jest.fn(),
  };
}

describe('AiRouterService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let entitlements: ReturnType<typeof makeEntitlementsMock>;
  let gemini: ReturnType<typeof makeGeminiMock>;
  let service: AiRouterService;

  beforeEach(() => {
    prisma = makePrismaMock();
    entitlements = makeEntitlementsMock();
    gemini = makeGeminiMock();
    service = new AiRouterService(prisma as any, entitlements as any, gemini as any);
    prisma.profile.findUnique.mockResolvedValue({ plan: 'FREE' });
  });

  describe('modelFor', () => {
    it('routes different tasks to their configured model', () => {
      expect(service.modelFor('transcription')).toEqual({ provider: 'openai', model: 'whisper-1' });
      expect(service.modelFor('tts')).toEqual({ provider: 'openai', model: 'tts-1' });
      expect(service.modelFor('quiz')).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
    });
  });

  describe('checkBudget — Fase 0 launch state (Infinity)', () => {
    it('always allows when the ai_daily_tokens entitlement is Infinity', async () => {
      entitlements.getLimit.mockResolvedValue(Infinity);

      const budget = await service.checkBudget('user-1');

      expect(budget).toEqual({ allowed: true, used: 0, limit: -1 });
      // Infinity budget short-circuits before summing today's ledger.
      expect(prisma.aiUsageLedger.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('checkBudget — the "budget turned on" path (Fase 7, but must work today)', () => {
    it('blocks once today\'s token spend reaches a finite configured budget', async () => {
      entitlements.getLimit.mockResolvedValue(1000);
      prisma.aiUsageLedger.aggregate.mockResolvedValue({ _sum: { inputTokens: 700, outputTokens: 300 } });

      const budget = await service.checkBudget('user-1');

      expect(budget).toEqual({ allowed: false, used: 1000, limit: 1000 });
    });

    it('allows spend under a finite configured budget', async () => {
      entitlements.getLimit.mockResolvedValue(1000);
      prisma.aiUsageLedger.aggregate.mockResolvedValue({ _sum: { inputTokens: 100, outputTokens: 50 } });

      const budget = await service.checkBudget('user-1');

      expect(budget).toEqual({ allowed: true, used: 150, limit: 1000 });
    });
  });

  describe('record', () => {
    it('estimates cost from the token pricing table for a chat model', async () => {
      await service.record({
        userId: 'user-1',
        task: 'quiz',
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputUnits: 1_000_000,
        outputUnits: 1_000_000,
      });

      expect(prisma.aiUsageLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          task: 'quiz',
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          estimatedCostUsd: 0.15 + 0.6,
          cacheHit: false,
        }),
      });
    });

    it('records zero cost for a cache hit, regardless of units passed', async () => {
      await service.record({
        userId: 'user-1',
        task: 'flashcards',
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputUnits: 5000,
        outputUnits: 5000,
        cacheHit: true,
      });

      expect(prisma.aiUsageLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ estimatedCostUsd: 0, cacheHit: true }),
      });
    });

    it('does not throw if the ledger write fails', async () => {
      prisma.aiUsageLedger.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.record({ userId: 'user-1', task: 'quiz', provider: 'openai', model: 'gpt-4o-mini', inputUnits: 1 }),
      ).resolves.toBeUndefined();
    });
  });

  describe('generateFlashcards / generateQuiz — cache, budget, ledger', () => {
    it('calls the model on a cache miss and writes result + ledger', async () => {
      gemini.generateFlashcardsWithUsage.mockResolvedValue({
        result: [{ front: 'Q', back: 'A', explain: 'e', imageQuery: 'q' }],
        inputTokens: 200,
        outputTokens: 300,
      });

      const cards = await service.generateFlashcards('user-1', 'some document text', 'en');

      expect(cards).toHaveLength(1);
      expect(gemini.generateFlashcardsWithUsage).toHaveBeenCalledWith('some document text', 'en');
      expect(prisma.aiContentCache.upsert).toHaveBeenCalled();
      expect(prisma.aiUsageLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ task: 'flashcards', inputTokens: 200, outputTokens: 300, cacheHit: false }),
      });
    });

    it('skips the model entirely on a cache hit and records a zero-cost ledger entry', async () => {
      const cachedCards = [{ front: 'Cached Q', back: 'Cached A', explain: 'e', imageQuery: 'q' }];
      prisma.aiContentCache.findUnique.mockResolvedValue({ result: cachedCards });

      const cards = await service.generateQuiz('user-1', 'same document text', 'en');

      expect(cards).toEqual(cachedCards);
      expect(gemini.generateQuizWithUsage).not.toHaveBeenCalled();
      expect(prisma.aiUsageLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ task: 'quiz', cacheHit: true, estimatedCostUsd: 0 }),
      });
    });

    it('throws AI_BUDGET_EXCEEDED and never calls the model when the daily budget is spent', async () => {
      entitlements.getLimit.mockResolvedValue(100);
      prisma.aiUsageLedger.aggregate.mockResolvedValue({ _sum: { inputTokens: 100, outputTokens: 0 } });

      await expect(service.generateFlashcards('user-1', 'doc text', 'en')).rejects.toThrow(ForbiddenException);
      expect(gemini.generateFlashcardsWithUsage).not.toHaveBeenCalled();
    });

    it('hashes on (task, language, content) so different content never collides in the cache', async () => {
      await service.generateFlashcards('user-1', 'content A', 'en').catch(() => undefined);
      const hashA = prisma.aiContentCache.findUnique.mock.calls[0][0].where.contentHash;

      prisma.aiContentCache.findUnique.mockClear();
      await service.generateFlashcards('user-1', 'content B', 'en').catch(() => undefined);
      const hashB = prisma.aiContentCache.findUnique.mock.calls[0][0].where.contentHash;

      expect(hashA).not.toBe(hashB);
    });
  });
});
