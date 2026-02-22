import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StartSessionDto } from './dto/start-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import {
  calculateScore,
  levelFromXp,
  SCORING,
} from '@quibly/shared';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementsService: AchievementsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async updateUserStreak(userId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        lastStudyDate: true,
        currentStreak: true,
        longestStreak: true,
      },
    });

    if (!profile) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Sum all completed session minutes for today (00:00 – 23:59)
    const todaySessions = await this.prisma.studySession.aggregate({
      where: {
        userId,
        status: 'completed',
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
    } else {
      // Missed a day or first time → reset to 1
      await this.prisma.profile.update({
        where: { id: userId },
        data: { currentStreak: 1, lastStudyDate: today },
      });
    }
  }

  async startSession(userId: string, dto: StartSessionDto) {
    const existingSession = await this.prisma.studySession.findFirst({
      where: { userId, status: 'active' },
    });

    if (existingSession) {
      await this.prisma.studySession.update({
        where: { id: existingSession.id },
        data: { status: 'abandoned', endedAt: new Date() },
      });
    }

    const now = new Date();

    const session = await this.prisma.studySession.create({
      data: {
        userId,
        subjectId: dto.subject_id,
        leagueId: dto.league_id || null,
        timerMode: dto.timer_mode,
        workDuration: dto.work_duration,
        breakDuration: dto.break_duration,
        proofMode: dto.proof_mode,
        status: 'active',
        startedAt: now,
      },
    });

    const fullSession = await this.prisma.studySession.findUnique({
      where: { id: session.id },
      include: { proofChecks: true },
    });

    return {
      ...fullSession,
      scheduled_proof_check_times: [],
    };
  }

  async endSession(userId: string, dto: EndSessionDto) {
    // Use a transaction to atomically claim the session and prevent double-scoring
    const { updatedSession, scoreResult, previousLevel, newLevel } =
      await this.prisma.$transaction(async (tx) => {
        const session = await tx.studySession.findUnique({
          where: { id: dto.session_id },
        });

        if (!session) {
          throw new NotFoundException('Session not found');
        }

        if (session.userId !== userId) {
          throw new ForbiddenException('You do not own this session');
        }

        if (session.status !== 'active') {
          throw new BadRequestException('Session is not active');
        }

        const now = new Date();
        // Use actual work time from mobile (excludes paused time)
        const totalDurationMinutes = dto.total_duration_minutes;

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
          },
        });

        const currentStreakDays = profile?.currentStreak ?? 0;

        const expectedDuration =
          session.workDuration * dto.pomodoro_cycles_completed;
        const endedEarly = totalDurationMinutes < expectedDuration;

        let leagueMode: 'easy' | 'competitive' | 'hardcore' | undefined;
        if (session.leagueId) {
          const league = await tx.league.findUnique({
            where: { id: session.leagueId },
            select: { mode: true },
          });
          leagueMode = league?.mode;
        }

        const scoreResult = calculateScore({
          durationMinutes: totalDurationMinutes,
          proofModeEnabled: session.proofMode,
          allProofChecksPassed,
          pomodorosCyclesCompleted: dto.pomodoro_cycles_completed,
          currentStreakDays,
          leagueMode,
          endedEarly,
        });

        // Mark session as completed atomically
        const updatedSession = await tx.studySession.update({
          where: { id: session.id },
          data: {
            status: 'completed',
            endedAt: now,
            totalDurationMinutes,
            pointsEarned: scoreResult.totalSP,
            xpEarned: scoreResult.xpEarned,
            isVerified,
            pomodoroCyclesCompleted: dto.pomodoro_cycles_completed,
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

        return {
          updatedSession,
          scoreResult,
          previousLevel: prevLevel,
          newLevel: newLvl,
          isVerified,
          totalDurationMinutes,
        };
      });

    await this.updateUserStreak(userId);

    // Update SP for ALL leagues the user belongs to
    const userLeagueMembers = await this.prisma.leagueMember.findMany({
      where: { userId },
    });

    if (userLeagueMembers.length > 0) {
      const isVerified = updatedSession.isVerified;
      const durationMins = Number(updatedSession.totalDurationMinutes ?? 0);
      const verifiedHoursIncrement = isVerified
        ? durationMins / 60
        : 0;

      await Promise.all(
        userLeagueMembers.map(async (member) => {
          await this.prisma.leagueMember.update({
            where: { id: member.id },
            data: {
              totalSp: { increment: scoreResult.totalSP },
              weeklySp: { increment: scoreResult.totalSP },
              monthlySp: { increment: scoreResult.totalSP },
              verifiedHours: { increment: verifiedHoursIncrement },
            },
          });

          await this.prisma.feedPost.create({
            data: {
              leagueId: member.leagueId,
              sessionId: updatedSession.id,
              userId,
              showProofPhoto: isVerified,
            },
          });
        }),
      );
    }

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
    };
  }

  async abandonSession(userId: string, sessionId: string) {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, status: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not own this session');
    }

    if (session.status !== 'active') {
      throw new BadRequestException('Session is not active');
    }

    return this.prisma.studySession.update({
      where: { id: sessionId },
      data: { status: 'abandoned', endedAt: new Date() },
    });
  }

  async getActiveSession(userId: string) {
    return this.prisma.studySession.findFirst({
      where: { userId, status: 'active' },
      include: { proofChecks: true },
    });
  }

  async getUserSessions(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.prisma.studySession.findMany({
        where: { userId, status: 'completed' },
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
        where: { userId, status: 'completed' },
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
        status: 'completed',
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
