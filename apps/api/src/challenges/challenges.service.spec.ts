import { ChallengesService } from './challenges.service';

describe('ChallengesService.leaderboard', () => {
  it('ranks server-calculated minutes and includes the caller position', async () => {
    const prisma = {
      leagueMember: { findUnique: jest.fn().mockResolvedValue({ id: 'member' }) },
      league: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'challenge-1',
          name: 'Room',
          description: 'Sprint',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-08'),
          members: [
            { userId: 'me', displayName: 'Eu', user: { handle: 'eu', avatarUrl: null } },
            { userId: 'friend', displayName: 'Bia', user: { handle: 'bia', avatarUrl: null } },
          ],
        }),
      },
      studySession: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'me', totalDurationMinutes: 30, isVerified: true, endedAt: new Date('2026-08-02') },
          { userId: 'friend', totalDurationMinutes: 50, isVerified: false, endedAt: new Date('2026-08-03') },
        ]),
      },
    };

    const result = await new ChallengesService(prisma as any).leaderboard(
      'challenge-1',
      'me',
      1,
      20,
    );

    expect(result.entries.map((entry) => [entry.rank, entry.userId, entry.metricValue])).toEqual([
      [1, 'friend', 50],
      [2, 'me', 30],
    ]);
    expect(result.me).toEqual({ rank: 2, metricValue: 30 });
  });
});
