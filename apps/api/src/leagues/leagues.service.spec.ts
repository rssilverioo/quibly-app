import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LeaguesService } from './leagues.service';

function makePrismaMock() {
  return {
    league: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    leagueMember: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    chatMessage: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

/** Same shape Prisma throws on a `@unique` constraint violation. */
function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.2',
  });
}

function makeAchievementsMock() {
  return {
    checkSocialAchievement: jest.fn().mockResolvedValue(undefined),
  };
}

describe('LeaguesService.joinByInviteCode', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let achievements: ReturnType<typeof makeAchievementsMock>;
  let service: LeaguesService;

  beforeEach(() => {
    prisma = makePrismaMock();
    achievements = makeAchievementsMock();
    service = new LeaguesService(prisma as any, achievements as any);
  });

  it('throws NotFoundException for an invalid invite code', async () => {
    prisma.league.findUnique.mockResolvedValue(null);

    await expect(
      service.joinByInviteCode('user-1', 'BOGUSCODE', 'Rodrigo'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.leagueMember.create).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the league is already full', async () => {
    prisma.league.findUnique.mockResolvedValue({
      id: 'league-1',
      maxMembers: 2,
    });
    prisma.leagueMember.count.mockResolvedValue(2); // at capacity

    await expect(
      service.joinByInviteCode('user-1', 'CODE1234', 'Rodrigo'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.leagueMember.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the user already belongs to the league', async () => {
    prisma.league.findUnique.mockResolvedValue({
      id: 'league-1',
      maxMembers: 50,
    });
    prisma.leagueMember.count.mockResolvedValue(3);
    prisma.leagueMember.findUnique.mockResolvedValue({
      leagueId: 'league-1',
      userId: 'user-1',
    });

    await expect(
      service.joinByInviteCode('user-1', 'CODE1234', 'Rodrigo'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.leagueMember.create).not.toHaveBeenCalled();
  });

  it('creates the membership, posts a system chat message, and checks the social achievement on the happy path', async () => {
    prisma.league.findUnique.mockResolvedValue({
      id: 'league-1',
      maxMembers: 50,
    });
    prisma.leagueMember.count.mockResolvedValue(3);
    prisma.leagueMember.findUnique.mockResolvedValue(null); // not a member yet

    const result = await service.joinByInviteCode('user-1', 'CODE1234', 'Rodrigo');

    expect(prisma.leagueMember.create).toHaveBeenCalledWith({
      data: {
        leagueId: 'league-1',
        userId: 'user-1',
        role: 'member',
        displayName: 'Rodrigo',
      },
    });
    expect(prisma.chatMessage.create).toHaveBeenCalled();
    expect(achievements.checkSocialAchievement).toHaveBeenCalledWith(
      'user-1',
      'league_join',
    );
    expect(result).toEqual({ id: 'league-1', maxMembers: 50 });
  });
});

describe('LeaguesService.create — invite code generation', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let achievements: ReturnType<typeof makeAchievementsMock>;
  let service: LeaguesService;

  const dto = {
    name: 'ENEM squad',
    start_date: '2026-08-01',
    end_date: '2026-09-01',
    privacy: 'public' as const,
    mode: 'competitive' as const,
    display_name: 'Rodrigo',
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    achievements = makeAchievementsMock();
    service = new LeaguesService(prisma as any, achievements as any);
  });

  it('generates an 8-character invite code drawn from the expected alphabet', async () => {
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        league: { create: jest.fn((args: any) => ({ id: 'league-1', ...args.data })) },
        leagueMember: { create: jest.fn() },
      }),
    );

    const league = await service.create('user-1', dto);

    expect(league.inviteCode).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it('retries with a fresh code when the first one collides on the unique constraint', async () => {
    let call = 0;
    prisma.$transaction.mockImplementation(async (cb: any) => {
      call += 1;
      if (call === 1) throw uniqueConstraintError();
      return cb({
        league: { create: jest.fn((args: any) => ({ id: 'league-1', ...args.data })) },
        leagueMember: { create: jest.fn() },
      });
    });

    const league = await service.create('user-1', dto);

    expect(call).toBe(2);
    expect(league.id).toBe('league-1');
  });

  it('gives up after exhausting its retry budget instead of retrying forever', async () => {
    prisma.$transaction.mockRejectedValue(uniqueConstraintError());

    await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    // Bounded, not unbounded: fails fast rather than looping forever under
    // sustained collisions (which, at 62^8 codes, would only happen if the
    // keyspace were somehow exhausted or something else is badly wrong).
    expect(prisma.$transaction.mock.calls.length).toBeLessThanOrEqual(10);
    expect(prisma.$transaction.mock.calls.length).toBeGreaterThan(1);
  });

  it('never retries on an unrelated error — only on the invite code collision', async () => {
    const dbDown = new Error('connection refused');
    prisma.$transaction.mockRejectedValue(dbDown);

    await expect(service.create('user-1', dto)).rejects.toBe(dbDown);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('LeaguesService.findLiveMembers', () => {
  function makeLivePrismaMock() {
    return {
      leagueMember: { findMany: jest.fn() },
      studySession: { findMany: jest.fn() },
    };
  }

  /**
   * O consumidor é a faixa "estudando agora" da sala, que pede a lista
   * inteira e filtra por `league_id`. Se a pessoa vier etiquetada com uma
   * sala só, ela some das outras — estudando lá dentro o tempo todo.
   */
  it('mostra quem estuda em TODAS as salas que divide com quem chamou', async () => {
    const prisma = makeLivePrismaMock();
    prisma.leagueMember.findMany
      // 1ª chamada: as salas de quem chamou.
      .mockResolvedValueOnce([{ leagueId: 'sala-a' }, { leagueId: 'sala-b' }])
      // 2ª: Ana está nas duas, com nome de exibição próprio em cada uma.
      .mockResolvedValueOnce([
        {
          userId: 'ana',
          displayName: 'Ana da A',
          league: { id: 'sala-a', name: 'Sala A' },
        },
        {
          userId: 'ana',
          displayName: 'Ana da B',
          league: { id: 'sala-b', name: 'Sala B' },
        },
      ]);
    prisma.studySession.findMany.mockResolvedValue([
      {
        id: 'sessao-1',
        userId: 'ana',
        startedAt: new Date(Date.now() - 25 * 60_000),
        proofMode: false,
        subject: { name: 'Cálculo', color: '#123456' },
        user: { username: 'ana', handle: 'ana', avatarUrl: null },
      },
    ]);

    const live = await new LeaguesService(prisma as any, {} as any).findLiveMembers('eu');

    // Uma sessão, duas salas: duas linhas. Antes saía uma só, na sala que o
    // banco devolvesse primeiro.
    expect(live).toHaveLength(2);
    expect(live.map((m) => m.league_id).sort()).toEqual(['sala-a', 'sala-b']);
    // A tela filtra por sala, então cada sala vê a Ana exatamente uma vez.
    expect(live.filter((m) => m.league_id === 'sala-b')).toHaveLength(1);
    // E com o nome daquela sala, que é por participação e não por pessoa.
    expect(live.find((m) => m.league_id === 'sala-b')?.display_name).toBe('Ana da B');
    // A sessão é a mesma dos dois lados.
    expect(new Set(live.map((m) => m.session_id))).toEqual(new Set(['sessao-1']));
    expect(live[0].elapsed_minutes).toBe(25);
  });

  it('devolve vazio quem não tem sala, sem consultar sessões', async () => {
    const prisma = makeLivePrismaMock();
    prisma.leagueMember.findMany.mockResolvedValueOnce([]);

    const live = await new LeaguesService(prisma as any, {} as any).findLiveMembers('eu');

    expect(live).toEqual([]);
    expect(prisma.studySession.findMany).not.toHaveBeenCalled();
  });
});
