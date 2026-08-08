import { FeedService } from './feed.service';

/** O cenário padrão: ninguém bloqueou ninguém. */
const semBloqueios = () => ({ bloqueadosPor: jest.fn().mockResolvedValue(new Set<string>()) });

describe('FeedService.getLeagueFeed', () => {
  it('returns paginated posts with server-calculated study data', async () => {
    const prisma = {
      leagueMember: {
        findUnique: jest.fn().mockResolvedValue({ id: 'membership-1' }),
        findMany: jest.fn().mockResolvedValue([
          { userId: 'user-1', displayName: 'Rô' },
        ]),
      },
      feedPost: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'post-1',
            leagueId: 'room-1',
            userId: 'user-1',
            showProofPhoto: true,
            createdAt: new Date(),
            user: { username: 'profile-name', handle: 'ro', avatarUrl: null },
            session: {
              id: 'session-1',
              totalDurationMinutes: { toString: () => '47' },
              pointsEarned: 300,
              xpEarned: 310,
              isVerified: true,
              proofMode: true,
              subject: { id: 'subject-1', name: 'Biologia', color: '#00ff00' },
              proofChecks: [{ photoUrl: 'https://cdn.example/proof.jpg' }],
            },
            reactions: [],
            comments: [],
          },
        ]),
      },
    };

    const result = await new FeedService(prisma as any, {} as any, semBloqueios() as any).getLeagueFeed(
      'room-1',
      'user-1',
      1,
      20,
    );

    expect(result).toEqual(
      expect.objectContaining({ total: 1, page: 1, limit: 20 }),
    );
    expect(result.posts[0]).toEqual(
      expect.objectContaining({
        photoUrl: 'https://cdn.example/proof.jpg',
        session: expect.objectContaining({
          minutes: 47,
          xpEarned: 310,
          subject: { id: 'subject-1', name: 'Biologia', color: '#00ff00' },
        }),
      }),
    );
  });
});

describe('FeedService.getChallengeMemberPosts', () => {
  it('filters by author and challenge window and keeps the feed item shape', async () => {
    const startsAt = new Date('2026-08-01T00:00:00.000Z');
    const endsAt = new Date('2026-08-08T00:00:00.000Z');
    const prisma = {
      league: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'challenge-1',
          startDate: startsAt,
          endDate: endsAt,
        }),
      },
      leagueMember: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'requester-membership' })
          .mockResolvedValueOnce({ id: 'target-membership' }),
        findMany: jest.fn().mockResolvedValue([
          { userId: 'target-user', displayName: 'Bia' },
        ]),
      },
      feedPost: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'post-1',
            leagueId: 'challenge-1',
            userId: 'target-user',
            caption: 'foto do dia',
            photoUrl: 'https://cdn.example/photo.jpg',
            showProofPhoto: false,
            createdAt: new Date('2026-08-03T12:00:00.000Z'),
            user: { username: 'profile-name', handle: 'bia', avatarUrl: null },
            session: null,
            reactions: [],
            comments: [],
          },
        ]),
      },
    };

    const result = await new FeedService(prisma as any, {} as any, semBloqueios() as any)
      .getChallengeMemberPosts('challenge-1', 'requester', 'target-user', 1, 20);

    expect(prisma.feedPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          leagueId: 'challenge-1',
          userId: 'target-user',
          createdAt: { gte: startsAt, lt: endsAt },
        },
        skip: 0,
        take: 20,
      }),
    );
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'post-1',
          kind: 'standalone',
          photoUrl: 'https://cdn.example/photo.jpg',
          session: null,
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  });
});
