import { ChallengesService } from './challenges.service';

describe('ChallengesService.leaderboard', () => {
  it('ranqueia por DIAS de presença, e os minutos viram o desempate', async () => {
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
            { userId: 'me', displayName: 'Eu', user: { handle: 'eu', avatarUrl: null, timezone: 'UTC' } },
            { userId: 'friend', displayName: 'Bia', user: { handle: 'bia', avatarUrl: null, timezone: 'UTC' } },
          ],
        }),
      },
      // Eu apareci em dois dias; a Bia num só, e com mais minutos. Antes ela
      // liderava por causa dos 50 minutos; agora o que conta é ter aparecido.
      feedPost: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'me', createdAt: new Date('2026-08-02T10:00:00.000Z') },
          { userId: 'me', createdAt: new Date('2026-08-04T10:00:00.000Z') },
          { userId: 'friend', createdAt: new Date('2026-08-03T10:00:00.000Z') },
        ]),
      },
      studySession: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'me', totalDurationMinutes: 30, isVerified: true, endedAt: new Date('2026-08-02') },
          { userId: 'friend', totalDurationMinutes: 50, isVerified: false, endedAt: new Date('2026-08-03') },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        { user_id: 'friend', latest_photo_url: 'https://cdn.example/friend.jpg' },
      ]),
    };

    const result = await new ChallengesService(prisma as any).leaderboard(
      'challenge-1',
      'me',
      1,
      20,
    );

    expect(result.entries.map((entry) => [entry.rank, entry.userId, entry.metricValue])).toEqual([
      [1, 'me', 2],
      [2, 'friend', 1],
    ]);
    expect(result.me).toEqual({ rank: 1, metricValue: 2 });
    // Os minutos não somem: deixam de ser a métrica e viram informação.
    expect(result.entries[0]).toEqual(expect.objectContaining({ minutes: 30, activeDays: 2 }));
    expect(result.challenge.metric).toBe('days');
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'friend',
          latestPhotoUrl: 'https://cdn.example/friend.jpg',
        }),
        expect.objectContaining({ userId: 'me', latestPhotoUrl: null }),
      ]),
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
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

describe('ChallengesService.details', () => {
  it('does not read the challenge or invite code for a non-member', async () => {
    const prisma = {
      leagueMember: { findUnique: jest.fn().mockResolvedValue(null) },
      league: { findUnique: jest.fn() },
    };

    await expect(
      new ChallengesService(prisma as any).details('challenge-1', 'outsider'),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.league.findUnique).not.toHaveBeenCalled();
  });

  it('returns progress, guarded invite, top four and timezone-aware group stats', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-04T00:00:00.000Z'));
    const challenge = {
      id: 'challenge-1',
      name: 'Sala',
      description: 'Semana da prova',
      participationMode: 'photo',
      inviteCode: 'MEMBERS1',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-08-07T00:00:00.000Z'),
      members: [
        {
          userId: 'a-user',
          displayName: 'Ana',
          user: {
            id: 'a-user',
            handle: 'ana',
            avatarUrl: 'ana.jpg',
            timezone: 'America/Sao_Paulo',
          },
        },
        {
          userId: 'b-user',
          displayName: 'Bia',
          user: {
            id: 'b-user',
            handle: 'bia',
            avatarUrl: 'bia.jpg',
            timezone: 'UTC',
          },
        },
      ],
    };
    const prisma = {
      leagueMember: { findUnique: jest.fn().mockResolvedValue({ id: 'member' }) },
      league: { findUnique: jest.fn().mockResolvedValue(challenge) },
      feedPost: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'a-user', createdAt: new Date('2026-08-02T09:00:00.000Z') },
          { userId: 'a-user', createdAt: new Date('2026-08-03T05:00:00.000Z') },
          { userId: 'b-user', createdAt: new Date('2026-08-02T06:00:00.000Z') },
        ]),
      },
      studySession: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'a-user', totalDurationMinutes: 30, isVerified: true, endedAt: new Date('2026-08-02') },
          { userId: 'b-user', totalDurationMinutes: 50, isVerified: false, endedAt: new Date('2026-08-02') },
        ]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const result = await new ChallengesService(prisma as any).details(
      'challenge-1',
      'a-user',
    );

    expect(result.room).toEqual({
      id: 'challenge-1',
      name: 'Sala',
      inviteCode: 'MEMBERS1',
    });
    expect(result.challenge.elapsedFraction).toBe(0.5);
    expect(result.rankings).toEqual([
      // Antes a Bia liderava com 50 minutos contra 30. Agora lidera quem
      // apareceu em mais dias, que é o que a sala mede.
      expect.objectContaining({ rank: 1, userId: 'a-user', activeDays: 2 }),
      expect.objectContaining({ rank: 2, userId: 'b-user', activeDays: 1 }),
    ]);
    expect(result.groupStats).toEqual(
      expect.objectContaining({
        totalCheckIns: 3,
        totalDaysActive: 2,
        averageCheckInsPerDay: 1.5,
        earlyBird: expect.objectContaining({ userId: 'a-user', checkIns: 1 }),
        nightOwl: expect.objectContaining({ userId: 'a-user', checkIns: 1 }),
      }),
    );
    jest.useRealTimers();
  });

  /**
   * Três fotos numa terça são UM check-in, não três.
   *
   * O caso do teste acima não pegava isto: os três posts dele caem em três
   * pares pessoa-dia distintos, então contar posts e contar dias davam o
   * mesmo 3. Aqui os posts se empilham de propósito.
   */
  it('conta um check-in por pessoa por dia, não uma foto por foto', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-04T00:00:00.000Z'));
    const challenge = {
      id: 'challenge-1',
      name: 'Sala',
      description: 'Semana da prova',
      participationMode: 'photo',
      inviteCode: 'MEMBERS1',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-08-07T00:00:00.000Z'),
      members: [
        {
          userId: 'a-user',
          displayName: 'Ana',
          user: { id: 'a-user', handle: 'ana', avatarUrl: 'ana.jpg', timezone: 'UTC' },
        },
        {
          userId: 'b-user',
          displayName: 'Bia',
          user: { id: 'b-user', handle: 'bia', avatarUrl: 'bia.jpg', timezone: 'UTC' },
        },
      ],
    };
    const prisma = {
      leagueMember: { findUnique: jest.fn().mockResolvedValue({ id: 'member' }) },
      league: { findUnique: jest.fn().mockResolvedValue(challenge) },
      feedPost: {
        findMany: jest.fn().mockResolvedValue([
          // Ana posta três vezes no dia 02, todas de manhã cedo.
          { userId: 'a-user', createdAt: new Date('2026-08-02T06:00:00.000Z') },
          { userId: 'a-user', createdAt: new Date('2026-08-02T07:00:00.000Z') },
          { userId: 'a-user', createdAt: new Date('2026-08-02T08:00:00.000Z') },
          // E uma no dia 03, fora da faixa da manhã.
          { userId: 'a-user', createdAt: new Date('2026-08-03T15:00:00.000Z') },
          // Bia aparece uma vez, também de manhã.
          { userId: 'b-user', createdAt: new Date('2026-08-02T06:30:00.000Z') },
        ]),
      },
      studySession: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const result = await new ChallengesService(prisma as any).details(
      'challenge-1',
      'a-user',
    );

    // 5 posts, mas Ana apareceu em 2 dias e Bia em 1: são 3 check-ins.
    expect(result.groupStats.totalCheckIns).toBe(3);
    expect(result.groupStats.totalDaysActive).toBe(2);
    // 3 check-ins / 2 dias ativos. Com posts dava 2,5.
    expect(result.groupStats.averageCheckInsPerDay).toBe(1.5);
    // Ana ganha o madrugador com 1 manhã, não com 3 fotos — e empatada com
    // Bia em 1, o desempate por userId a mantém na frente.
    expect(result.groupStats.earlyBird).toEqual(
      expect.objectContaining({ userId: 'a-user', checkIns: 1 }),
    );
    expect(result.rankings).toEqual([
      expect.objectContaining({ userId: 'a-user', activeDays: 2 }),
      expect.objectContaining({ userId: 'b-user', activeDays: 1 }),
    ]);
    jest.useRealTimers();
  });
});

/**
 * No modo estudo o dia não sai de foto nenhuma: sai do timer, com o mesmo piso
 * de 25 minutos que a sequência usa. Três réguas diferentes para "dia estudado"
 * era o que fazia o perfil dizer "4 dias" e "sequência 1" ao mesmo tempo.
 */
describe('ChallengesService.leaderboard — modo estudo', () => {
  const membro = (userId: string, timezone = 'UTC') => ({
    userId,
    displayName: userId,
    user: { handle: userId, avatarUrl: null, timezone },
  });

  const prismaDoModoEstudo = (sessions: any[]) => ({
    leagueMember: { findUnique: jest.fn().mockResolvedValue({ id: 'member' }) },
    league: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'c1',
        name: 'Room',
        description: 'Sprint',
        participationMode: 'study',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-08'),
        members: [membro('me'), membro('friend')],
      }),
    },
    feedPost: { findMany: jest.fn() },
    studySession: { findMany: jest.fn().mockResolvedValue(sessions) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  });

  it('conta o dia por 25 minutos de timer, e ignora o feed', async () => {
    const prisma = prismaDoModoEstudo([
      // Eu: dois dias válidos.
      { userId: 'me', totalDurationMinutes: 30, isVerified: false, endedAt: new Date('2026-08-02T10:00:00Z') },
      { userId: 'me', totalDurationMinutes: 40, isVerified: false, endedAt: new Date('2026-08-03T10:00:00Z') },
      // Bia: um dia longo só.
      { userId: 'friend', totalDurationMinutes: 300, isVerified: false, endedAt: new Date('2026-08-02T10:00:00Z') },
    ]);

    const result = await new ChallengesService(prisma as any).leaderboard('c1', 'me', 1, 20);

    expect(result.entries.map((e) => [e.rank, e.userId, e.metricValue])).toEqual([
      [1, 'me', 2],
      [2, 'friend', 1],
    ]);
    // Modo estudo não pergunta ao feed.
    expect(prisma.feedPost.findMany).not.toHaveBeenCalled();
  });

  it('o piso é do DIA, não da sessão', async () => {
    const prisma = prismaDoModoEstudo([
      // Três blocos de 10 no mesmo dia fazem o dia; 10 sozinhos não fazem.
      { userId: 'me', totalDurationMinutes: 10, isVerified: false, endedAt: new Date('2026-08-02T08:00:00Z') },
      { userId: 'me', totalDurationMinutes: 10, isVerified: false, endedAt: new Date('2026-08-02T12:00:00Z') },
      { userId: 'me', totalDurationMinutes: 10, isVerified: false, endedAt: new Date('2026-08-02T20:00:00Z') },
      { userId: 'friend', totalDurationMinutes: 10, isVerified: false, endedAt: new Date('2026-08-02T08:00:00Z') },
    ]);

    const result = await new ChallengesService(prisma as any).leaderboard('c1', 'me', 1, 20);

    expect(result.entries.map((e) => [e.userId, e.metricValue])).toEqual([
      ['me', 1],
      ['friend', 0],
    ]);
  });

  it('o dia é o do fuso de quem estudou', async () => {
    const prisma = prismaDoModoEstudo([
      // 02:00 UTC do dia 3 é ainda dia 2 em São Paulo. Contado em UTC daria
      // dois dias; contado no fuso da pessoa, é um só.
      { userId: 'me', totalDurationMinutes: 30, isVerified: false, endedAt: new Date('2026-08-02T20:00:00Z') },
      { userId: 'me', totalDurationMinutes: 30, isVerified: false, endedAt: new Date('2026-08-03T02:00:00Z') },
    ]);
    prisma.league.findUnique = jest.fn().mockResolvedValue({
      id: 'c1', name: 'Room', description: 'Sprint', participationMode: 'study',
      startDate: new Date('2026-08-01'), endDate: new Date('2026-08-08'),
      members: [membro('me', 'America/Sao_Paulo')],
    });

    const result = await new ChallengesService(prisma as any).leaderboard('c1', 'me', 1, 20);

    expect(result.entries[0].metricValue).toBe(1);
  });
});
