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

describe('UsageService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: UsageService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new UsageService(prisma as any);
  });

  describe('checkUsageLimit', () => {
    it('allows usage under the FREE plan limit', async () => {
      prisma.profile.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.dailyUsage.findUnique.mockResolvedValue({ quizzes: 2 });

      const result = await service.checkUsageLimit('user-1', 'quizzes');

      expect(result).toEqual({ allowed: true, used: 2, limit: 3 });
    });

    it('blocks usage once the FREE plan limit is reached', async () => {
      prisma.profile.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.dailyUsage.findUnique.mockResolvedValue({ quizzes: 3 });

      const result = await service.checkUsageLimit('user-1', 'quizzes');

      expect(result).toEqual({ allowed: false, used: 3, limit: 3 });
    });

    it('never blocks a PRO user on a field with an Infinity limit, and reports limit as -1', async () => {
      prisma.profile.findUnique.mockResolvedValue({ plan: 'PRO' });
      // Absurdly high usage — still must be allowed under an Infinity limit.
      prisma.dailyUsage.findUnique.mockResolvedValue({ quizzes: 999_999 });

      const result = await service.checkUsageLimit('user-1', 'quizzes');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });

    it('finite PRO limits (e.g. audio_sessions) are still enforced, unlike Infinity fields', async () => {
      prisma.profile.findUnique.mockResolvedValue({ plan: 'PRO' });
      prisma.dailyUsage.findUnique.mockResolvedValue({ audioSessions: 5 });

      const result = await service.checkUsageLimit('user-1', 'audio_sessions');

      expect(result).toEqual({ allowed: false, used: 5, limit: 5 });
    });

    it('treats a missing profile as FREE plan', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.dailyUsage.findUnique.mockResolvedValue(null);

      const result = await service.checkUsageLimit('user-1', 'flashcard_sets');

      expect(result).toEqual({ allowed: true, used: 0, limit: 3 });
    });

    it('treats a user with no usage row yet as zero used', async () => {
      prisma.profile.findUnique.mockResolvedValue({ plan: 'FREE' });
      prisma.dailyUsage.findUnique.mockResolvedValue(null);

      const result = await service.checkUsageLimit('user-1', 'audio_sessions');

      expect(result).toEqual({ allowed: true, used: 0, limit: 1 });
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
    it('reports -1 as the limit for Infinity fields and the real number otherwise', async () => {
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
      expect(usage.audio_sessions).toEqual({ used: 2, limit: 5 });
    });
  });
});
