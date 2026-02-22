import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { RematchDto } from './dto/rematch.dto';
import type { LeagueStatus } from '@prisma/client';

@Injectable()
export class LeaguesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementsService: AchievementsService,
  ) {}

  private generateInviteCode(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async sendSystemChat(
    leagueId: string,
    content: string,
  ): Promise<void> {
    await this.prisma.chatMessage.create({
      data: {
        leagueId,
        userId: null,
        content,
        messageType: 'system',
      },
    });
  }

  async create(userId: string, dto: CreateLeagueDto) {
    const inviteCode = this.generateInviteCode();
    const today = new Date().toISOString().split('T')[0];
    const status: LeagueStatus =
      dto.start_date <= today ? 'active' : 'upcoming';

    const league = await this.prisma.$transaction(async (tx) => {
      const l = await tx.league.create({
        data: {
          name: dto.name,
          description: dto.description || null,
          ownerId: userId,
          startDate: new Date(dto.start_date),
          endDate: new Date(dto.end_date),
          privacy: dto.privacy,
          mode: dto.mode,
          status,
          inviteCode,
          maxMembers: dto.max_members || 50,
        },
      });

      await tx.leagueMember.create({
        data: {
          leagueId: l.id,
          userId,
          role: 'owner',
          displayName: dto.display_name,
        },
      });

      return l;
    });

    await this.achievementsService.checkSocialAchievement(
      userId,
      'league_create',
    );

    return league;
  }

  async findById(leagueId: string, userId: string) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      throw new NotFoundException('League not found');
    }

    const memberCount = await this.prisma.leagueMember.count({
      where: { leagueId },
    });

    if (league.privacy === 'private') {
      const membership = await this.prisma.leagueMember.findUnique({
        where: { leagueId_userId: { leagueId, userId } },
      });

      if (!membership) {
        throw new ForbiddenException(
          'You are not a member of this private league',
        );
      }
    }

    return { ...league, member_count: memberCount };
  }

  async findUserLeagues(userId: string) {
    const memberships = await this.prisma.leagueMember.findMany({
      where: { userId },
      include: { league: true },
    });

    if (memberships.length === 0) return [];

    const results = await Promise.all(
      memberships.map(async (membership) => {
        const [memberCount, rankedMembers] = await Promise.all([
          this.prisma.leagueMember.count({
            where: { leagueId: membership.leagueId },
          }),
          this.prisma.leagueMember.findMany({
            where: { leagueId: membership.leagueId },
            select: { userId: true, totalSp: true },
            orderBy: { totalSp: 'desc' },
          }),
        ]);

        const userRank =
          rankedMembers.findIndex((m) => m.userId === userId) + 1;

        return {
          ...membership.league,
          member_count: memberCount,
          user_role: membership.role,
          user_total_sp: membership.totalSp,
          user_rank: userRank || null,
        };
      }),
    );

    return results;
  }

  async previewByInviteCode(inviteCode: string, userId: string) {
    const league = await this.prisma.league.findUnique({
      where: { inviteCode },
      select: {
        id: true,
        name: true,
        description: true,
        mode: true,
        privacy: true,
        status: true,
        startDate: true,
        endDate: true,
        maxMembers: true,
      },
    });

    if (!league) {
      throw new NotFoundException('League not found with this invite code');
    }

    const memberCount = await this.prisma.leagueMember.count({
      where: { leagueId: league.id },
    });

    const existingMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: league.id, userId } },
    });

    return {
      ...league,
      memberCount,
      isFull: memberCount >= league.maxMembers,
      isMember: !!existingMember,
    };
  }

  async joinByInviteCode(userId: string, inviteCode: string, displayName: string) {
    const league = await this.prisma.league.findUnique({
      where: { inviteCode },
    });

    if (!league) {
      throw new NotFoundException('League not found with this invite code');
    }

    const memberCount = await this.prisma.leagueMember.count({
      where: { leagueId: league.id },
    });

    if (memberCount >= league.maxMembers) {
      throw new BadRequestException(
        'This league has reached its maximum number of members',
      );
    }

    const existingMember = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: league.id, userId } },
    });

    if (existingMember) {
      throw new ConflictException('You are already a member of this league');
    }

    await this.prisma.leagueMember.create({
      data: { leagueId: league.id, userId, role: 'member', displayName },
    });

    await this.sendSystemChat(league.id, `${displayName} joined the league!`);

    await this.achievementsService.checkSocialAchievement(
      userId,
      'league_join',
    );

    return league;
  }

  async leaveLeague(userId: string, leagueId: string) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership) {
      throw new NotFoundException('You are not a member of this league');
    }

    if (membership.role === 'owner') {
      throw new ForbiddenException(
        'Owners cannot leave the league. Transfer ownership first.',
      );
    }

    const leaveName = membership.displayName;

    await this.prisma.leagueMember.delete({
      where: { leagueId_userId: { leagueId, userId } },
    });

    await this.sendSystemChat(leagueId, `${leaveName} left the league.`);

    return { message: 'Successfully left the league' };
  }

  async getLeaderboard(
    leagueId: string,
    period: 'weekly' | 'monthly' | 'all_time',
  ) {
    const orderByField =
      period === 'weekly'
        ? 'weeklySp'
        : period === 'monthly'
          ? 'monthlySp'
          : 'totalSp';

    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            handle: true,
            avatarUrl: true,
            level: true,
          },
        },
      },
      orderBy: { [orderByField]: 'desc' },
    });

    return members.map((member, index) => ({
      rank: index + 1,
      user_id: member.user.id,
      username: member.displayName,
      handle: member.user.handle,
      avatar_url: member.user.avatarUrl,
      total_sp:
        period === 'weekly'
          ? member.weeklySp
          : period === 'monthly'
            ? member.monthlySp
            : member.totalSp,
      verified_hours: Number(member.verifiedHours),
      level: member.user.level,
    }));
  }

  async getEndResults(leagueId: string) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      throw new NotFoundException('League not found');
    }

    if (league.status !== 'completed') {
      throw new BadRequestException('League has not completed yet');
    }

    const leaderboard = await this.getLeaderboard(leagueId, 'all_time');

    return {
      league,
      podium: leaderboard.slice(0, 3),
      full_rankings: leaderboard,
    };
  }

  async rematch(userId: string, leagueId: string, dto: RematchDto) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      throw new NotFoundException('League not found');
    }

    if (league.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the league owner can create a rematch',
      );
    }

    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId },
      select: { userId: true, displayName: true },
    });

    const inviteCode = this.generateInviteCode();

    return this.prisma.$transaction(async (tx) => {
      const newLeague = await tx.league.create({
        data: {
          name: `${league.name} (Rematch)`,
          description: league.description,
          ownerId: userId,
          startDate: new Date(),
          endDate: new Date(dto.end_date),
          privacy: league.privacy,
          mode: league.mode,
          status: 'active',
          inviteCode,
          maxMembers: league.maxMembers,
        },
      });

      if (members.length > 0) {
        await tx.leagueMember.createMany({
          data: members.map((member) => ({
            leagueId: newLeague.id,
            userId: member.userId,
            displayName: member.displayName,
            role: member.userId === userId ? 'owner' : ('member' as const),
          })),
        });
      }

      return newLeague;
    });
  }

  async updateLeague(
    userId: string,
    leagueId: string,
    dto: UpdateLeagueDto,
  ) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { ownerId: true },
    });

    if (!league) {
      throw new NotFoundException('League not found');
    }

    if (league.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the league owner can update the league',
      );
    }

    return this.prisma.league.update({
      where: { id: leagueId },
      data: {
        ...dto,
        ...(dto.start_date
          ? { startDate: new Date(dto.start_date) }
          : {}),
        ...(dto.end_date ? { endDate: new Date(dto.end_date) } : {}),
      },
    });
  }

  async getMembers(leagueId: string) {
    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            handle: true,
            avatarUrl: true,
            level: true,
          },
        },
      },
      orderBy: { totalSp: 'desc' },
    });

    return members.map((m) => ({
      ...m,
      verifiedHours: Number(m.verifiedHours),
    }));
  }

  async updateLeagueStatuses(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.league.updateMany({
      where: { status: 'upcoming', startDate: { lte: today } },
      data: { status: 'active' },
    });

    await this.prisma.league.updateMany({
      where: { status: 'active', endDate: { lt: today } },
      data: { status: 'completed' },
    });
  }

  async resetWeeklySp(): Promise<void> {
    await this.prisma.leagueMember.updateMany({
      data: { weeklySp: 0 },
    });
  }

  async resetMonthlySp(): Promise<void> {
    await this.prisma.leagueMember.updateMany({
      data: { monthlySp: 0 },
    });
  }
}
