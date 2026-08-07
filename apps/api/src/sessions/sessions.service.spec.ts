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
    leagueMember: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    feedPost: {
      createManyAndReturn: jest.fn().mockResolvedValue([]),
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
    prisma.tx.leagueMember.findMany.mockResolvedValue([
      { leagueId: 'league-a', league: { name: 'Sala A' } },
      { leagueId: 'league-b', league: { name: 'Sala B' } },
    ]);
    prisma.tx.feedPost.createManyAndReturn.mockResolvedValue([
      { id: 'post-a', leagueId: 'league-a' },
      { id: 'post-b', leagueId: 'league-b' },
    ]);

    const result = await service.endSession('user-1', 'session-1');

    expect(prisma.tx.leagueMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    expect(prisma.tx.feedPost.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ leagueId: 'league-a' }),
        expect.objectContaining({ leagueId: 'league-b' }),
      ],
      select: { id: true, leagueId: true },
    });
    expect(result.posts).toEqual([
      { id: 'post-a', roomId: 'league-a', roomName: 'Sala A' },
      { id: 'post-b', roomId: 'league-b', roomName: 'Sala B' },
    ]);
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

/**
 * O mapa de constância do perfil — a grade estilo GitHub.
 *
 * A janela termina **hoje**, e não no fim do mês: um mapa que corta no dia 1º
 * esconde justamente a sequência recente, que é a informação com valor.
 */
describe('SessionsService.getStudyHeatmap', () => {
  const prismaFake = (sessions: unknown[]) => ({
    studySession: { findMany: jest.fn().mockResolvedValue(sessions) },
  });

  it('soma os minutos do dia quando houve mais de uma sessão', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-06T15:00:00.000Z'));
    const prisma = prismaFake([
      { endedAt: new Date('2026-08-05T10:00:00.000Z'), totalDurationMinutes: 25 },
      { endedAt: new Date('2026-08-05T20:00:00.000Z'), totalDurationMinutes: 35 },
      { endedAt: new Date('2026-08-06T09:00:00.000Z'), totalDurationMinutes: 50 },
    ]);

    const mapa = await new SessionsService(
      prisma as any, {} as any, {} as any, {} as any, {} as any,
    ).getStudyHeatmap('eu', 371);

    // Duas sessões no dia 5 viram um dia de 60 minutos, não dois registros.
    expect(mapa.days).toEqual([
      { date: '2026-08-05', minutes: 60 },
      { date: '2026-08-06', minutes: 50 },
    ]);
    expect(mapa.to).toBe('2026-08-06');
    jest.useRealTimers();
  });

  it('pede uma janela que termina hoje e cobre os dias pedidos', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-06T15:00:00.000Z'));
    const prisma = prismaFake([]);

    const mapa = await new SessionsService(
      prisma as any, {} as any, {} as any, {} as any, {} as any,
    ).getStudyHeatmap('eu', 7);

    // 7 dias contando hoje: 31/07 a 06/08.
    expect(mapa.from).toBe('2026-07-31');
    expect(mapa.to).toBe('2026-08-06');
    // Só dias COM estudo viajam pelo fio; os zeros a tela preenche.
    expect(mapa.days).toEqual([]);
    jest.useRealTimers();
  });

  it('só conta sessão creditada, como o resto do produto', async () => {
    const prisma = prismaFake([]);
    await new SessionsService(
      prisma as any, {} as any, {} as any, {} as any, {} as any,
    ).getStudyHeatmap('eu', 30);

    const filtro = prisma.studySession.findMany.mock.calls[0][0].where;
    expect(filtro.userId).toBe('eu');
    expect(filtro.endedAt).toBeDefined();
  });
});

/**
 * O recorde de sequência é gravado em dois ramos, e um deles esquecia.
 *
 * O sintoma chegou por print da tela do perfil: **"atual 1, maior 0"**. Um
 * recorde menor que o atual não é ambíguo — é defeito, e o usuário lê como tal.
 */
describe('updateUserStreak — o recorde nunca fica abaixo do atual', () => {
  const DIA = new Date('2026-08-06T14:00:00.000Z');

  /** Prisma mínimo para o caminho da sequência. */
  function prismaDaSequencia(profile: any) {
    return {
      profile: {
        findUnique: jest.fn().mockResolvedValue({ plan: 'FREE', ...profile }),
        update: jest.fn(),
      },
      studySession: {
        // Acima do mínimo diário, senão o método volta antes de contar o dia.
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalDurationMinutes: 90 } }),
        // Os dias do miolo, para a regra do dia leve. Vazio = houve dia sem
        // nenhum estudo, que é o que quebra a corrente.
        findMany: jest.fn().mockResolvedValue(profile.diasDoMiolo ?? []),
      },
    };
  }

  const chamar = async (prisma: any) => {
    const service = new SessionsService(
      prisma as any, {} as any, {} as any, { track: jest.fn() } as any, {} as any,
    );
    await (service as any).updateUserStreak('user-1', DIA);
    return prisma.profile.update.mock.calls[0][0].data;
  };

  it('registra o primeiro dia como recorde de 1, em vez de deixar em 0', async () => {
    // `lastStudyDate: null` é o primeiro dia qualificado da conta. Este ramo
    // gravava só `currentStreak: 1` — e como ele nunca passa pelo `Math.max` do
    // outro ramo, o recorde ficava em 0 para sempre.
    const dados = await chamar(
      prismaDaSequencia({ lastStudyDate: null, currentStreak: 0, longestStreak: 0 }),
    );

    expect(dados.currentStreak).toBe(1);
    expect(dados.longestStreak).toBe(1);
  });

  it('não rebaixa um recorde já conquistado quando a sequência quebra', async () => {
    // Estudou 12 dias, sumiu uma semana, voltou hoje: o atual volta a 1 e o
    // recorde tem que continuar 12.
    const dados = await chamar(
      prismaDaSequencia({
        lastStudyDate: new Date('2026-07-20T14:00:00.000Z'),
        currentStreak: 12,
        longestStreak: 12,
      }),
    );

    expect(dados.currentStreak).toBe(1);
    expect(dados.longestStreak).toBe(12);
  });
});

/**
 * A regra do dia leve.
 *
 * Vinte minutos não ganham o dia — o piso de 25 continua valendo para *ganhar*.
 * Mas eles também não podiam custar a corrente, e custavam: o dia curto saía
 * pelo `return` do piso sem atualizar `lastStudyDate`, e o dia seguinte via uma
 * data que não era "ontem" e reiniciava em 1. O calendário, que não tem piso,
 * pintava o dia curto de azul — então a tela mostrava quatro dias estudados e
 * sequência 1 ao mesmo tempo.
 */
describe('updateUserStreak — dia leve não quebra a sequência', () => {
  const DIA = new Date('2026-08-06T14:00:00.000Z');

  function prismaDoCiclo(profile: any, diasDoMiolo: { endedAt: Date }[] = []) {
    return {
      profile: {
        findUnique: jest.fn().mockResolvedValue({ plan: 'FREE', ...profile }),
        update: jest.fn(),
      },
      studySession: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalDurationMinutes: 90 } }),
        findMany: jest.fn().mockResolvedValue(diasDoMiolo),
      },
    };
  }

  const chamar = async (p: any) => {
    const service = new SessionsService(
      p as any, {} as any, {} as any, { track: jest.fn() } as any, {} as any,
    );
    await (service as any).updateUserStreak('user-1', DIA);
    return p.profile.update.mock.calls[0]?.[0]?.data;
  };

  it('continua a corrente quando o dia do meio teve algum estudo', async () => {
    // Ganhou 04/08, dia curto em 05/08, ganha de novo hoje 06/08.
    const dados = await chamar(
      prismaDoCiclo(
        { lastStudyDate: new Date('2026-08-04T10:00:00.000Z'), currentStreak: 4, longestStreak: 4 },
        [{ endedAt: new Date('2026-08-05T18:00:00.000Z') }],
      ),
    );

    expect(dados.currentStreak).toBe(5);
    expect(dados.longestStreak).toBe(5);
  });

  it('quebra quando o dia do meio foi vazio de verdade', async () => {
    const dados = await chamar(
      prismaDoCiclo(
        { lastStudyDate: new Date('2026-08-04T10:00:00.000Z'), currentStreak: 4, longestStreak: 4 },
        [],
      ),
    );

    expect(dados.currentStreak).toBe(1);
    // O recorde conquistado não é rebaixado pela quebra.
    expect(dados.longestStreak).toBe(4);
  });

  it('um único dia vazio no meio de vários curtos já quebra', async () => {
    // Ganhou 02/08; 03 e 05 tiveram algo, 04 não. Faltam 3 dias no miolo.
    const dados = await chamar(
      prismaDoCiclo(
        { lastStudyDate: new Date('2026-08-02T10:00:00.000Z'), currentStreak: 9, longestStreak: 9 },
        [
          { endedAt: new Date('2026-08-03T18:00:00.000Z') },
          { endedAt: new Date('2026-08-05T18:00:00.000Z') },
        ],
      ),
    );

    expect(dados.currentStreak).toBe(1);
  });

  it('o caminho de ontem não vai ao banco atrás do miolo', async () => {
    const p = prismaDoCiclo({
      lastStudyDate: new Date('2026-08-05T10:00:00.000Z'),
      currentStreak: 2,
      longestStreak: 2,
    });

    const dados = await chamar(p);

    expect(dados.currentStreak).toBe(3);
    // Ontem é o caso comum: uma consulta a mais por sessão encerrada, todo dia,
    // para responder algo que a data já responde.
    expect(p.studySession.findMany).not.toHaveBeenCalled();
  });
});

/**
 * O produto tinha duas convenções de dia: a sequência usava hora local do
 * processo (`setHours`), e o mapa e o calendário usavam UTC. Só coincidiam
 * porque o servidor roda em UTC.
 */
describe('todayWindow — uma convenção de dia só', () => {
  it('recorta o dia em UTC, e não no fuso do processo', () => {
    const service = new SessionsService({} as any, {} as any, {} as any, {} as any, {} as any);

    const { start, end } = (service as any).todayWindow(new Date('2026-08-06T02:30:00.000Z'));

    expect(start.toISOString()).toBe('2026-08-06T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-07T00:00:00.000Z');
  });
});
