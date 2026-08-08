import { EntitlementsService } from './entitlements.service';
import { ENTITLEMENT_KEYS, FREE_ROOMS } from './entitlements.constants';
import { DEFAULT_DAILY_STUDY_MINUTES_CAP } from '../sessions/session-timing';

function makePrismaMock() {
  return {
    entitlement: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };
}

describe('EntitlementsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: EntitlementsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new EntitlementsService(prisma as any);
  });

  describe('getLimit — Fase 0 launch state (everything unlocked)', () => {
    it('resolves Infinity for FREE when no row is configured (unseeded table)', async () => {
      prisma.entitlement.findUnique.mockResolvedValue(null);

      const limit = await service.getLimit('FREE', 'flashcard_sets');

      expect(limit).toBe(Infinity);
    });

    it('resolves Infinity for PRO ai_daily_tokens when no row is configured', async () => {
      prisma.entitlement.findUnique.mockResolvedValue(null);

      const limit = await service.getLimit('PRO', 'ai_daily_tokens');

      expect(limit).toBe(Infinity);
    });

    it('resolves Infinity when a row exists but limitValue is explicitly NULL', async () => {
      prisma.entitlement.findUnique.mockResolvedValue({ plan: 'FREE', key: 'quizzes', limitValue: null });

      const limit = await service.getLimit('FREE', 'quizzes');

      expect(limit).toBe(Infinity);
    });

    it('fails open to the default (Infinity) if the DB read throws', async () => {
      prisma.entitlement.findUnique.mockRejectedValue(new Error('connection reset'));

      const limit = await service.getLimit('FREE', 'quizzes');

      expect(limit).toBe(Infinity);
    });
  });

  describe('getLimit — the "limit turned on" path (Fase 7, but must work today)', () => {
    // This is the path the roadmap explicitly calls out: it must be covered
    // by a test *while it's switched off in production*, because Fase 7
    // turns it on purely by writing rows like these — no code change, no
    // deploy. If this breaks silently while unused, nobody finds out until
    // launch day.
    it('resolves a finite configured limit instead of the Infinity default', async () => {
      prisma.entitlement.findUnique.mockResolvedValue({ plan: 'FREE', key: 'quizzes', limitValue: 3 });

      const limit = await service.getLimit('FREE', 'quizzes');

      expect(limit).toBe(3);
    });

    it('reads different plan+key combinations independently', async () => {
      prisma.entitlement.findUnique.mockImplementation(({ where }: any) => {
        const { plan, key } = where.plan_key;
        if (plan === 'FREE' && key === 'ai_daily_tokens') {
          return Promise.resolve({ plan, key, limitValue: 50_000 });
        }
        return Promise.resolve(null);
      });

      const freeTokens = await service.getLimit('FREE', 'ai_daily_tokens');
      const proTokens = await service.getLimit('PRO', 'ai_daily_tokens');

      expect(freeTokens).toBe(50_000);
      expect(proTokens).toBe(Infinity);
    });

    it('caches a read so a second call within the TTL does not hit the DB again', async () => {
      prisma.entitlement.findUnique.mockResolvedValue({ plan: 'FREE', key: 'quizzes', limitValue: 3 });

      await service.getLimit('FREE', 'quizzes');
      await service.getLimit('FREE', 'quizzes');

      expect(prisma.entitlement.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLimits', () => {
    it('returns every known key for the plan', async () => {
      prisma.entitlement.findUnique.mockResolvedValue(null);

      const limits = await service.getLimits('FREE');

      expect(limits).toEqual({
        flashcard_sets: Infinity,
        quizzes: Infinity,
        audio_sessions: Infinity,
        ai_daily_tokens: Infinity,
        // Not Infinity, and deliberately so: this key is the antifraud ceiling
        // on credited study minutes, not a monetization lever. See
        // DEFAULT_ENTITLEMENTS.
        daily_study_minutes_cap: DEFAULT_DAILY_STUDY_MINUTES_CAP,
        // The one key that *is* a monetization lever, and the only finite
        // limit FREE carries on purpose.
        rooms: FREE_ROOMS,
      });
    });
  });

  describe('setLimit', () => {
    it('upserts the row and evicts the cache so the new value is read next time', async () => {
      prisma.entitlement.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        plan: 'FREE',
        key: 'quizzes',
        limitValue: 5,
      });

      const before = await service.getLimit('FREE', 'quizzes');
      expect(before).toBe(Infinity);

      await service.setLimit('FREE', 'quizzes', 5);
      expect(prisma.entitlement.upsert).toHaveBeenCalledWith({
        where: { plan_key: { plan: 'FREE', key: 'quizzes' } },
        create: { plan: 'FREE', key: 'quizzes', limitValue: 5 },
        update: { limitValue: 5 },
      });

      const after = await service.getLimit('FREE', 'quizzes');
      expect(after).toBe(5);
      expect(prisma.entitlement.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('listAll', () => {
    it('merges configured rows with defaults for everything else', async () => {
      prisma.entitlement.findMany.mockResolvedValue([
        { plan: 'FREE', key: 'quizzes', limitValue: 3 },
      ]);

      const all = await service.listAll();

      const configuredRow = all.find((r) => r.plan === 'FREE' && r.key === 'quizzes');
      expect(configuredRow).toEqual({ plan: 'FREE', key: 'quizzes', limit: 3, configured: true });

      const defaultedRow = all.find((r) => r.plan === 'PRO' && r.key === 'audio_sessions');
      expect(defaultedRow).toEqual({ plan: 'PRO', key: 'audio_sessions', limit: Infinity, configured: false });

      // 2 planos * todas as chaves, uma sobrescrita — sem duplicatas.
      expect(all).toHaveLength(2 * ENTITLEMENT_KEYS.length);
    });
  });
});
