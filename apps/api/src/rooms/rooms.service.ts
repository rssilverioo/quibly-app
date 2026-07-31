import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const now = new Date();
    const memberships = await this.prisma.leagueMember.findMany({
      where: { userId },
      include: {
        league: {
          include: {
            members: {
              select: { userId: true, totalSp: true },
              orderBy: { totalSp: 'desc' },
            },
            feedPosts: {
              select: { createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((membership) => {
      const { league } = membership;
      const challengeIsActive =
        league.startDate.getTime() <= now.getTime() &&
        league.endDate.getTime() > now.getTime();
      const rank =
        league.members.findIndex((member) => member.userId === userId) + 1;

      return {
        id: league.id,
        name: league.name,
        memberCount: league.members.length,
        totalSp: membership.totalSp,
        lastPostAt: league.feedPosts[0]?.createdAt ?? null,
        myMembership: {
          role: membership.role,
          displayName: membership.displayName,
        },
        activeChallenge: challengeIsActive
          ? {
              id: league.id,
              roomId: league.id,
              title: league.description ?? league.name,
              metric: 'minutes',
              metricUnit: 'min',
              status: 'active',
              startsAt: league.startDate,
              endsAt: league.endDate,
              serverTime: now,
              remainingSeconds: Math.max(
                0,
                Math.floor((league.endDate.getTime() - now.getTime()) / 1000),
              ),
              participantCount: league.members.length,
              me: {
                rank: rank || null,
                metricValue: membership.totalSp,
              },
            }
          : null,
      };
    });
  }
}
