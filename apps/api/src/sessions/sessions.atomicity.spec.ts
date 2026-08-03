import { SessionsService } from './sessions.service';

const NOW = new Date('2026-07-29T14:00:00.000Z');

class FeedPostWriteFailure extends Error {}

function makeTransactionalPrisma(failFeedPosts: boolean) {
  type Write = () => void;

  const store = {
    session: {
      id: 'session-1',
      userId: 'user-1',
      status: 'active',
      proofMode: false,
      timerMode: 'pomodoro',
      workDuration: 25,
      leagueId: null,
      startedAt: new Date(NOW.getTime() - 45 * 60_000),
      totalDurationMinutes: 0,
    },
    members: [
      { leagueId: 'league-a', userId: 'user-1', totalSp: 500 },
      { leagueId: 'league-b', userId: 'user-1', totalSp: 700 },
    ],
    posts: [] as Array<{ leagueId: string }>,
    profile: {
      id: 'user-1',
      currentStreak: 0,
      totalXp: 0,
      totalStudyMinutes: 0,
      level: 1,
      plan: 'FREE',
    },
  };

  function client(buffer?: Write[]) {
    const write = (operation: Write) =>
      buffer ? buffer.push(operation) : operation();

    return {
      studySession: {
        findUnique: jest.fn(async () => ({ ...store.session })),
        update: jest.fn(async ({ data }: any) => {
          write(() => Object.assign(store.session, data));
          return { ...store.session, ...data };
        }),
        findFirst: jest.fn(async () => null),
        findMany: jest.fn(async () => []),
        aggregate: jest.fn(async () => ({ _sum: { totalDurationMinutes: 0 } })),
      },
      sessionPause: {
        findMany: jest.fn(async () => []),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      proofCheck: { findMany: jest.fn(async () => []) },
      profile: {
        findUnique: jest.fn(async () => ({ ...store.profile })),
        update: jest.fn(async ({ data }: any) => {
          write(() => Object.assign(store.profile, data));
          return { ...store.profile, ...data };
        }),
      },
      league: { findUnique: jest.fn(async () => null) },
      leagueMember: {
        findMany: jest.fn(async () =>
          store.members.map(({ leagueId }) => ({
            leagueId,
            league: { name: leagueId },
          })),
        ),
        updateMany: jest.fn(async ({ data }: any) => {
          write(() => {
            for (const member of store.members) {
              member.totalSp += Number(data.totalSp.increment);
            }
          });
          return { count: store.members.length };
        }),
      },
      feedPost: {
        createManyAndReturn: jest.fn(async ({ data }: any) => {
          if (failFeedPosts) throw new FeedPostWriteFailure();
          write(() => store.posts.push(...data));
          return data.map((post: any, index: number) => ({
            id: `post-${index + 1}`,
            leagueId: post.leagueId,
          }));
        }),
      },
      sessionAnomaly: { create: jest.fn() },
      achievement: { findMany: jest.fn(async () => []) },
    };
  }

  const root: any = client();
  root.$transaction = jest.fn(async (callback: any) => {
    const buffer: Write[] = [];
    const result = await callback(client(buffer));
    buffer.forEach((operation) => operation());
    return result;
  });

  return { root, store };
}

function makeService(prisma: any) {
  return new SessionsService(
    prisma,
    { checkAfterSession: jest.fn().mockResolvedValue([]) } as any,
    { notifyAchievements: jest.fn().mockResolvedValue(undefined) } as any,
    { track: jest.fn() } as any,
    { getLimit: jest.fn().mockResolvedValue(600) } as any,
  );
}

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterAll(() => jest.useRealTimers());

describe('SessionsService.endSession atomicity', () => {
  it('commits the session, SP and complete post fan-out together', async () => {
    const { root, store } = makeTransactionalPrisma(false);

    await makeService(root).endSession('user-1', 'session-1');

    expect(store.session.status).toBe('completed');
    expect(store.members.map(({ totalSp }) => totalSp)).toEqual([555, 755]);
    expect(store.posts.map(({ leagueId }) => leagueId)).toEqual([
      'league-a',
      'league-b',
    ]);
  });

  it('rolls everything back when feed publication fails, allowing retry', async () => {
    const { root, store } = makeTransactionalPrisma(true);

    await expect(
      makeService(root).endSession('user-1', 'session-1'),
    ).rejects.toBeInstanceOf(FeedPostWriteFailure);

    expect(store.session.status).toBe('active');
    expect(store.members.map(({ totalSp }) => totalSp)).toEqual([500, 700]);
    expect(store.posts).toEqual([]);
  });
});
