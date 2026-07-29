import { UsageService } from './usage.service';

function makePrismaMock() {
  return {
    profile: {
      findUnique: jest.fn(),
    },
    dailyUsage: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
}

/**
 * Stands in for EntitlementsService. Real limits now come from the
 * `Entitlement` table (Fase 0, Bloco 3) instead of the old `USAGE_LIMITS`
 * constant, and the launch default for every plan/key is Infinity. Tests
 * below configure this mock per-case instead of relying on a fixed table.
 */
function makeEntitlementsMock() {
  return {
    getLimit: jest.fn(),
    getLimits: jest.fn(),
  };
}

describe('UsageService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let entitlements: ReturnType<typeof makeEntitlementsMock>;
  let service: UsageService;

  beforeEach(() => {
    prisma = makePrismaMock();
    entitlements = makeEntitlementsMock();
    service = new UsageService(prisma as any, entitlements as any);
  });

  describe('checkUsageLimit — Fase 0 launch state (Infinity for everyone)', () => {
    // Behavior change from the pre-entitlements suite: FREE used to be
    // blocked at 3/3/1 (USAGE_LIMITS). ARCHITECTURE.md §3 and the Fase 0
    // roadmap are explicit that we launch free with every limit at Infinity,
    // so this now matches PRO's existing "never blocks" behavior instead of
    // the old finite FREE behavior. That old behavior is not lost — it's
    // exactly what the "active limit" tests below re-verify, just sourced
    // from a mocked EntitlementsService instead of a hardcoded constant.
    it('never blocks a FREE user at launch defaults, and reports limit as -1', async () => {
      entitlements.getLimit.mockResolvedValue(Infinity);
      prisma.profile.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.dailyUsage.findUnique.mockResolvedValue({ quizzes: 999_999 });

      const result = await service.checkUsageLimit('user-1', 'quizzes');

      expect(result).toEqual({ allowed: true, used: 999_999, limit: -1 });
    });

    it('never blocks a PRO user on a field with an Infinity limit, and reports limit as -1', async () => {
      entitlements.getLimit.mockResolvedValue(Infinity);
      prisma.profile.findUnique.mockResolvedValue({ plan: 'PRO' });
      prisma.dailyUsage.findUnique.mockResolvedValue({ quizzes: 999_999 });

      const result = await service.checkUsageLimit('user-1', 'quizzes');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });

    it('treats a missing profile as FREE plan', async () => {
      entitlements.getLimit.mockResolvedValue(Infinity);
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.dailyUsage.findUnique.mockResolvedValue(null);

      const result = await service.checkUsageLimit('user-1', 'flashcard_sets');

      expect(result).toEqual({ allowed: true, used: 0, limit: -1 });
      expect(entitlements.getLimit).toHaveBeenCalledWith('FREE', 'flashcard_sets');
    });

    it('treats a user with no usage row yet as zero used', async () => {
      entitlements.getLimit.mockResolvedValue(Infinity);
      prisma.profile.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.dailyUsage.findUnique.mockResolvedValue(null);

      const result = await service.checkUsageLimit('user-1', 'audio_sessions');

      expect(result).toEqual({ allowed: true, used: 0, limit: -1 });
    });
  });

  describe('checkUsageLimit — the "limit turned on" path (Fase 7, but must work today)', () => {
    // This is the mechanism Fase 7 flips on by writing finite rows into
    // `Entitlement` — no code change. It has to be proven correct now, while
    // it's dormant, or the first time it actually runs is in production.
    it('allows usage under a finite configured limit', async () => {
      entitlements.getLimit.mockResolvedValue(3);
      prisma.profile.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.dailyUsage.findUnique.mockResolvedValue({ quizzes: 2 });

      const result = await service.checkUsageLimit('user-1', 'quizzes');

      expect(result).toEqual({ allowed: true, used: 2, limit: 3 });
    });

    it('blocks usage once a finite configured limit is reached', async () => {
      entitlements.getLimit.mockResolvedValue(3);
      prisma.profile.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.dailyUsage.findUnique.mockResolvedValue({ quizzes: 3 });

      const result = await service.checkUsageLimit('user-1', 'quizzes');

      expect(result).toEqual({ allowed: false, used: 3, limit: 3 });
    });

    it('finite limits are enforced per plan independently of Infinity fields on the same plan', async () => {
      entitlements.getLimit.mockImplementation((plan: string, key: string) =>
        Promise.resolve(key === 'audio_sessions' ? 5 : Infinity),
      );
      prisma.profile.findUnique.mockResolvedValue({ plan: 'PRO' });
      prisma.dailyUsage.findUnique.mockResolvedValue({ audioSessions: 5 });

      const result = await service.checkUsageLimit('user-1', 'audio_sessions');

      expect(result).toEqual({ allowed: false, used: 5, limit: 5 });
    });
  });

  describe('incrementUsage', () => {
    it('upserts the correct DB field per usage type', async () => {
      await service.incrementUsage('user-1', 'flashcard_sets');
      expect(prisma.dailyUsage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ flashcardSets: 1 }),
          update: { flashcardSets: { increment: 1 } },
        }),
      );

      await service.incrementUsage('user-1', 'audio_sessions');
      expect(prisma.dailyUsage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ audioSessions: 1 }),
          update: { audioSessions: { increment: 1 } },
        }),
      );

      await service.incrementUsage('user-1', 'quizzes');
      expect(prisma.dailyUsage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ quizzes: 1 }),
          update: { quizzes: { increment: 1 } },
        }),
      );
    });
  });

  describe('getUsage', () => {
    it('reports -1 as the limit for Infinity fields at Fase 0 launch defaults', async () => {
      entitlements.getLimits.mockResolvedValue({
        flashcard_sets: Infinity,
        quizzes: Infinity,
        audio_sessions: Infinity,
        ai_daily_tokens: Infinity,
      });
      prisma.profile.findUnique.mockResolvedValue({ plan: 'PRO' });
      prisma.dailyUsage.findUnique.mockResolvedValue({
        flashcardSets: 10,
        quizzes: 7,
        audioSessions: 2,
      });

      const usage = await service.getUsage('user-1');

      expect(usage.plan).toBe('PRO');
      expect(usage.flashcard_sets).toEqual({ used: 10, limit: -1 });
      expect(usage.quizzes).toEqual({ used: 7, limit: -1 });
      expect(usage.audio_sessions).toEqual({ used: 2, limit: -1 });
    });

    it('reports the real number once a plan has a finite configured limit', async () => {
      entitlements.getLimits.mockResolvedValue({
        flashcard_sets: Infinity,
        quizzes: Infinity,
        audio_sessions: 5,
        ai_daily_tokens: Infinity,
      });
      prisma.profile.findUnique.mockResolvedValue({ plan: 'PRO' });
      prisma.dailyUsage.findUnique.mockResolvedValue({
        flashcardSets: 10,
        quizzes: 7,
        audioSessions: 2,
      });

      const usage = await service.getUsage('user-1');

      expect(usage.audio_sessions).toEqual({ used: 2, limit: 5 });
    });
  });
});
