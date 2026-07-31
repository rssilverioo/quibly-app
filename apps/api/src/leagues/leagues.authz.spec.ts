import { ForbiddenException } from '@nestjs/common';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';

const PRIVATE_LEAGUE = {
  id: 'private-league',
  name: 'Private',
  description: null,
  ownerId: 'owner',
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-07-31'),
  privacy: 'private',
  mode: 'competitive',
  status: 'completed',
  inviteCode: 'SECRET42',
  maxMembers: 50,
  createdAt: new Date('2026-07-01'),
};

const PUBLIC_LEAGUE = {
  ...PRIVATE_LEAGUE,
  id: 'public-league',
  name: 'Public',
  privacy: 'public',
  inviteCode: 'PUBLIC42',
};

function makePrisma() {
  const memberships = [
    {
      id: 'member-1',
      leagueId: PRIVATE_LEAGUE.id,
      userId: 'member',
      displayName: 'Member',
      totalSp: 100,
      weeklySp: 50,
      monthlySp: 75,
      verifiedHours: 1,
      user: {
        id: 'member',
        username: 'member',
        handle: 'member',
        avatarUrl: null,
        level: 1,
      },
    },
  ];

  return {
    league: {
      findUnique: jest.fn(async ({ where }: any) =>
        [PRIVATE_LEAGUE, PUBLIC_LEAGUE].find((league) => league.id === where.id) ?? null,
      ),
    },
    leagueMember: {
      findUnique: jest.fn(async ({ where }: any) =>
        memberships.find(
          (membership) =>
            membership.leagueId === where.leagueId_userId.leagueId &&
            membership.userId === where.leagueId_userId.userId,
        ) ?? null,
      ),
      findMany: jest.fn(async ({ where }: any) =>
        memberships.filter((membership) => membership.leagueId === where.leagueId),
      ),
      count: jest.fn(async ({ where }: any) =>
        memberships.filter((membership) => membership.leagueId === where.leagueId).length,
      ),
      updateMany: jest.fn(),
    },
  };
}

describe('LeaguesController caller identity', () => {
  it('passes the authenticated user to every protected read', async () => {
    const service = {
      getLeaderboard: jest.fn(),
      getMembers: jest.fn(),
      getEndResults: jest.fn(),
    };
    const controller = new LeaguesController(service as any);
    const user = { userId: 'firebase-user', email: 'user@example.com' };

    await controller.getLeaderboard(user, 'league-1', 'weekly');
    await controller.getMembers(user, 'league-1');
    await controller.getEndResults(user, 'league-1');

    expect(service.getLeaderboard).toHaveBeenCalledWith(
      'league-1',
      'firebase-user',
      'weekly',
    );
    expect(service.getMembers).toHaveBeenCalledWith('league-1', 'firebase-user');
    expect(service.getEndResults).toHaveBeenCalledWith('league-1', 'firebase-user');
  });
});

describe('LeaguesService read authorization', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: LeaguesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new LeaguesService(prisma as any, {} as any);
  });

  const reads = [
    ['leaderboard', (target: LeaguesService, leagueId: string, userId: string) =>
      target.getLeaderboard(leagueId, userId, 'all_time')],
    ['members', (target: LeaguesService, leagueId: string, userId: string) =>
      target.getMembers(leagueId, userId)],
    ['results', (target: LeaguesService, leagueId: string, userId: string) =>
      target.getEndResults(leagueId, userId)],
  ] as const;

  it.each(reads)('%s rejects a non-member of a private league', async (_name, read) => {
    await expect(read(service, PRIVATE_LEAGUE.id, 'outsider')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each(reads)('%s permits a member of a private league', async (_name, read) => {
    await expect(read(service, PRIVATE_LEAGUE.id, 'member')).resolves.toBeDefined();
  });

  it.each(reads)('%s keeps public leagues readable to non-members', async (_name, read) => {
    await expect(read(service, PUBLIC_LEAGUE.id, 'outsider')).resolves.toBeDefined();
  });

  it('does not expose inviteCode in results', async () => {
    const result = await service.getEndResults(PRIVATE_LEAGUE.id, 'member');

    expect(result.league).not.toHaveProperty('inviteCode');
    expect(JSON.stringify(result)).not.toContain(PRIVATE_LEAGUE.inviteCode);
  });
});

describe('LeaguesService periodic resets', () => {
  it.each([
    ['weekly', (service: LeaguesService) =>
      service.resetWeeklySp({ leagueId: PRIVATE_LEAGUE.id })],
    ['monthly', (service: LeaguesService) =>
      service.resetMonthlySp({ leagueId: PRIVATE_LEAGUE.id })],
  ] as const)('%s reset is explicitly scoped to one league', async (_name, reset) => {
    const prisma = makePrisma();
    const service = new LeaguesService(prisma as any, {} as any);

    await reset(service);

    expect(prisma.leagueMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leagueId: PRIVATE_LEAGUE.id } }),
    );
  });
});
