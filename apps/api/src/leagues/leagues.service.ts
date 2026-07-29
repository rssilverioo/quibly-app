import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { RematchDto } from './dto/rematch.dto';
import { Prisma, type LeagueStatus } from '@prisma/client';

/** Beyond this, an `active` session is a zombie, not a person studying. */
const LIVE_SESSION_MAX_HOURS = 12;

const INVITE_CODE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const INVITE_CODE_LENGTH = 8;
/** `inviteCode` is the only `@unique` field this ever collides on. */
const MAX_INVITE_CODE_ATTEMPTS = 5;

@Injectable()
export class LeaguesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementsService: AchievementsService,
  ) {}

  /**
   * Cryptographically random invite code. `Math.random()` isn't just
   * predictable — with only ~2^31 internal states it lets an attacker
   * enumerate/guess codes for private leagues far faster than the 62^8
   * keyspace size suggests. `crypto.randomBytes` closes that.
   *
   * The `% alphabet.length` step has a very slight modulo bias (256 isn't a
   * multiple of 62), which is irrelevant here: this is a join code, not a
   * secret requiring uniform distribution guarantees.
   */
  private generateInviteCode(): string {
    const bytes = randomBytes(INVITE_CODE_LENGTH);
    let result = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      result += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
    }
    return result;
  }

  private isInviteCodeCollision(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  /**
   * Runs `attempt` with a freshly generated invite code, retrying with a new
   * code if the `@unique` constraint on `inviteCode` collides — instead of
   * letting Prisma's error bubble up as a bare 500. A relaunch of `attempt`
   * on retry is safe because both callers wrap it in `$transaction`: a
   * collision means nothing committed, so there's nothing to unwind.
   */
  private async withUniqueInviteCode<T>(
    attempt: (inviteCode: string) => Promise<T>,
  ): Promise<T> {
    for (let i = 0; i < MAX_INVITE_CODE_ATTEMPTS; i++) {
      const inviteCode = this.generateInviteCode();
      try {
        return await attempt(inviteCode);
      } catch (error) {
        const isLastAttempt = i === MAX_INVITE_CODE_ATTEMPTS - 1;
        if (!this.isInviteCodeCollision(error) || isLastAttempt) {
          throw error;
        }
        // Collision on a non-final attempt — loop and try a new code.
      }
    }
    // Unreachable: the loop always returns or throws. Satisfies TS control
    // flow analysis without an `any`/`!` escape hatch.
    throw new InternalServerErrorException(
      'Could not generate a unique invite code',
    );
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
    const today = new Date().toISOString().split('T')[0];
    const status: LeagueStatus =
      dto.start_date <= today ? 'active' : 'upcoming';

    const league = await this.withUniqueInviteCode((inviteCode) =>
      this.prisma.$transaction(async (tx) => {
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
      }),
    );

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

  /**
   * Everyone in the caller's leagues who has a study session running right now.
   *
   * Sessions are matched by *member*, not by `leagueId`, because attaching a
   * session to a league is optional — a friend studying without picking a
   * league should still show up as present.
   */
  async findLiveMembers(userId: string) {
    const memberships = await this.prisma.leagueMember.findMany({
      where: { userId },
      select: { leagueId: true },
    });
    if (memberships.length === 0) return [];

    const leagueIds = memberships.map((m) => m.leagueId);

    const peers = await this.prisma.leagueMember.findMany({
      where: { leagueId: { in: leagueIds }, userId: { not: userId } },
      select: {
        userId: true,
        displayName: true,
        league: { select: { id: true, name: true } },
      },
    });
    if (peers.length === 0) return [];

    // A peer can share more than one league with the caller — keep the first.
    const peerByUserId = new Map<string, (typeof peers)[number]>();
    for (const peer of peers) {
      if (!peerByUserId.has(peer.userId)) peerByUserId.set(peer.userId, peer);
    }

    // Sessions left `active` for longer than this are zombies (app killed
    // mid-session), not people actually studying.
    const cutoff = new Date(Date.now() - LIVE_SESSION_MAX_HOURS * 3600_000);

    const sessions = await this.prisma.studySession.findMany({
      where: {
        userId: { in: [...peerByUserId.keys()] },
        status: 'active',
        startedAt: { gte: cutoff },
      },
      select: {
        id: true,
        userId: true,
        startedAt: true,
        proofMode: true,
        subject: { select: { name: true, color: true } },
        user: { select: { username: true, handle: true, avatarUrl: true } },
      },
      orderBy: { startedAt: 'asc' },
    });

    const now = Date.now();

    return sessions.map((session) => {
      const peer = peerByUserId.get(session.userId)!;
      return {
        session_id: session.id,
        user_id: session.userId,
        display_name: peer.displayName || session.user.username,
        handle: session.user.handle,
        avatar_url: session.user.avatarUrl,
        subject_name: session.subject.name,
        subject_color: session.subject.color,
        league_id: peer.league.id,
        league_name: peer.league.name,
        proof_mode: session.proofMode,
        started_at: session.startedAt.toISOString(),
        elapsed_minutes: Math.max(
          0,
          Math.floor((now - session.startedAt.getTime()) / 60_000),
        ),
      };
    });
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

    return this.withUniqueInviteCode((inviteCode) => this.prisma.$transaction(async (tx) => {
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
    }));
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
