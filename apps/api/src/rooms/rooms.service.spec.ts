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

    const [room] = await new RoomsService(prisma as any).listForUser('user-1');

    expect(room.activeChallenge).toEqual(
      expect.objectContaining({
        id: 'room-1',
        endsAt: new Date('2026-08-04T12:00:00.000Z'),
        remainingSeconds: 86_400,
        me: { rank: 2, metricValue: 120 },
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

    const [room] = await new RoomsService(prisma as any).listForUser('user-1');

    expect(room.activeChallenge).toBeNull();
  });
});
