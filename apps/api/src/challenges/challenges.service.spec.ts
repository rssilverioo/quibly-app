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

describe('ChallengesService.create', () => {
  it('creates a minutes challenge on an existing room', async () => {
    const prisma = {
      leagueMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'owner' }),
        count: jest.fn().mockResolvedValue(6),
      },
      league: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'room-1',
          startDate: new Date('1970-01-01'),
          endDate: new Date('1970-01-02'),
        }),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'room-1', ...data })),
      },
    };
    const service = new ChallengesService(prisma as any);

    const challenge = await service.create('room-1', 'owner', {
      title: 'Semana da prova',
      metric: 'minutes',
      ends_on: '2099-08-08',
    });

    expect(prisma.league.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'room-1' },
        data: expect.objectContaining({ description: 'Semana da prova' }),
      }),
    );
    expect(challenge).toEqual(
      expect.objectContaining({ id: 'room-1', roomId: 'room-1', participantCount: 6 }),
    );
  });
});
