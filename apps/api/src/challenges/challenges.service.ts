import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  async leaderboard(
    challengeId: string,
    userId: string,
    page: number,
    limit: number,
  ) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: challengeId, userId } },
    });
    if (!membership) throw new ForbiddenException('You are not a room member');

    const league = await this.prisma.league.findUnique({
      where: { id: challengeId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, handle: true, avatarUrl: true },
            },
          },
        },
      },
    });
    if (!league) throw new NotFoundException('Challenge not found');

    const memberIds = league.members.map((member) => member.userId);
    const sessions = await this.prisma.studySession.findMany({
      where: {
        userId: { in: memberIds },
        endedAt: { gte: league.startDate, lt: league.endDate },
        OR: [
          { status: 'completed' },
          { status: 'abandoned', endReason: 'abandoned_no_heartbeat' },
        ],
      },
      select: {
        userId: true,
        totalDurationMinutes: true,
        isVerified: true,
        endedAt: true,
      },
    });

    const totals = new Map<
      string,
      { minutes: number; sessions: number; verifiedMinutes: number; lastAt: Date | null }
    >();
    for (const session of sessions) {
      const total = totals.get(session.userId) ?? {
        minutes: 0,
        sessions: 0,
        verifiedMinutes: 0,
        lastAt: null,
      };
      const minutes = Number(session.totalDurationMinutes);
      total.minutes += minutes;
      total.sessions += minutes >= 5 ? 1 : 0;
      total.verifiedMinutes += session.isVerified ? minutes : 0;
      if (session.endedAt && (!total.lastAt || session.endedAt > total.lastAt)) {
        total.lastAt = session.endedAt;
      }
      totals.set(session.userId, total);
    }

    const ranked = league.members
      .map((member) => {
        const total = totals.get(member.userId) ?? {
          minutes: 0,
          sessions: 0,
          verifiedMinutes: 0,
          lastAt: null,
        };
        return {
          userId: member.userId,
          displayName: member.displayName,
          handle: member.user.handle,
          avatarUrl: member.user.avatarUrl,
          metricValue: Math.round(total.minutes),
          minutes: Math.round(total.minutes),
          sessions: total.sessions,
          verifiedMinutes: Math.round(total.verifiedMinutes),
          lastActivityAt: total.lastAt,
        };
      })
      .sort(
        (a, b) =>
          b.metricValue - a.metricValue ||
          b.verifiedMinutes - a.verifiedMinutes ||
          (a.lastActivityAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (b.lastActivityAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
          a.userId.localeCompare(b.userId),
      )
      .map((entry, index) => ({ rank: index + 1, ...entry }));

    const now = new Date();
    const status =
      now < league.startDate
        ? 'upcoming'
        : now >= league.endDate
          ? 'completed'
          : 'active';
    const me = ranked.find((entry) => entry.userId === userId) ?? null;
    const offset = (page - 1) * limit;

    return {
      challenge: {
        id: league.id,
        roomId: league.id,
        title: league.description ?? league.name,
        metric: 'minutes',
        metricUnit: 'min',
        status,
        startsAt: league.startDate,
        endsAt: league.endDate,
        serverTime: now,
      },
      entries: ranked.slice(offset, offset + limit),
      me: me && { rank: me.rank, metricValue: me.metricValue },
      total: ranked.length,
      page,
      limit,
    };
  }
}
