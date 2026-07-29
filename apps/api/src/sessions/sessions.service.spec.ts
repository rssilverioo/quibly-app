import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { calculateScore } from '@quibly/shared';
import { DEFAULT_DAILY_STUDY_MINUTES_CAP, HEARTBEAT_GRACE_SECONDS } from './session-timing';

/**
 * Every test here fixes the clock. Session duration is now wall-clock
 * arithmetic on the server, so a test that let `new Date()` float would be
 * asserting on however long the test itself took to run.
 */
const NOW = new Date('2026-07-29T14:00:00.000Z');

function makePrismaMock() {
  const tx = {
    studySession: {
      findUnique: jest.fn(),
      update: jest.fn((args: any) => ({ id: 'session-1', ...args.data })),
    },
    sessionPause: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
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
        plan: 'FREE',
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
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      findUnique: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalDurationMinutes: 0 } }),
    },
    sessionPause: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    sessionAnomaly: {
      create: jest.fn(),
    },
    profile: {
      findUnique: jest.fn().mockResolvedValue({ plan: 'FREE' }),
      update: jest.fn(),
    },
    leagueMember: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    feedPost: {
      create: jest.fn(),
    },
    // The service uses $transaction both ways: with a callback (endSession)
    // and with an array of operations (pause/resume/abandon).
    $transaction: jest.fn(async (arg: any) =>
      typeof arg === 'function' ? arg(tx) : Promise.all(arg),
    ),
  };
}

const makeAchievementsMock = () => ({ checkAfterSession: jest.fn().mockResolvedValue([]) });
const makeNotificationsMock = () => ({ notifyAchievements: jest.fn().mockResolvedValue(undefined) });
const makeAnalyticsMock = () => ({ track: jest.fn() });
const makeEntitlementsMock = () => ({
  getLimit: jest.fn().mockResolvedValue(DEFAULT_DAILY_STUDY_MINUTES_CAP),
});

function makeService(prisma: ReturnType<typeof makePrismaMock>, overrides: any = {}) {
  return new SessionsService(
    prisma as any,
    (overrides.achievements ?? makeAchievementsMock()) as any,
    (overrides.notifications ?? makeNotificationsMock()) as any,
    (overrides.analytics ?? makeAnalyticsMock()) as any,
    (overrides.entitlements ?? makeEntitlementsMock()) as any,
  );
}

/** A session that started 45 minutes before the frozen clock. */
const baseSession = {
  id: 'session-1',
  userId: 'user-1',
  status: 'active',
  proofMode: false,
  timerMode: 'pomodoro',
  workDuration: 25,
  leagueId: null,
  startedAt: new Date(NOW.getTime() - 45 * 60_000),
};

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

describe('SessionsService.endSession', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SessionsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = makeService(prisma);
  });

  it('throws NotFoundException when the session does not exist', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue(null);

    await expect(service.endSession('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when the session belongs to another user', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      userId: 'someone-else',
    });

    await expect(service.endSession('user-1', 'session-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws BadRequestException when the session is already finished', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      status: 'completed',
    });

    await expect(service.endSession('user-1', 'session-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('measures the duration from startedAt and ignores anything the client might claim', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession });
    prisma.tx.profile.findUnique.mockResolvedValue({
      currentStreak: 3,
      totalXp: 100,
      totalStudyMinutes: 50,
      level: 1,
      plan: 'FREE',
    });

    const result = await service.endSession('user-1', 'session-1');

    // 45 wall-clock minutes, no pauses. Cycles are derived: floor(45/25) = 1.
    const expectedScore = calculateScore({
      durationMinutes: 45,
      proofModeEnabled: false,
      allProofChecksPassed: false,
      pomodorosCyclesCompleted: 1,
      currentStreakDays: 3,
      leagueMode: undefined,
      // 45 >= workDuration(25): a full block was completed, so not early.
      endedEarly: false,
    });

    expect(result.score).toEqual(expectedScore);
    expect(prisma.tx.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          status: 'completed',
          totalDurationMinutes: 45,
          pomodoroCyclesCompleted: 1,
          measuredSeconds: 45 * 60,
          endReason: 'user',
        }),
      }),
    );
  });

  it('subtracts paused intervals from the credited duration', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession });
    // Paused for 15 of the 45 minutes.
    prisma.tx.sessionPause.findMany.mockResolvedValue([
      {
        startedAt: new Date(NOW.getTime() - 30 * 60_000),
        endedAt: new Date(NOW.getTime() - 15 * 60_000),
      },
    ]);

    const result = await service.endSession('user-1', 'session-1');

    expect(Number(result.session.totalDurationMinutes)).toBe(30);
  });

  it('credits only up to the pause when a session is ended while still paused', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      status: 'paused',
    });
    // Open interval — paused 20 minutes ago and never resumed.
    prisma.tx.sessionPause.findMany.mockResolvedValue([
      { startedAt: new Date(NOW.getTime() - 20 * 60_000), endedAt: null },
    ]);

    const result = await service.endSession('user-1', 'session-1');

    // 45 elapsed − 20 paused = 25 credited.
    expect(Number(result.session.totalDurationMinutes)).toBe(25);
  });

  it('clips the credited duration at the daily cap and records an anomaly', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      startedAt: new Date(NOW.getTime() - 120 * 60_000), // 2h session
    });
    // The user has already banked all but 30 minutes of the day's allowance.
    prisma.studySession.aggregate.mockResolvedValue({
      _sum: { totalDurationMinutes: DEFAULT_DAILY_STUDY_MINUTES_CAP - 30 },
    });

    const result = await service.endSession('user-1', 'session-1');

    expect(Number(result.session.totalDurationMinutes)).toBe(30);
    // The measurement is preserved even though the credit was cut.
    expect(result.session.measuredSeconds).toBe(120 * 60);
    expect(prisma.sessionAnomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'daily_cap_clipped' }),
      }),
    );
  });

  it('derives zero pomodoro cycles for a stopwatch session however long it ran', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      timerMode: 'stopwatch',
    });

    const result = await service.endSession('user-1', 'session-1');

    expect(result.session.pomodoroCyclesCompleted).toBe(0);
    // No target duration means there is nothing to fall short of, so the
    // hardcore early-exit penalty can never apply to a stopwatch session.
    expect(result.score.earlyExitPenalty).toBe(0);
  });

  it('marks the session as verified only when proof mode was on and every check passed', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession, proofMode: true });
    prisma.tx.proofCheck.findMany.mockResolvedValue([
      { status: 'passed' },
      { status: 'passed' },
    ]);

    const result = await service.endSession('user-1', 'session-1');

    expect(result.session.isVerified).toBe(true);
  });

  it('does not mark the session verified if any proof check failed', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession, proofMode: true });
    prisma.tx.proofCheck.findMany.mockResolvedValue([
      { status: 'passed' },
      { status: 'failed' },
    ]);

    const result = await service.endSession('user-1', 'session-1');

    expect(result.session.isVerified).toBe(false);
  });

  it('applies the hardcore early-exit penalty only when the session is attached to a hardcore league', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      // 10 minutes of a 25-minute block — bailed before finishing one.
      startedAt: new Date(NOW.getTime() - 10 * 60_000),
      leagueId: 'league-1',
    });
    prisma.tx.league.findUnique.mockResolvedValue({ mode: 'hardcore' });

    const result = await service.endSession('user-1', 'session-1');

    expect(result.score.earlyExitPenalty).toBeGreaterThan(0);
  });

  it('propagates score and XP into every league the user belongs to', async () => {
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession });
    prisma.leagueMember.findMany.mockResolvedValue([
      { id: 'member-1', leagueId: 'league-a' },
      { id: 'member-2', leagueId: 'league-b' },
    ]);

    await service.endSession('user-1', 'session-1');

    expect(prisma.feedPost.create).toHaveBeenCalledTimes(2);
  });
});

describe('SessionsService.startSession', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SessionsService;

  const dto = {
    subject_id: 'subject-1',
    timer_mode: 'pomodoro' as const,
    work_duration: 25,
    break_duration: 5,
    proof_mode: false,
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    service = makeService(prisma);
  });

  it('refuses to start a second session while one is live, and hands back the live one', async () => {
    prisma.studySession.findFirst.mockResolvedValue({
      id: 'live-session',
      status: 'active',
      startedAt: new Date(NOW.getTime() - 60_000),
      subjectId: 'subject-9',
    });

    await expect(service.startSession('user-1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.studySession.create).not.toHaveBeenCalled();
    expect(prisma.sessionAnomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'overlap_rejected' }),
      }),
    );
  });

  it('treats a paused session as live for the purposes of overlap', async () => {
    prisma.studySession.findFirst.mockResolvedValue({
      id: 'live-session',
      status: 'paused',
      startedAt: new Date(NOW.getTime() - 60_000),
      subjectId: 'subject-9',
    });

    await expect(service.startSession('user-1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('stamps startedAt and seeds the first heartbeat itself', async () => {
    prisma.studySession.findUnique.mockResolvedValue({ id: 'session-1', proofChecks: [] });

    await service.startSession('user-1', dto);

    expect(prisma.studySession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startedAt: NOW,
          lastHeartbeatAt: NOW,
          status: 'active',
        }),
      }),
    );
  });

  it('ignores work/break duration for a stopwatch session', async () => {
    prisma.studySession.findUnique.mockResolvedValue({ id: 'session-1', proofChecks: [] });

    await service.startSession('user-1', { ...dto, timer_mode: 'stopwatch' });

    const data = prisma.studySession.create.mock.calls[0][0].data;
    expect(data.workDuration).toBeUndefined();
    expect(data.breakDuration).toBeUndefined();
  });
});

describe('SessionsService.heartbeat', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SessionsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = makeService(prisma);
  });

  it('refreshes lastHeartbeatAt and returns the server-side elapsed time', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'active',
      startedAt: new Date(NOW.getTime() - 10 * 60_000),
      pausedAt: null,
    });

    const result = await service.heartbeat('user-1', 'session-1');

    expect(prisma.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastHeartbeatAt: NOW } }),
    );
    expect(result.elapsed_seconds).toBe(600);
  });

  it('accepts a heartbeat on a paused session without resuming it', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'paused',
      startedAt: new Date(NOW.getTime() - 10 * 60_000),
      pausedAt: new Date(NOW.getTime() - 5 * 60_000),
    });

    const result = await service.heartbeat('user-1', 'session-1');

    expect(result.status).toBe('paused');
    expect(prisma.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastHeartbeatAt: NOW } }),
    );
  });

  it('rejects a heartbeat on a session that is already finished', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'completed',
      startedAt: NOW,
      pausedAt: null,
    });

    await expect(service.heartbeat('user-1', 'session-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects a heartbeat on someone else's session", async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'someone-else',
      status: 'active',
      startedAt: NOW,
      pausedAt: null,
    });

    await expect(service.heartbeat('user-1', 'session-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('SessionsService pause/resume', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SessionsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = makeService(prisma);
  });

  it('opens a pause interval and flips the session to paused', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'active',
    });

    await service.pauseSession('user-1', 'session-1');

    expect(prisma.sessionPause.create).toHaveBeenCalledWith({
      data: { sessionId: 'session-1', startedAt: NOW },
    });
    expect(prisma.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'paused', pausedAt: NOW }),
      }),
    );
  });

  it('refuses to pause an already-paused session', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'paused',
    });

    await expect(service.pauseSession('user-1', 'session-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('closes every open pause interval on resume', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'paused',
    });

    await service.resumeSession('user-1', 'session-1');

    expect(prisma.sessionPause.updateMany).toHaveBeenCalledWith({
      where: { sessionId: 'session-1', endedAt: null },
      data: { endedAt: NOW },
    });
    expect(prisma.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'active', pausedAt: null }),
      }),
    );
  });

  it('refuses to resume a session that is not paused', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'active',
    });

    await expect(service.resumeSession('user-1', 'session-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('SessionsService.sweepStaleSessions', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SessionsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = makeService(prisma);
  });

  it('credits a zombie session only up to its last heartbeat, not up to the sweep', async () => {
    const startedAt = new Date(NOW.getTime() - 120 * 60_000); // started 2h ago
    const lastHeartbeatAt = new Date(NOW.getTime() - 90 * 60_000); // died 90min ago

    prisma.studySession.findMany.mockResolvedValue([
      { id: 'session-1', userId: 'user-1', startedAt, lastHeartbeatAt },
    ]);
    prisma.tx.studySession.findUnique.mockResolvedValue({
      ...baseSession,
      startedAt,
    });

    const result = await service.sweepStaleSessions(NOW);

    expect(result.swept).toBe(1);
    expect(prisma.tx.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'abandoned',
          endReason: 'abandoned_no_heartbeat',
          endedAt: lastHeartbeatAt,
          // 30 minutes of real study before the app died — kept, not discarded.
          totalDurationMinutes: 30,
        }),
      }),
    );
  });

  it('scores a swept session, so a killed app does not cost the user their points', async () => {
    const startedAt = new Date(NOW.getTime() - 120 * 60_000);
    const lastHeartbeatAt = new Date(NOW.getTime() - 90 * 60_000);

    prisma.studySession.findMany.mockResolvedValue([
      { id: 'session-1', userId: 'user-1', startedAt, lastHeartbeatAt },
    ]);
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession, startedAt });

    await service.sweepStaleSessions(NOW);

    const written = prisma.tx.studySession.update.mock.calls[0][0].data;
    expect(written.pointsEarned).toBeGreaterThan(0);
    expect(written.xpEarned).toBeGreaterThan(0);
  });

  it('credits nothing when the session never beat at all', async () => {
    const startedAt = new Date(NOW.getTime() - 120 * 60_000);

    prisma.studySession.findMany.mockResolvedValue([
      { id: 'session-1', userId: 'user-1', startedAt, lastHeartbeatAt: null },
    ]);
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession, startedAt });

    await service.sweepStaleSessions(NOW);

    expect(prisma.tx.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalDurationMinutes: 0, endedAt: startedAt }),
      }),
    );
  });

  it('only looks at sessions quiet for longer than the grace window', async () => {
    await service.sweepStaleSessions(NOW);

    const where = prisma.studySession.findMany.mock.calls[0][0].where;
    expect(where.OR[0].lastHeartbeatAt.lt).toEqual(
      new Date(NOW.getTime() - HEARTBEAT_GRACE_SECONDS * 1000),
    );
  });

  it('keeps going when one session fails to sweep', async () => {
    prisma.studySession.findMany.mockResolvedValue([
      { id: 'bad', userId: 'user-1', startedAt: NOW, lastHeartbeatAt: NOW },
      { id: 'good', userId: 'user-1', startedAt: NOW, lastHeartbeatAt: NOW },
    ]);
    prisma.tx.studySession.findUnique
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue({ ...baseSession, id: 'good', startedAt: NOW });

    const result = await service.sweepStaleSessions(NOW);

    // One blew up, the other still got closed — a single bad row must not
    // stall the janitor and leave every later zombie open.
    expect(result.swept).toBe(1);
  });

  it('records a heartbeat_gap anomaly for the trail', async () => {
    const startedAt = new Date(NOW.getTime() - 60 * 60_000);
    const lastHeartbeatAt = new Date(NOW.getTime() - 30 * 60_000);

    prisma.studySession.findMany.mockResolvedValue([
      { id: 'session-1', userId: 'user-1', startedAt, lastHeartbeatAt },
    ]);
    prisma.tx.studySession.findUnique.mockResolvedValue({ ...baseSession, startedAt });

    await service.sweepStaleSessions(NOW);

    expect(prisma.sessionAnomaly.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'heartbeat_gap' }),
      }),
    );
  });
});

describe('SessionsService.abandonSession', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: SessionsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = makeService(prisma);
  });

  it('throws NotFoundException for a missing session', async () => {
    prisma.studySession.findUnique.mockResolvedValue(null);

    await expect(service.abandonSession('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when the session belongs to someone else', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'someone-else',
      status: 'active',
    });

    await expect(service.abandonSession('user-1', 's1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws BadRequestException when the session is already finished', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'user-1',
      status: 'completed',
    });

    await expect(service.abandonSession('user-1', 's1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('discards the session without scoring it', async () => {
    prisma.studySession.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'user-1',
      status: 'active',
    });

    await service.abandonSession('user-1', 's1');

    expect(prisma.studySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({
          status: 'abandoned',
          endReason: 'user_abandon',
        }),
      }),
    );
    // An explicit discard earns nothing — no scoring transaction runs.
    expect(prisma.tx.studySession.update).not.toHaveBeenCalled();
  });
});
