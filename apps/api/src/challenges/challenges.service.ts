import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(roomId: string, userId: string, dto: CreateChallengeDto) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: roomId, userId } },
    });
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenException('Only room admins can create a challenge');
    }

    const room = await this.prisma.league.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    const now = new Date();
    if (room.startDate <= now && room.endDate > now) {
      throw new ConflictException('This room already has an active challenge');
    }

    const startsAt = dto.starts_on ? new Date(dto.starts_on) : now;
    const endsAt = new Date(dto.ends_on);
    if (endsAt <= startsAt) {
      throw new BadRequestException('Challenge end must be after its start');
    }

    const challenge = await this.prisma.league.update({
      where: { id: roomId },
      data: {
        description: dto.title,
        startDate: startsAt,
        endDate: endsAt,
        status: startsAt <= now ? 'active' : 'upcoming',
        participationMode: dto.participation_mode ?? 'photo',
      },
    });

    return {
      id: challenge.id,
      roomId: challenge.id,
      title: dto.title,
      metric: dto.metric,
      metricUnit: 'min',
      participationMode: challenge.participationMode,
      status: startsAt <= now ? 'active' : 'upcoming',
      startsAt,
      endsAt,
      serverTime: now,
      participantCount: await this.prisma.leagueMember.count({
        where: { leagueId: roomId },
      }),
    };
  }

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
    const latestPhotos = await this.prisma.$queryRaw<
      Array<{ user_id: string; latest_photo_url: string }>
    >(Prisma.sql`
      SELECT DISTINCT ON (fp."user_id")
        fp."user_id" AS user_id,
        COALESCE(fp."photo_url", proof."photo_url") AS latest_photo_url
      FROM "feed_posts" fp
      LEFT JOIN LATERAL (
        SELECT pc."photo_url"
        FROM "proof_checks" pc
        WHERE pc."session_id" = fp."session_id"
          AND pc."status" = 'passed'
          AND pc."photo_url" IS NOT NULL
        ORDER BY pc."responded_at" DESC NULLS LAST, pc."id" DESC
        LIMIT 1
      ) proof ON fp."show_proof_photo" = TRUE
      WHERE fp."league_id" = ${challengeId}::uuid
        AND fp."user_id" IN (${Prisma.join(memberIds)})
        AND fp."created_at" >= ${league.startDate}
        AND fp."created_at" < ${league.endDate}
        AND COALESCE(fp."photo_url", proof."photo_url") IS NOT NULL
      ORDER BY fp."user_id", fp."created_at" DESC, fp."id" DESC
    `);
    const latestPhotoByUser = new Map(
      latestPhotos.map((photo) => [photo.user_id, photo.latest_photo_url]),
    );

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
          latestPhotoUrl: latestPhotoByUser.get(member.userId) ?? null,
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
        participationMode: league.participationMode,
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

  async details(challengeId: string, userId: string) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: challengeId, userId } },
    });
    if (!membership) throw new ForbiddenException('You are not a room member');

    // Read the invite credential only after authorization. Never spread this
    // Prisma row into the response: every returned field is picked explicitly.
    const challenge = await this.prisma.league.findUnique({
      where: { id: challengeId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, avatarUrl: true, timezone: true },
            },
          },
        },
      },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');

    // Prisma cannot reference sibling fields in a relation filter, so fetch
    // the exact window after the guarded challenge read.
    const checkIns = await this.prisma.feedPost.findMany({
      where: {
        leagueId: challengeId,
        createdAt: { gte: challenge.startDate, lt: challenge.endDate },
      },
      select: { userId: true, createdAt: true },
    });
    const leaderboard = await this.leaderboard(challengeId, userId, 1, 4);
    const memberById = new Map(
      challenge.members.map((member) => [member.userId, member]),
    );
    /**
     * **Check-in é a pessoa ter aparecido no dia, não o número de fotos.**
     *
     * Quem posta três fotos numa terça apareceu uma vez, não três — as três
     * continuam no feed, porque o feed é o registro do que aconteceu; a
     * contagem é outra coisa, e mede presença. Contar posts premiava quem
     * fotografa muito em vez de quem aparece sempre, que é exatamente o
     * contrário do que a sala mede.
     *
     * Por isso tudo aqui é `Set` de datas locais, e não contador: a soma sai
     * de `.size`, e repetir o mesmo dia não mexe no número.
     */
    const activeDaysByUser = new Map<string, Set<string>>();
    const groupActiveDays = new Set<string>();
    const earlyBirdDays = new Map<string, Set<string>>();
    const nightOwlDays = new Map<string, Set<string>>();
    const marcarDia = (mapa: Map<string, Set<string>>, userId: string, dia: string) => {
      const dias = mapa.get(userId) ?? new Set<string>();
      dias.add(dia);
      mapa.set(userId, dias);
    };

    for (const checkIn of checkIns) {
      const timezone = memberById.get(checkIn.userId)?.user.timezone;
      const local = timezone
        ? this.localDateAndHour(checkIn.createdAt, timezone)
        : null;
      if (!local) continue;
      marcarDia(activeDaysByUser, checkIn.userId, local.date);
      groupActiveDays.add(local.date);

      // Madrugador e coruja seguem a mesma régua: são dias em que a pessoa
      // apareceu naquela faixa de hora. Três fotos antes das 9h de uma
      // segunda são uma manhã, não três.
      if (local.hour >= 5 && local.hour < 9) {
        marcarDia(earlyBirdDays, checkIn.userId, local.date);
      } else if (local.hour >= 0 && local.hour < 5) {
        marcarDia(nightOwlDays, checkIn.userId, local.date);
      }
    }

    const now = new Date();
    const durationMs = challenge.endDate.getTime() - challenge.startDate.getTime();
    const elapsedFraction =
      durationMs <= 0
        ? 0
        : Math.min(
            1,
            Math.max(0, (now.getTime() - challenge.startDate.getTime()) / durationMs),
          );
    const superlative = (dias: Map<string, Set<string>>) => {
      const winner = [...dias.entries()].sort(
        ([userA, diasA], [userB, diasB]) =>
          diasB.size - diasA.size || userA.localeCompare(userB),
      )[0];
      if (!winner) return null;
      const member = memberById.get(winner[0]);
      return member
        ? {
            userId: member.userId,
            displayName: member.displayName,
            avatarUrl: member.user.avatarUrl,
            checkIns: winner[1].size,
          }
        : null;
    };

    // Um check-in por pessoa por dia, somado sobre todo mundo. Não é
    // `groupActiveDays.size`, que ignora quantas pessoas apareceram no dia.
    const totalCheckIns = [...activeDaysByUser.values()].reduce(
      (soma, dias) => soma + dias.size,
      0,
    );

    return {
      room: {
        id: challenge.id,
        name: challenge.name,
        inviteCode: challenge.inviteCode,
      },
      challenge: {
        id: challenge.id,
        startsAt: challenge.startDate,
        endsAt: challenge.endDate,
        serverTime: now,
        elapsedFraction,
      },
      rankings: leaderboard.entries.map((entry) => ({
        rank: entry.rank,
        userId: entry.userId,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl,
        activeDays: activeDaysByUser.get(entry.userId)?.size ?? 0,
      })),
      groupStats: {
        totalCheckIns,
        totalDaysActive: groupActiveDays.size,
        averageCheckInsPerDay:
          groupActiveDays.size === 0
            ? 0
            : Number((totalCheckIns / groupActiveDays.size).toFixed(2)),
        earlyBird: superlative(earlyBirdDays),
        nightOwl: superlative(nightOwlDays),
      },
    };
  }

  private localDateAndHour(at: Date, timezone: string) {
    const format = () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(at);
    try {
      const parts = format();
      const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '';
      return {
        date: `${value('year')}-${value('month')}-${value('day')}`,
        hour: Number(value('hour')),
      };
    } catch {
      return null;
    }
  }
}
