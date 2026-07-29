import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { calculateScore } from '@quibly/shared';

function makePrismaMock() {
  const tx = {
    studySession: {
      findUnique: jest.fn(),
      update: jest.fn((args: any) => ({ id: 'session-1', ...args.data })),
    },
    proofCheck: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    profile: {
      findUnique: jest.fn().mockResolvedValue({
        currentStreak: 0,
        totalXp: 0,
        totalStudyMinutes: 0,
        level: 1,
      }),
      update: jest.fn(),
    },
    league: {
      findUnique: jest.fn(),
    },
  };

  return {
    tx,
    studySession: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    leagueMember: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    feedPost: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };
}

function makeAchievementsMock() {
  return {
    checkAfterSession: jest.fn().mockResolvedValue([]),
  };
}

function makeNotificationsMock() {
  return {
    notifyAchievements: jest.fn().mockResolvedValue(undefined),
  };
}

// Added alongside packages/shared/src/analytics-events.ts (F0 analytics
// taxonomy) — SessionsService now emits session_completed/session_abandoned/
// streak_extended/streak_broken via AnalyticsService. A no-op mock keeps
// these specs focused on scoring/session behavior.
function makeAnalyticsMock() {
  return {
    track: jest.fn(),
  };
}

describe('SessionsService.endSession', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let achievements: ReturnType<typeof makeAchievementsMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let service: SessionsService;

  const baseSession = {
    id: 'session-1',
    userId: 'user-1',
    status: 'active',
    proofMode: false,
    workDuration: 25,
    leagueId: null,
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    achievements = makeAchievementsMock();
    notifications = makeNotificationsMock();
    service = new SessionsService(
      prisma as any,
      achievements as any,
      notifications as any,
      makeAnalyticsMock() as any,
    );
  });

  it('throws NotFoundException when the session does not exist', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue(null);

    await expect(
      service.endSession('user-1', {
        session_id: 'missing',
        pomodoro_cycles_completed: 1,
        total_duration_minutes: 30,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when the session belongs to another user', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      userId: 'someone-else',
    });

    await expect(
      service.endSession('user-1', {
        session_id: 'session-1',
        pomodoro_cycles_completed: 1,
        total_duration_minutes: 30,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws BadRequestException when the session is not active', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      status: 'completed',
    });

    await expect(
      service.endSession('user-1', {
        session_id: 'session-1',
        pomodoro_cycles_completed: 1,
        total_duration_minutes: 30,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes duration and score exactly like the shared calculateScore function, and persists it', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession });
    prisma.tx.profile.findUnique.mockResolvedValue({
      currentStreak: 3,
      totalXp: 100,
      totalStudyMinutes: 50,
      level: 1,
    });

    const dto = {
      session_id: 'session-1',
      pomodoro_cycles_completed: 2,
      total_duration_minutes: 45,
    };

    const result = await service.endSession('user-1', dto);

    const expectedScore = calculateScore({
      durationMinutes: 45,
      proofModeEnabled: false,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 2,
      currentStreakDays: 3,
      leagueMode: undefined,
      // expectedDuration = workDuration(25) * cycles(2) = 50 > 45 -> ended early,
      // but early-exit penalty only bites in hardcore mode (leagueId is null here).
      endedEarly: true,
    });

    expect(result.score).toEqual(expectedScore);

    // The session update inside the transaction must persist the same totals.
    expect(prisma.tx.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          status: 'completed',
          totalDurationMinutes: 45,
          pointsEarned: expectedScore.totalSP,
          xpEarned: expectedScore.xpEarned,
          pomodoroCyclesCompleted: 2,
        }),
      }),
    );
  });

  it('marks the session as verified only when proof mode was on and every check passed', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      proofMode: true,
    });
    prisma.tx.proofCheck.findMany.mockResolvedValue([
      { status: 'passed' },
      { status: 'passed' },
    ]);

    const result = await service.endSession('user-1', {
      session_id: 'session-1',
      pomodoro_cycles_completed: 1,
      total_duration_minutes: 30,
    });

    expect(result.session.isVerified).toBe(true);
  });

  it('does not mark the session verified if any proof check failed', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      proofMode: true,
    });
    prisma.tx.proofCheck.findMany.mockResolvedValue([
      { status: 'passed' },
      { status: 'failed' },
    ]);

    const result = await service.endSession('user-1', {
      session_id: 'session-1',
      pomodoro_cycles_completed: 1,
      total_duration_minutes: 30,
    });

    expect(result.session.isVerified).toBe(false);
  });

  it('applies the hardcore early-exit penalty only when the session is attached to a hardcore league', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      leagueId: 'league-1',
      workDuration: 25,
    });
    prisma.tx.league.findUnique.mockResolvedValue({ mode: 'hardcore' });

    const dto = {
      session_id: 'session-1',
      pomodoro_cycles_completed: 2, // expects 50 min, only did 10 -> ended early
      total_duration_minutes: 10,
    };

    const result = await service.endSession('user-1', dto);

    expect(result.score.earlyExitPenalty).toBeGreaterThan(0);
  });

  it('propagates score and XP into every league the user belongs to', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession });
    prisma.leagueMember.findMany.mockResolvedValue([
      { id: 'member-1', leagueId: 'league-a' },
      { id: 'member-2', leagueId: 'league-b' },
    ]);

    await service.endSession('user-1', {
      session_id: 'session-1',
      pomodoro_cycles_completed: 1,
      total_duration_minutes: 30,
    });

    // A feed post and an SP update happen for every league the user is in.
    expect(prisma.feedPost.create).toHaveBeenCalledTimes(2);
  });
});

describe('SessionsService.abandonSession', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SessionsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new SessionsService(
      prisma as any,
      makeAchievementsMock() as any,
      makeNotificationsMock() as any,
      makeAnalyticsMock() as any,
    );
  });

  it('throws NotFoundException for a missing session', async () => {
    prisma.studySession.findUnique.mockResolvedValue(null);

    await expect(
      service.abandonSession('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when the session belongs to someone else', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'someone-else',
      status: 'active',
    });

    await expect(
      service.abandonSession('user-1', 's1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws BadRequestException when the session is already finished', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'user-1',
      status: 'completed',
    });

    await expect(
      service.abandonSession('user-1', 's1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks an active, owned session as abandoned', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'user-1',
      status: 'active',
    });

    await service.abandonSession('user-1', 's1');

    expect(prisma.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ status: 'abandoned' }),
      }),
    );
  });
});
