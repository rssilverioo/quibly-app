import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { StartSessionDto } from './dto/start-session.dto';
import {
  completedCycles,
  creditedDuration,
  DEFAULT_DAILY_STUDY_MINUTES_CAP,
  endedEarly as isEndedEarly,
  HEARTBEAT_GRACE_SECONDS,
  HEARTBEAT_INTERVAL_SECONDS,
  measuredSeconds,
  SessionAnomalyKind,
  sweepCreditInstant,
} from './session-timing';
import {
  calculateScore,
  levelFromXp,
  SCORING,
} from '@quibly/shared';

/** Statuses a session can be in while it is still someone's open timer. */
const LIVE_STATUSES = ['active', 'paused'] as const;

/**
 * Which terminal sessions count as study the user actually did.
 *
 * `completed` obviously. But so does a session the sweeper closed: the minutes
 * up to the last heartbeat were real, they were scored, and it would be
 * incoherent to pay SP for them and then leave them out of the streak, the
 * daily cap, or the history. What does *not* count is `user_abandon` — an
 * explicit discard, where the user said the session shouldn't exist.
 *
 * `endReason` is NULL on every row written before this migration, so the
 * `completed` arm has to stand alone rather than filter on the reason.
 */
const CREDITED_SESSION_FILTER = {
  OR: [
    { status: 'completed' as const },
    { status: 'abandoned' as const, endReason: 'abandoned_no_heartbeat' },
  ],
};

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementsService: AchievementsService,
    private readonly notificationsService: NotificationsService,
    private readonly analytics: AnalyticsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Antifraud trail. Never throws: a failed write here must not take down a
   * study session, and nothing in Fase 1 reads these rows on a hot path.
   */
  private async recordAnomaly(
    userId: string,
    kind: SessionAnomalyKind,
    detail: Record<string, unknown>,
    sessionId?: string,
  ): Promise<void> {
    try {
      await this.prisma.sessionAnomaly.create({
        data: { userId, sessionId: sessionId ?? null, kind, detail: detail as never },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record ${kind} anomaly for user=${userId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Local-day window used by both the streak and the daily cap. */
  private todayWindow(now = new Date()): { start: Date; end: Date } {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  /** Minutes this user has already banked today, across completed sessions. */
  private async creditedMinutesToday(userId: string, now = new Date()): Promise<number> {
    const { start, end } = this.todayWindow(now);
    const agg = await this.prisma.studySession.aggregate({
      where: { userId, ...CREDITED_SESSION_FILTER, endedAt: { gte: start, lt: end } },
      _sum: { totalDurationMinutes: true },
    });
    return Number(agg._sum.totalDurationMinutes ?? 0);
  }

  private async dailyCapMinutes(plan: Plan | undefined): Promise<number> {
    if (!plan) return DEFAULT_DAILY_STUDY_MINUTES_CAP;
    return this.entitlements.getLimit(plan, 'daily_study_minutes_cap');
  }

  private async updateUserStreak(userId: string, at = new Date()): Promise<void> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        lastStudyDate: true,
        currentStreak: true,
        longestStreak: true,
        plan: true,
      },
    });

    if (!profile) return;

    // `at` is the instant the session ended, not `now` — a session swept at
    // 00:03 for time that ran until 23:58 belongs to the day it was studied.
    const { start: today, end: tomorrow } = this.todayWindow(at);

    // Sum all credited session minutes for today (00:00 – 23:59)
    const todaySessions = await this.prisma.studySession.aggregate({
      where: {
        userId,
        ...CREDITED_SESSION_FILTER,
        endedAt: { gte: today, lt: tomorrow },
      },
      _sum: { totalDurationMinutes: true },
    });

    const todayMinutes = Number(todaySessions._sum.totalDurationMinutes ?? 0);

    // Only count the day if user studied at least 25 minutes
    if (todayMinutes < SCORING.MIN_DAILY_MINUTES) return;

    const lastDate = profile.lastStudyDate
      ? new Date(profile.lastStudyDate)
      : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);

    // Already counted today
    if (lastDate && lastDate.getTime() === today.getTime()) return;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastDate && lastDate.getTime() === yesterday.getTime()) {
      // Studied yesterday → continue streak
      const newStreak = profile.currentStreak + 1;
      await this.prisma.profile.update({
        where: { id: userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(profile.longestStreak, newStreak),
          lastStudyDate: today,
        },
      });
      this.analytics.track('streak_extended', { userId, plan: profile.plan }, { days: newStreak });
    } else {
      // A streak that was actually running (>=1 day) just lapsed. `lastDate
      // === null` means this is the user's first qualifying day ever — that
      // isn't a break, there was nothing to lose.
      if (lastDate && profile.currentStreak >= 1) {
        this.analytics.track(
          'streak_broken',
          { userId, plan: profile.plan },
          { previous_days: profile.currentStreak },
        );
      }
      /**
       * Reinício conta como recorde de 1 dia.
       *
       * Este ramo gravava só `currentStreak: 1` e não tocava em
       * `longestStreak`. O efeito aparecia na tela do usuário como **"atual 1,
       * maior 0"** — um recorde menor que o atual, que é impossível de ler como
       * outra coisa senão defeito.
       *
       * E não era só cosmético: quem estuda um dia, falha, estuda outro, nunca
       * passa pelo ramo de cima (o que faz `Math.max`), então o recorde ficava
       * em 0 para sempre. O primeiro dia é uma sequência de um dia — o `max`
       * aqui é o mesmo do outro ramo, pela mesma razão.
       */
      await this.prisma.profile.update({
        where: { id: userId },
        data: {
          currentStreak: 1,
          longestStreak: Math.max(profile.longestStreak, 1),
          lastStudyDate: today,
        },
      });
    }
  }

  async startSession(userId: string, dto: StartSessionDto) {
    // Overlapping sessions are refused, not silently resolved. The old code
    // abandoned whatever was running and opened a new one, which meant two
    // devices could ping-pong between themselves and a user could never tell
    // which timer was real. Refusing and handing back the live session lets the
    // client decide: resume it, or end it and try again.
    const existingSession = await this.prisma.studySession.findFirst({
      where: { userId, status: { in: [...LIVE_STATUSES] } },
      select: { id: true, status: true, startedAt: true, subjectId: true },
    });

    if (existingSession) {
      await this.recordAnomaly(
        userId,
        'overlap_rejected',
        {
          existing_session_id: existingSession.id,
          existing_started_at: existingSession.startedAt.toISOString(),
          requested_subject_id: dto.subject_id,
        },
        existingSession.id,
      );

      throw new ConflictException({
        message:
          'You already have a live session. End or resume it before starting another.',
        code: 'SESSION_ALREADY_LIVE',
        active_session: {
          id: existingSession.id,
          status: existingSession.status,
          started_at: existingSession.startedAt.toISOString(),
          subject_id: existingSession.subjectId,
        },
      });
    }

    const now = new Date();
    const isStopwatch = dto.timer_mode === 'stopwatch';

    const session = await this.prisma.studySession.create({
      data: {
        userId,
        subjectId: dto.subject_id,
        leagueId: dto.league_id || null,
        timerMode: dto.timer_mode,
        // Stopwatch has no target duration; leave the schema defaults so
        // nothing downstream has to branch on a null.
        ...(isStopwatch || dto.work_duration === undefined
          ? {}
          : { workDuration: dto.work_duration }),
        ...(isStopwatch || dto.break_duration === undefined
          ? {}
          : { breakDuration: dto.break_duration }),
        proofMode: dto.proof_mode,
        status: 'active',
        startedAt: now,
        // Treat the start as the first beat, so a session that dies before its
        // first heartbeat is still swept on schedule instead of hanging around.
        lastHeartbeatAt: now,
      },
    });

    const fullSession = await this.prisma.studySession.findUnique({
      where: { id: session.id },
      include: { proofChecks: true },
    });

    return {
      ...fullSession,
      scheduled_proof_check_times: [],
      heartbeat_interval_seconds: HEARTBEAT_INTERVAL_SECONDS,
      heartbeat_grace_seconds: HEARTBEAT_GRACE_SECONDS,
    };
  }

  /**
   * Keep-alive. Cheap on purpose — this runs every 30s per live session, and in
   * Fase 2 the presence gateway will consume the same write.
   *
   * Beating a `paused` session is allowed and does not resume it: the app is
   * still open, the user just isn't studying. It only refreshes the deadline.
   */
  async heartbeat(userId: string, sessionId: string) {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, status: true, startedAt: true, pausedAt: true },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not own this session');
    }
    if (!LIVE_STATUSES.includes(session.status as (typeof LIVE_STATUSES)[number])) {
      throw new BadRequestException('Session is not live');
    }

    const now = new Date();
    await this.prisma.studySession.update({
      where: { id: sessionId },
      data: { lastHeartbeatAt: now },
    });

    // Elapsed so far, so the client can render a timer it did not have to keep
    // itself. This is what makes the mobile Live Activity honest: it displays a
    // number the server owns.
    const pauses = await this.prisma.sessionPause.findMany({
      where: { sessionId },
      select: { startedAt: true, endedAt: true },
    });

    return {
      session_id: sessionId,
      status: session.status,
      server_time: now.toISOString(),
      elapsed_seconds: measuredSeconds(session.startedAt, now, pauses),
      next_heartbeat_in_seconds: HEARTBEAT_INTERVAL_SECONDS,
    };
  }

  async pauseSession(userId: string, sessionId: string) {
    const session = await this.assertOwnedLiveSession(userId, sessionId);
    if (session.status === 'paused') {
      throw new BadRequestException('Session is already paused');
    }

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.studySession.update({
        where: { id: sessionId },
        data: { status: 'paused', pausedAt: now, lastHeartbeatAt: now },
      }),
      this.prisma.sessionPause.create({
        data: { sessionId, startedAt: now },
      }),
    ]);

    return updated;
  }

  async resumeSession(userId: string, sessionId: string) {
    const session = await this.assertOwnedLiveSession(userId, sessionId);
    if (session.status !== 'paused') {
      throw new BadRequestException('Session is not paused');
    }

    const now = new Date();
    // Close every open interval, not just the newest. Under normal operation
    // there is exactly one; closing all of them means a duplicated pause write
    // can't leave an interval open forever and silently eat the session.
    const [updated] = await this.prisma.$transaction([
      this.prisma.studySession.update({
        where: { id: sessionId },
        data: { status: 'active', pausedAt: null, lastHeartbeatAt: now },
      }),
      this.prisma.sessionPause.updateMany({
        where: { sessionId, endedAt: null },
        data: { endedAt: now },
      }),
    ]);

    return updated;
  }

  private async assertOwnedLiveSession(userId: string, sessionId: string) {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, status: true },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException('You do not own this session');
    }
    if (!LIVE_STATUSES.includes(session.status as (typeof LIVE_STATUSES)[number])) {
      throw new BadRequestException('Session is not live');
    }
    return session;
  }

  /**
   * Close a session because the user asked. The duration is measured here and
   * nowhere else — see docs/API-SESSIONS.md §3.
   */
  async endSession(userId: string, sessionId: string, topicIds: string[] = []) {
    const result = await this.finalizeSession(userId, sessionId, {
      endAt: new Date(),
      status: 'completed',
      endReason: 'user',
    });

    if (topicIds.length > 0) {
      await this.tagTopics(sessionId, topicIds);
    }

    return result;
  }

  /**
   * Grava o que o usuário marcou ter estudado.
   *
   * Isto é a razão de o tagging começar na Fase 1 e não na Fase 6: sem
   * histórico, o gerador de plano nasce cego e precisa de um backfill de dados
   * que ninguém guardou (ARCHITECTURE.md §2, "regra inegociável").
   *
   * Nunca lança. Um tópico inválido — currículo reseedado, cliente velho — não
   * pode desfazer o encerramento de uma sessão que já foi pontuada e creditada.
   * Perder a tag é ruim; perder as três horas de estudo é inaceitável.
   */
  private async tagTopics(sessionId: string, topicIds: string[]): Promise<void> {
    try {
      await this.prisma.sessionTopic.createMany({
        data: [...new Set(topicIds)].map((topicId) => ({ sessionId, topicId })),
        skipDuplicates: true,
      });
    } catch (err) {
      this.logger.error(
        `Failed to tag topics on session ${sessionId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * The single path by which a live session becomes a scored, terminal one.
   *
   * Both the explicit `POST /sessions/:id/end` and the heartbeat sweeper come
   * through here. They differ only in *when* the session is deemed to have
   * ended and what it is called afterwards — a swept session is credited up to
   * its last heartbeat and lands as `abandoned`, but it is scored by exactly
   * the same arithmetic. Keeping one implementation is the whole point: a user
   * whose phone was killed after three hours of real study must not lose the
   * points, and two code paths would drift apart the first time either changed.
   */
  private async finalizeSession(
    userId: string,
    sessionId: string,
    opts: { endAt: Date; status: 'completed' | 'abandoned'; endReason: string },
  ) {
    const plan = (
      await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { plan: true },
      })
    )?.plan;
    const capMinutes = await this.dailyCapMinutes(plan);
    const alreadyToday = await this.creditedMinutesToday(userId, opts.endAt);

    // Use a transaction to atomically claim the session and prevent double-scoring
    const {
      updatedSession,
      scoreResult,
      previousLevel,
      newLevel,
      plan: planFromTx,
      capClipped,
      measured,
      posts,
    } = await this.prisma.$transaction(async (tx) => {
        const session = await tx.studySession.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          throw new NotFoundException('Session not found');
        }

        if (session.userId !== userId) {
          throw new ForbiddenException('You do not own this session');
        }

        if (!LIVE_STATUSES.includes(session.status as (typeof LIVE_STATUSES)[number])) {
          throw new BadRequestException('Session is not active');
        }

        // Reading `status` inside the transaction and writing it below is the
        // atomic claim that stops a session from being scored twice — by two
        // taps on "end", or by an end racing the sweeper.
        const now = opts.endAt;

        // The server's number. A session ended while paused is credited only up
        // to the moment it was paused, because `pausedMillisWithin` treats the
        // still-open interval as running to `now`.
        const pauses = await tx.sessionPause.findMany({
          where: { sessionId: session.id },
          select: { startedAt: true, endedAt: true },
        });

        const measured = measuredSeconds(session.startedAt, now, pauses);
        const { creditedMinutes: totalDurationMinutes, clippedByDailyCap } =
          creditedDuration(measured, alreadyToday, capMinutes);

        const cyclesCompleted = completedCycles(
          session.timerMode,
          totalDurationMinutes,
          session.workDuration,
        );

        const proofChecks = await tx.proofCheck.findMany({
          where: { sessionId: session.id },
        });

        const allProofChecksPassed =
          session.proofMode && proofChecks.length > 0
            ? proofChecks.every((check) => check.status === 'passed')
            : false;

        const isVerified = session.proofMode && allProofChecksPassed;

        const profile = await tx.profile.findUnique({
          where: { id: userId },
          select: {
            currentStreak: true,
            totalXp: true,
            totalStudyMinutes: true,
            level: true,
            plan: true,
          },
        });

        const currentStreakDays = profile?.currentStreak ?? 0;

        const endedEarly = isEndedEarly(
          session.timerMode,
          totalDurationMinutes,
          session.workDuration,
        );

        let leagueMode: 'easy' | 'competitive' | 'hardcore' | undefined;
        if (session.leagueId) {
          const league = await tx.league.findUnique({
            where: { id: session.leagueId },
            select: { mode: true },
          });
          leagueMode = league?.mode;
        }

        // The formula itself is untouched (packages/shared/src/scoring.ts) —
        // only the provenance of what goes into it changed.
        const scoreResult = calculateScore({
          durationMinutes: totalDurationMinutes,
          proofModeEnabled: session.proofMode,
          allProofChecksPassed,
          pomodorosCyclesCompleted: cyclesCompleted,
          currentStreakDays,
          leagueMode,
          endedEarly,
        });

        // Mark session as completed atomically. Any pause still open is closed
        // at the same instant, so the row is never left mid-interval.
        await tx.sessionPause.updateMany({
          where: { sessionId: session.id, endedAt: null },
          data: { endedAt: now },
        });

        const updatedSession = await tx.studySession.update({
          where: { id: session.id },
          data: {
            status: opts.status,
            endedAt: now,
            totalDurationMinutes,
            pointsEarned: scoreResult.totalSP,
            xpEarned: scoreResult.xpEarned,
            isVerified,
            pomodoroCyclesCompleted: cyclesCompleted,
            pausedAt: null,
            endReason: opts.endReason,
            measuredSeconds: measured,
          },
        });

        const prevLevel = profile?.level ?? 1;
        const newTotalXp = (profile?.totalXp ?? 0) + scoreResult.xpEarned;
        const newTotalStudyMinutes =
          (profile?.totalStudyMinutes ?? 0) + totalDurationMinutes;
        const newLvl = levelFromXp(newTotalXp);

        await tx.profile.update({
          where: { id: userId },
          data: {
            totalXp: newTotalXp,
            totalStudyMinutes: newTotalStudyMinutes,
            level: newLvl,
          },
        });

        // Closing the session, crediting every league and publishing its feed
        // posts are one database operation. A failure in any write must leave
        // the session active so the client can safely retry.
        const memberships = await tx.leagueMember.findMany({
          where: { userId },
          select: {
            leagueId: true,
            league: { select: { name: true } },
          },
        });

        let posts: Array<{ id: string; roomId: string; roomName: string }> = [];
        if (memberships.length > 0) {
          await tx.leagueMember.updateMany({
            where: { userId },
            data: {
              totalSp: { increment: scoreResult.totalSP },
              weeklySp: { increment: scoreResult.totalSP },
              monthlySp: { increment: scoreResult.totalSP },
              verifiedHours: {
                increment: isVerified ? totalDurationMinutes / 60 : 0,
              },
            },
          });

          const createdPosts = await tx.feedPost.createManyAndReturn({
            data: memberships.map(({ leagueId }) => ({
              leagueId,
              sessionId: updatedSession.id,
              userId,
              showProofPhoto: isVerified,
            })),
            select: { id: true, leagueId: true },
          });
          const roomNames = new Map(
            memberships.map(({ leagueId, league }) => [leagueId, league.name]),
          );
          posts = createdPosts.map((post) => ({
            id: post.id,
            roomId: post.leagueId,
            roomName: roomNames.get(post.leagueId) ?? '',
          }));
        }

        return {
          updatedSession,
          scoreResult,
          previousLevel: prevLevel,
          newLevel: newLvl,
          isVerified,
          totalDurationMinutes,
          plan: profile?.plan,
          capClipped: clippedByDailyCap,
          measured,
          posts,
        };
      },
      { timeout: 15_000 },
    );

    // Fase 1 records and moves on — nobody gets blocked or banned on these.
    if (capClipped) {
      await this.recordAnomaly(
        userId,
        'daily_cap_clipped',
        {
          measured_seconds: measured,
          credited_minutes: Number(updatedSession.totalDurationMinutes ?? 0),
          already_credited_today_minutes: alreadyToday,
          cap_minutes: capMinutes,
        },
        updatedSession.id,
      );
    } else if (Number.isFinite(capMinutes) && measured / 60 > capMinutes) {
      // One sitting longer than a whole day's allowance, and it still fit
      // because the day was empty. Worth a look even though it was credited.
      await this.recordAnomaly(
        userId,
        'implausible_duration',
        { measured_seconds: measured, cap_minutes: capMinutes },
        updatedSession.id,
      );
    }

    // A swept session was still real study — it is scored and it counts. It is
    // just not something the user *completed*, so it does not claim the
    // completion event that the activation funnel is measured on.
    this.analytics.track(
      opts.status === 'completed' ? 'session_completed' : 'session_abandoned',
      { userId, plan: planFromTx },
      {
        minutes: Number(updatedSession.totalDurationMinutes ?? 0),
        points_earned: Number(updatedSession.pointsEarned ?? 0),
        xp_earned: Number(updatedSession.xpEarned ?? 0),
        is_verified: updatedSession.isVerified,
        timer_mode: updatedSession.timerMode,
        ...(opts.status === 'abandoned' ? { reason: opts.endReason } : {}),
      },
    );

    await this.updateUserStreak(userId, opts.endAt);

    // Check achievements
    const newAchievements =
      await this.achievementsService.checkAfterSession(userId);

    // Send push notification for new achievements
    if (newAchievements.length > 0) {
      const achievements = await this.prisma.achievement.findMany({
        where: { id: { in: newAchievements } },
        select: { name: true },
      });
      this.notificationsService
        .notifyAchievements(
          userId,
          achievements.map((a) => a.name),
        )
        .catch(() => {});
    }

    return {
      session: updatedSession,
      score: scoreResult,
      newAchievements,
      previousLevel,
      newLevel,
      posts,
    };
  }

  /** Explicit discard. Earns nothing — that is the point of it being separate from `end`. */
  async abandonSession(userId: string, sessionId: string) {
    await this.assertOwnedLiveSession(userId, sessionId);

    this.analytics.track('session_abandoned', { userId }, { reason: 'explicit' });

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.studySession.update({
        where: { id: sessionId },
        data: {
          status: 'abandoned',
          endedAt: now,
          pausedAt: null,
          endReason: 'user_abandon',
        },
      }),
      this.prisma.sessionPause.updateMany({
        where: { sessionId, endedAt: null },
        data: { endedAt: now },
      }),
    ]);

    return updated;
  }

  /**
   * Sweep sessions whose heartbeat went stale past the grace window.
   *
   * This is what actually kills zombie sessions, and it replaces the
   * `LIVE_SESSION_MAX_HOURS = 12` filter that `leagues.service.ts` used to
   * apply at read time — a band-aid that hid zombies from the live-peers list
   * without ever closing them, so they sat `active` in the table forever.
   *
   * A swept session is credited only up to its last heartbeat: the minutes
   * before the app died are real and are kept; everything after is not.
   *
   * Runs unguarded across instances on purpose. The claim of each row is a
   * conditional `updateMany` on `status`, so if two instances sweep at once
   * exactly one wins per session and the loser credits nothing twice.
   */
  async sweepStaleSessions(now = new Date()): Promise<{ swept: number }> {
    const cutoff = new Date(now.getTime() - HEARTBEAT_GRACE_SECONDS * 1000);

    const stale = await this.prisma.studySession.findMany({
      where: {
        status: { in: [...LIVE_STATUSES] },
        OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null }],
      },
      select: { id: true, userId: true, startedAt: true, lastHeartbeatAt: true },
      // A backlog is drained over several ticks rather than in one long
      // transaction — this is a janitor, not a critical path.
      take: 200,
    });

    let swept = 0;
    for (const session of stale) {
      try {
        await this.sweepOne(session.id, session.userId, session.startedAt, session.lastHeartbeatAt);
        swept += 1;
      } catch (err) {
        this.logger.error(
          `Failed to sweep session ${session.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (swept > 0) {
      this.logger.log(`Swept ${swept} stale session(s) past the ${HEARTBEAT_GRACE_SECONDS}s grace window`);
    }
    return { swept };
  }

  private async sweepOne(
    sessionId: string,
    userId: string,
    startedAt: Date,
    lastHeartbeatAt: Date | null,
  ): Promise<void> {
    const creditUntil = sweepCreditInstant(startedAt, lastHeartbeatAt);

    // Same scoring path as an explicit end — it just ends at the last
    // heartbeat and lands as `abandoned`. `finalizeSession` claims the row
    // inside its transaction, so a sweep racing a user's own "end" resolves to
    // whichever got there first and the loser throws a 400 that is swallowed
    // by the caller's try/catch.
    const result = await this.finalizeSession(userId, sessionId, {
      endAt: creditUntil,
      status: 'abandoned',
      endReason: 'abandoned_no_heartbeat',
    });

    await this.recordAnomaly(
      userId,
      'heartbeat_gap',
      {
        last_heartbeat_at: lastHeartbeatAt?.toISOString() ?? null,
        credited_until: creditUntil.toISOString(),
        credited_minutes: Number(result.session.totalDurationMinutes ?? 0),
        grace_seconds: HEARTBEAT_GRACE_SECONDS,
      },
      sessionId,
    );
  }

  /**
   * The user's open timer, if any — including a paused one, which is still
   * theirs to resume and still blocks a new start.
   *
   * `elapsed_seconds` is the server's count, so a client that was killed and
   * relaunched can rebuild its timer from the truth instead of guessing.
   */
  async getActiveSession(userId: string) {
    const session = await this.prisma.studySession.findFirst({
      where: { userId, status: { in: [...LIVE_STATUSES] } },
      include: { proofChecks: true, pauses: { select: { startedAt: true, endedAt: true } } },
    });

    if (!session) return null;

    return {
      ...session,
      elapsed_seconds: measuredSeconds(session.startedAt, new Date(), session.pauses),
      heartbeat_interval_seconds: HEARTBEAT_INTERVAL_SECONDS,
      heartbeat_grace_seconds: HEARTBEAT_GRACE_SECONDS,
    };
  }

  async getUserSessions(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.prisma.studySession.findMany({
        where: { userId, ...CREDITED_SESSION_FILTER },
        include: {
          subject: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
        orderBy: { endedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.studySession.count({
        where: { userId, ...CREDITED_SESSION_FILTER },
      }),
    ]);

    return { sessions, total, page, limit };
  }

  async getStudyDates(userId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const sessions = await this.prisma.studySession.findMany({
      where: {
        userId,
        ...CREDITED_SESSION_FILTER,
        endedAt: { gte: startDate, lt: endDate },
      },
      select: { endedAt: true, totalDurationMinutes: true },
    });

    const byDay = new Map<string, number>();
    for (const s of sessions) {
      if (!s.endedAt) continue;
      const day = s.endedAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(s.totalDurationMinutes ?? 0));
    }

    return {
      dates: Array.from(byDay.entries()).map(([date, minutes]) => ({
        date,
        minutes,
      })),
    };
  }

  /**
   * Minutos por dia numa **janela corrida**, para o mapa de constância.
   *
   * Existe ao lado de `getStudyDates` em vez de substituí-lo porque as duas
   * perguntas são diferentes: o calendário do perfil pergunta "como foi o mês
   * de julho", e este pergunta "como foram os últimos N dias até hoje" — que é
   * o recorte do GitHub e o que mostra constância. Fundir os dois num endpoint
   * só daria dois modos com parâmetros mutuamente exclusivos.
   *
   * A janela termina **hoje**, não no fim do mês: um mapa que corta no dia 1º
   * esconde exatamente a sequência recente, que é a informação com valor.
   *
   * Devolve só os dias com estudo. Preencher os zeros é trabalho da tela, que
   * já precisa montar a grade de qualquer forma — mandar 365 zeros pelo fio
   * seria pagar banda para transportar ausência.
   */
  async getStudyHeatmap(userId: string, days: number) {
    /**
     * A janela é calculada **em UTC**, e isso não é detalhe.
     *
     * A primeira versão usava `setHours(23,59,59,999)`, que é hora local, e
     * depois `toISOString()` para formatar. Num servidor em UTC−3 o fim do dia
     * local vira 02:59 do dia seguinte em UTC, e o `to` saía como **amanhã** —
     * a grade ganhava uma coluna a mais e a semana inteira deslocava. Pego pelo
     * teste, não pela tela.
     *
     * UTC também é o que o agrupamento por dia abaixo usa (`toISOString`), e o
     * que `getStudyDates` já usava. Uma convenção só, não duas.
     *
     * **Dívida conhecida:** agrupar por UTC significa que quem estuda às 22h em
     * UTC−3 é contado no dia seguinte. Consertar isso exige o fuso do usuário
     * (`Profile.timezone`, que o `ROADMAP §Fase 1` prevê); trocar a convenção só
     * aqui deixaria este mapa discordando do calendário e da sequência.
     */
    const agora = new Date();
    const fim = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 23, 59, 59, 999),
    );
    const inicio = new Date(fim);
    inicio.setUTCDate(inicio.getUTCDate() - (days - 1));
    inicio.setUTCHours(0, 0, 0, 0);

    const sessions = await this.prisma.studySession.findMany({
      where: {
        userId,
        ...CREDITED_SESSION_FILTER,
        endedAt: { gte: inicio, lte: fim },
      },
      select: { endedAt: true, totalDurationMinutes: true },
    });

    const porDia = new Map<string, number>();
    for (const s of sessions) {
      if (!s.endedAt) continue;
      const dia = s.endedAt.toISOString().slice(0, 10);
      porDia.set(dia, (porDia.get(dia) ?? 0) + Number(s.totalDurationMinutes ?? 0));
    }

    return {
      from: inicio.toISOString().slice(0, 10),
      to: fim.toISOString().slice(0, 10),
      days: Array.from(porDia.entries())
        .map(([date, minutes]) => ({ date, minutes }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async getSessionById(sessionId: string, userId: string) {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
      include: {
        proofChecks: true,
        subject: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not own this session');
    }

    return session;
  }
}
