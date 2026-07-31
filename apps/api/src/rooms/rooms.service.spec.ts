import {
  PRESENCE_HEARTBEAT_GRACE_SECONDS,
  RoomsService,
} from './rooms.service';

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
      {} as any,
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
    const service = new RoomsService({} as any, leagues as any, {} as any, {} as any);

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

  it('creates a standalone photo post without a session', async () => {
    const prisma = {
      leagueMember: { findUnique: jest.fn().mockResolvedValue({ id: 'member-1' }) },
      feedPost: {
        create: jest.fn().mockImplementation(({ data }) => ({
          ...data,
          createdAt: new Date('2026-07-31T12:00:00Z'),
        })),
      },
    };
    const storage = {
      uploadPublic: jest.fn().mockResolvedValue('https://cdn.example/photo.jpg'),
    };
    const service = new RoomsService(
      prisma as any,
      {} as any,
      {} as any,
      storage as any,
    );

    const result = await service.createPost(
      'room-1',
      'user-1',
      '  foco hoje  ',
      { buffer: Buffer.from('image'), mimetype: 'image/jpeg' } as Express.Multer.File,
    );

    expect(prisma.feedPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leagueId: 'room-1',
        userId: 'user-1',
        sessionId: null,
        caption: 'foco hoje',
        photoUrl: 'https://cdn.example/photo.jpg',
      }),
    });
    expect(result).toEqual(expect.objectContaining({ kind: 'standalone' }));
  });
});

describe('RoomsService.getPresence', () => {
  it('returns only recent active sessions for members of a study room', async () => {
    jest.useFakeTimers();
    const now = new Date('2026-08-03T12:00:00.000Z');
    jest.setSystemTime(now);
    const prisma = {
      league: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'room-1',
          privacy: 'private',
          participationMode: 'study',
        }),
      },
      leagueMember: {
        findUnique: jest.fn().mockResolvedValue({ id: 'requester-membership' }),
        findMany: jest.fn().mockResolvedValue([
          { userId: 'user-1', displayName: 'Rô' },
          { userId: 'user-2', displayName: 'Bia' },
        ]),
      },
      studySession: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'session-2',
            userId: 'user-2',
            startedAt: new Date('2026-08-03T11:13:00.000Z'),
            lastHeartbeatAt: new Date('2026-08-03T11:59:30.000Z'),
            subject: { id: 'subject-1', name: 'Biologia', color: '#00ff00' },
            user: { username: 'profile-bia', avatarUrl: 'bia.jpg' },
          },
        ]),
      },
    };
    const service = new RoomsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getPresence('room-1', 'user-1');

    expect(prisma.studySession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active',
          lastHeartbeatAt: {
            gte: new Date(
              now.getTime() - PRESENCE_HEARTBEAT_GRACE_SECONDS * 1000,
            ),
          },
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        heartbeatGraceSeconds: 90,
        pollAfterSeconds: 30,
        members: [
          expect.objectContaining({
            userId: 'user-2',
            displayName: 'Bia',
            avatarUrl: 'bia.jpg',
            elapsedMinutes: 47,
          }),
        ],
      }),
    );
    jest.useRealTimers();
  });

  it('rejects presence for a photo room before querying sessions', async () => {
    const prisma = {
      league: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'room-1',
          privacy: 'private',
          participationMode: 'photo',
        }),
      },
      leagueMember: {
        findUnique: jest.fn().mockResolvedValue({ id: 'requester-membership' }),
      },
      studySession: { findMany: jest.fn() },
    };
    const service = new RoomsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.getPresence('room-1', 'user-1')).rejects.toMatchObject({
      status: 400,
    });
    expect(prisma.studySession.findMany).not.toHaveBeenCalled();
  });

  it('rejects an outsider before reading presence from a private room', async () => {
    const prisma = {
      league: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'room-1',
          privacy: 'private',
          participationMode: 'study',
        }),
      },
      leagueMember: { findUnique: jest.fn().mockResolvedValue(null) },
      studySession: { findMany: jest.fn() },
    };
    const service = new RoomsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.getPresence('room-1', 'outsider')).rejects.toMatchObject({
      status: 403,
    });
    expect(prisma.studySession.findMany).not.toHaveBeenCalled();
  });
});
