import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../moderation/moderation.service';

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly moderation: ModerationService,
  ) {}

  async getLeagueFeed(
    leagueId: string,
    userId: string,
    page: number,
    limit: number,
  ) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this league');
    }

    const offset = (page - 1) * limit;

    /*
     Quem esta pessoa bloqueou não aparece no feed dela.

     No `where`, e não filtrando depois: com paginação, tirar linhas do
     resultado devolveria páginas curtas e um `total` que não bate com o que se
     vê — e a última página poderia vir vazia sem que houvesse fim.

     Vale só para quem está lendo. Os posts continuam existindo para todos os
     outros, e quem foi bloqueado segue membro da sala e no ranking: bloquear
     não pode ser um jeito de expulsar alguém de um grupo que não é seu.
    */
    const bloqueados = await this.moderation.bloqueadosPor(userId);
    const semBloqueados =
      bloqueados.size > 0 ? { userId: { notIn: [...bloqueados] } } : {};

    const [posts, total, members] = await Promise.all([
      this.prisma.feedPost.findMany({
        where: { leagueId, ...semBloqueados },
        include: {
          user: {
            select: { username: true, handle: true, avatarUrl: true },
          },
          session: {
            select: {
              id: true,
              totalDurationMinutes: true,
              pointsEarned: true,
              xpEarned: true,
              isVerified: true,
              proofMode: true,
              subject: {
                select: { id: true, name: true, color: true },
              },
              proofChecks: {
                where: { status: 'passed' },
                select: { photoUrl: true },
                take: 1,
              },
            },
          },
          reactions: true,
          comments: {
            include: {
              user: {
                select: { username: true, handle: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: 'desc' as const },
            take: 3,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.feedPost.count({ where: { leagueId, ...semBloqueados } }),
      this.prisma.leagueMember.findMany({
        where: { leagueId },
        select: { userId: true, displayName: true },
      }),
    ]);

    const displayNameMap = new Map(
      members.map((m) => [m.userId, m.displayName]),
    );

    const enrichedPosts = posts.map((post) => {
      const reactionCounts: Record<string, number> = {};
      const userReactionEmojis: string[] = [];

      for (const reaction of post.reactions) {
        reactionCounts[reaction.emoji] =
          (reactionCounts[reaction.emoji] || 0) + 1;
        if (reaction.userId === userId) {
          userReactionEmojis.push(reaction.emoji);
        }
      }

      const { reactions: _reactions, ...postWithoutReactions } = post;
      const proofPhotoUrl = post.showProofPhoto
        ? post.session?.proofChecks[0]?.photoUrl ?? null
        : null;
      const photoUrl = post.photoUrl ?? proofPhotoUrl;
      return {
        ...postWithoutReactions,
        kind: post.session ? 'session' : 'standalone',
        photoUrl,
        session: post.session
          ? {
              ...post.session,
              minutes: Number(post.session.totalDurationMinutes),
              proofPhotoUrl,
            }
          : null,
        user: {
          ...post.user,
          username: displayNameMap.get(post.userId) ?? post.user.username,
        },
        reactions: reactionCounts,
        user_reactions: userReactionEmojis,
        latest_comments: post.comments.map((comment) => ({
          ...comment,
          user: {
            ...comment.user,
            username:
              displayNameMap.get(comment.userId) ?? comment.user.username,
          },
        })),
      };
    });

    return { posts: enrichedPosts, total, page, limit };
  }

  async getChallengeMemberPosts(
    challengeId: string,
    requestingUserId: string,
    memberUserId: string,
    page: number,
    limit: number,
  ) {
    const [challenge, requesterMembership, targetMembership] = await Promise.all([
      this.prisma.league.findUnique({
        where: { id: challengeId },
        select: { id: true, startDate: true, endDate: true },
      }),
      this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: { leagueId: challengeId, userId: requestingUserId },
        },
      }),
      this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: { leagueId: challengeId, userId: memberUserId },
        },
      }),
    ]);

    if (!challenge) throw new NotFoundException('Challenge not found');
    if (!requesterMembership) {
      throw new ForbiddenException('You are not a room member');
    }
    if (!targetMembership) throw new NotFoundException('Member not found');

    const where = {
      leagueId: challengeId,
      userId: memberUserId,
      createdAt: { gte: challenge.startDate, lt: challenge.endDate },
    };
    const offset = (page - 1) * limit;
    const [posts, total, members] = await Promise.all([
      this.prisma.feedPost.findMany({
        where,
        include: {
          user: { select: { username: true, handle: true, avatarUrl: true } },
          session: {
            select: {
              id: true,
              totalDurationMinutes: true,
              pointsEarned: true,
              xpEarned: true,
              isVerified: true,
              proofMode: true,
              subject: { select: { id: true, name: true, color: true } },
              proofChecks: {
                where: { status: 'passed' },
                select: { photoUrl: true },
                take: 1,
              },
            },
          },
          reactions: true,
          comments: {
            include: {
              user: { select: { username: true, handle: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' as const },
            take: 3,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.feedPost.count({ where }),
      this.prisma.leagueMember.findMany({
        where: { leagueId: challengeId },
        select: { userId: true, displayName: true },
      }),
    ]);

    const displayNameMap = new Map(
      members.map((member) => [member.userId, member.displayName]),
    );
    const items = posts.map((post) => {
      const reactions: Record<string, number> = {};
      const userReactions: string[] = [];
      for (const reaction of post.reactions) {
        reactions[reaction.emoji] = (reactions[reaction.emoji] ?? 0) + 1;
        if (reaction.userId === requestingUserId) userReactions.push(reaction.emoji);
      }
      const proofPhotoUrl = post.showProofPhoto
        ? post.session?.proofChecks[0]?.photoUrl ?? null
        : null;
      const { reactions: _rawReactions, ...basePost } = post;
      return {
        ...basePost,
        kind: post.session ? 'session' : 'standalone',
        photoUrl: post.photoUrl ?? proofPhotoUrl,
        session: post.session
          ? {
              ...post.session,
              minutes: Number(post.session.totalDurationMinutes),
              proofPhotoUrl,
            }
          : null,
        user: {
          ...post.user,
          username: displayNameMap.get(post.userId) ?? post.user.username,
        },
        reactions,
        userReactions,
        latestComments: post.comments.map((comment) => ({
          ...comment,
          user: {
            ...comment.user,
            username:
              displayNameMap.get(comment.userId) ?? comment.user.username,
          },
        })),
      };
    });

    return { items, total, page, limit };
  }

  async toggleReaction(userId: string, postId: string, emoji: string) {
    const existing = await this.prisma.feedReaction.findUnique({
      where: { postId_userId_emoji: { postId, userId, emoji } },
    });

    if (existing) {
      await this.prisma.feedReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.feedReaction.create({
        data: { userId, postId, emoji },
      });

      // Send push notification for new reaction
      const post = await this.prisma.feedPost.findUnique({
        where: { id: postId },
        select: { userId: true },
      });
      if (post) {
        const reactor = await this.prisma.profile.findUnique({
          where: { id: userId },
          select: { username: true },
        });
        this.notificationsService
          .notifyFeedReaction(
            post.userId,
            userId,
            reactor?.username ?? 'Someone',
            emoji,
          )
          .catch(() => {});
      }
    }

    const allReactions = await this.prisma.feedReaction.findMany({
      where: { postId },
    });

    const reactionCounts: Record<string, number> = {};
    const userReactionEmojis: string[] = [];

    for (const reaction of allReactions) {
      reactionCounts[reaction.emoji] =
        (reactionCounts[reaction.emoji] || 0) + 1;
      if (reaction.userId === userId) {
        userReactionEmojis.push(reaction.emoji);
      }
    }

    return { reactions: reactionCounts, user_reactions: userReactionEmojis };
  }

  async addComment(userId: string, postId: string, content: string) {
    const post = await this.prisma.feedPost.findUnique({
      where: { id: postId },
      select: { leagueId: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId: post.leagueId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this league');
    }

    const comment = await this.prisma.feedComment.create({
      data: { userId, postId, content },
      include: {
        user: {
          select: { username: true, handle: true, avatarUrl: true },
        },
      },
    });

    // Send push notification for new comment
    const postData = await this.prisma.feedPost.findUnique({
      where: { id: postId },
      select: { userId: true },
    });
    if (postData) {
      this.notificationsService
        .notifyFeedComment(
          postData.userId,
          userId,
          membership.displayName,
          content,
        )
        .catch(() => {});
    }

    return {
      ...comment,
      user: {
        ...comment.user,
        username: membership.displayName,
      },
    };
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.feedComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.feedComment.delete({ where: { id: commentId } });

    return { deleted: true };
  }

  async getPostComments(postId: string, page: number, limit: number) {
    const post = await this.prisma.feedPost.findUnique({
      where: { id: postId },
      select: { leagueId: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const offset = (page - 1) * limit;

    const [comments, total, members] = await Promise.all([
      this.prisma.feedComment.findMany({
        where: { postId },
        include: {
          user: {
            select: { username: true, handle: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.feedComment.count({ where: { postId } }),
      this.prisma.leagueMember.findMany({
        where: { leagueId: post.leagueId },
        select: { userId: true, displayName: true },
      }),
    ]);

    const displayNameMap = new Map(
      members.map((m) => [m.userId, m.displayName]),
    );

    return {
      comments: comments.map((c) => ({
        ...c,
        user: {
          ...c.user,
          username: displayNameMap.get(c.userId) ?? c.user.username,
        },
      })),
      total,
      page,
      limit,
    };
  }

  async toggleProofPhotoVisibility(userId: string, postId: string) {
    const post = await this.prisma.feedPost.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, showProofPhoto: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only modify your own posts');
    }

    return this.prisma.feedPost.update({
      where: { id: postId },
      data: { showProofPhoto: !post.showProofPhoto },
    });
  }
}
