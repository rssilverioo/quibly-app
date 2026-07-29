import { NotFoundException } from '@nestjs/common';
import { CurriculumService } from './curriculum.service';
import { CURRICULUM_SEEDS } from './seeds';
import { seedCountry } from './seed-curriculum';

function makePrismaMock() {
  return {
    country: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    examTrack: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    discipline: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    topic: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    profile: { update: jest.fn() },
    subject: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
}

describe('CurriculumService — cache', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: CurriculumService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new CurriculumService(prisma as any);
  });

  it('reads the country list once and serves the rest from memory', async () => {
    await service.getCountries();
    await service.getCountries();

    // The curriculum changes once a year; paying a round trip per onboarding
    // screen would be pure waste.
    expect(prisma.country.findMany).toHaveBeenCalledTimes(1);
  });

  it('caches tracks per country, not globally', async () => {
    await service.getTracks('BR');
    await service.getTracks('US');
    await service.getTracks('BR');

    expect(prisma.examTrack.findMany).toHaveBeenCalledTimes(2);
  });

  it('normalises the country code so `br` and `BR` share a cache entry', async () => {
    await service.getTracks('br');
    await service.getTracks('BR');

    expect(prisma.examTrack.findMany).toHaveBeenCalledTimes(1);
  });

  it('clearCache forces the next read to hit the database', async () => {
    await service.getCountries();
    service.clearCache();
    await service.getCountries();

    expect(prisma.country.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('CurriculumService.setUserTrack', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: CurriculumService;

  const track = {
    id: 'track-1',
    countryCode: 'BR',
    disciplines: [
      { name: 'Matemática', color: '#4D9FFF', icon: null },
      { name: 'Redação', color: '#C8FF4D', icon: null },
    ],
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new CurriculumService(prisma as any);
    prisma.examTrack.findUnique.mockResolvedValue(track);
    prisma.subject.createMany.mockResolvedValue({ count: 2 });
  });

  it('populates the user subjects from the track disciplines', async () => {
    const result = await service.setUserTrack('user-1', 'track-1');

    expect(prisma.subject.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { userId: 'user-1', name: 'Matemática', color: '#4D9FFF', icon: null },
          { userId: 'user-1', name: 'Redação', color: '#C8FF4D', icon: null },
        ],
      }),
    );
    expect(result.subjects_created).toBe(2);
  });

  it('skips duplicates rather than deleting and recreating', async () => {
    await service.setUserTrack('user-1', 'track-1');

    // Switching tracks must not delete subjects that already have study
    // sessions hanging off them.
    expect(prisma.subject.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('writes the country alongside the track — they cannot disagree', async () => {
    await service.setUserTrack('user-1', 'track-1');

    expect(prisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ examTrackId: 'track-1', countryCode: 'BR' }),
      }),
    );
  });

  it('stores the timezone and exam date when the client sends them', async () => {
    await service.setUserTrack('user-1', 'track-1', {
      timezone: 'America/Sao_Paulo',
      examDate: '2026-11-08',
    });

    const data = prisma.profile.update.mock.calls[0][0].data;
    expect(data.timezone).toBe('America/Sao_Paulo');
    expect(data.examDate).toEqual(new Date('2026-11-08'));
  });

  it('omits timezone and exam date rather than nulling them when absent', async () => {
    await service.setUserTrack('user-1', 'track-1');

    const data = prisma.profile.update.mock.calls[0][0].data;
    expect('timezone' in data).toBe(false);
    expect('examDate' in data).toBe(false);
  });

  it('throws for an unknown track', async () => {
    prisma.examTrack.findUnique.mockResolvedValue(null);

    await expect(service.setUserTrack('user-1', 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('curriculum seeds', () => {
  it('every country has a documented weight source', () => {
    // The seeds carry provisional weights that still need pedagogical review.
    // An undocumented number is one nobody can audit later.
    for (const seed of CURRICULUM_SEEDS) {
      expect(seed.weightSource).toBeTruthy();
      expect(seed.weightSource.length).toBeGreaterThan(20);
    }
  });

  it('slugs are unique within their parent — the upsert keys depend on it', () => {
    for (const country of CURRICULUM_SEEDS) {
      const trackSlugs = country.tracks.map((t) => t.slug);
      expect(new Set(trackSlugs).size).toBe(trackSlugs.length);

      for (const track of country.tracks) {
        const disciplineSlugs = track.disciplines.map((d) => d.slug);
        expect(new Set(disciplineSlugs).size).toBe(disciplineSlugs.length);

        for (const discipline of track.disciplines) {
          const topicSlugs = discipline.topics.map((t) => t.slug);
          expect(new Set(topicSlugs).size).toBe(topicSlugs.length);
        }
      }
    }
  });

  it('weights and frequencies stay inside their documented ranges', () => {
    for (const country of CURRICULUM_SEEDS) {
      for (const track of country.tracks) {
        for (const discipline of track.disciplines) {
          for (const topic of discipline.topics) {
            expect(topic.weight).toBeGreaterThanOrEqual(0);
            expect(topic.weight).toBeLessThanOrEqual(100);
            expect(topic.frequency).toBeGreaterThanOrEqual(0);
            expect(topic.frequency).toBeLessThanOrEqual(10);
          }
        }
      }
    }
  });

  it('no discipline is empty — an empty one produces a Subject with nothing behind it', () => {
    for (const country of CURRICULUM_SEEDS) {
      for (const track of country.tracks) {
        expect(track.disciplines.length).toBeGreaterThan(0);
        for (const discipline of track.disciplines) {
          expect(discipline.topics.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('seedCountry — idempotency', () => {
  function makeSeedDb() {
    return {
      country: { upsert: jest.fn().mockResolvedValue({}) },
      examTrack: {
        upsert: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve({ id: `track-${where.countryCode_slug.slug}` }),
        ),
      },
      discipline: {
        upsert: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve({ id: `disc-${where.trackId_slug.slug}` }),
        ),
      },
      topic: { upsert: jest.fn().mockResolvedValue({}) },
    };
  }

  it('only ever upserts — never creates blindly, never deletes', async () => {
    const db = makeSeedDb();
    await seedCountry(db as any, CURRICULUM_SEEDS[0]);

    // A create-only seed would duplicate the whole curriculum on every deploy,
    // stranding existing users on orphaned track rows.
    expect(db.country.upsert).toHaveBeenCalled();
    expect(db.examTrack.upsert).toHaveBeenCalled();
    expect(db.topic.upsert).toHaveBeenCalled();
    expect((db as any).topic.deleteMany).toBeUndefined();
  });

  it('produces identical calls on a second run', async () => {
    const first = makeSeedDb();
    const second = makeSeedDb();

    await seedCountry(first as any, CURRICULUM_SEEDS[0]);
    await seedCountry(second as any, CURRICULUM_SEEDS[0]);

    expect(second.topic.upsert.mock.calls).toEqual(first.topic.upsert.mock.calls);
    expect(second.examTrack.upsert.mock.calls).toEqual(first.examTrack.upsert.mock.calls);
  });

  it('anchors every upsert on the natural unique key, not on a generated id', async () => {
    const db = makeSeedDb();
    await seedCountry(db as any, CURRICULUM_SEEDS[0]);

    for (const [args] of db.examTrack.upsert.mock.calls) {
      expect(args.where).toHaveProperty('countryCode_slug');
    }
    for (const [args] of db.topic.upsert.mock.calls) {
      expect(args.where).toHaveProperty('disciplineId_slug');
    }
  });

  it('stamps the country weight source onto every topic', async () => {
    const db = makeSeedDb();
    const seed = CURRICULUM_SEEDS[0];
    await seedCountry(db as any, seed);

    for (const [args] of db.topic.upsert.mock.calls) {
      expect(args.create.weightSource).toBe(seed.weightSource);
      expect(args.update.weightSource).toBe(seed.weightSource);
    }
  });

  it('seeds every country in the registry without special-casing any of them', async () => {
    // The architectural claim under test: a new market is a new seed file and
    // nothing else. If any country needed a branch in the runner, the modelling
    // would be wrong.
    for (const seed of CURRICULUM_SEEDS) {
      const db = makeSeedDb();
      const counts = await seedCountry(db as any, seed);
      expect(counts.tracks).toBe(seed.tracks.length);
      expect(counts.topics).toBeGreaterThan(0);
    }
  });
});
