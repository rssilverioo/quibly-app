import { RoomsService } from './rooms.service';

describe('RoomsService.listForUser', () => {
  it('embeds the active challenge and its remaining deadline', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
    const prisma = {
      leagueMember: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            role: 'member',
            displayName: 'Rô',
            totalSp: 120,
            league: {
              id: 'room-1',
              name: 'Cadeira do fundo',
              description: 'Semana da prova',
              startDate: new Date('2026-08-01T00:00:00.000Z'),
              endDate: new Date('2026-08-04T12:00:00.000Z'),
              members: [
                { userId: 'user-2', totalSp: 200 },
                { userId: 'user-1', totalSp: 120 },
              ],
              feedPosts: [{ createdAt: new Date('2026-08-03T11:00:00.000Z') }],
            },
          },
        ]),
      },
    };

    const challenges = {
      leaderboard: jest.fn().mockResolvedValue({ me: { rank: 2, metricValue: 47 } }),
    };
    const [room] = await new RoomsService(
      prisma as any,
      {} as any,
      challenges as any,
    ).listForUser('user-1');

    expect(room.activeChallenge).toEqual(
      expect.objectContaining({
        id: 'room-1',
        endsAt: new Date('2026-08-04T12:00:00.000Z'),
        remainingSeconds: 86_400,
        me: { rank: 2, metricValue: 47 },
      }),
    );
    expect(prisma.leagueMember.findMany).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('returns no active challenge outside the league window', async () => {
    const prisma = {
      leagueMember: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: 'owner',
            displayName: 'Rô',
            totalSp: 0,
            league: {
              id: 'room-1',
              name: 'Room',
              description: null,
              startDate: new Date('2020-01-01'),
              endDate: new Date('2020-01-02'),
              members: [],
              feedPosts: [],
            },
          },
        ]),
      },
    };

    const [room] = await new RoomsService(
      prisma as any,
      {} as any,
      {} as any,
    ).listForUser('user-1');

    expect(room.activeChallenge).toBeNull();
  });

  it('creates a private room from only name and display name', async () => {
    const leagues = {
      create: jest.fn().mockResolvedValue({
        id: 'room-1',
        name: 'Sala',
        inviteCode: 'ABC12345',
        maxMembers: 50,
        createdAt: new Date(),
      }),
    };
    const service = new RoomsService({} as any, leagues as any, {} as any);

    const room = await service.create('user-1', {
      name: 'Sala',
      display_name: 'Rô',
    });

    expect(leagues.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ privacy: 'private', display_name: 'Rô' }),
    );
    expect(room.activeChallenge).toBeNull();
  });
});
