import { FeedService } from './feed.service';

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

    const result = await new FeedService(prisma as any, {} as any).getLeagueFeed(
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
